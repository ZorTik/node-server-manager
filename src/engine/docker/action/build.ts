import DockerClient from "dockerode";
import fs from "fs";
import path from "path";
import tar from "tar";
import {currentContext, currentContext as ctx} from "../../../app";
import {ServiceEngine} from "@nsm/engine";
import {clock} from "@nsm/util/clock";
import {Worker} from "worker_threads";
import {getRootFilesFiltered} from "@nsm/engine/ignore";

async function prepareImage(
  options: {
      client: DockerClient,
      arDir: string,
      buildDir: string,
      env: any
  }
): Promise<string> {
    const {
        client,
        arDir,
        buildDir,
        env
    } = options;

    const imageName = "nsm-template-" + path.basename(buildDir);

    // TODO: make this in temp folder
    const archive = arDir + '/' + imageName + '.tar';
    try {
        fs.unlinkSync(archive);
    } catch (e) {
        if (!e.message.includes('ENOENT')) {
            throw e;
        }
    }

    await tar.c({
        gzip: false,
        file: archive,
        cwd: buildDir
    }, [...getRootFilesFiltered(buildDir)]);

    const imageTag = imageName + ':latest';
    const logs = [];
    return (
      new Promise<string>((resolve, reject) => {
          const msgHandler = (msg: any) => {
              if (Array.isArray(msg)) {
                  msg.forEach(m => {
                      // TODO: log message line into service logs?
                  });
              } else {
                  // Final message, resolve the promise with the image tag.
                  resolve(msg);
              }
          }
          if (ctx.workers) {
              // Build using workers
              const w = new Worker(__dirname + path.sep + 'build.worker.js', {
                  workerData: {
                      archive,
                      imageTag,
                      env,
                      appConfig: ctx.appConfig,
                      debug: ctx.debug
                  }
              });
              w.on('message', msgHandler);
          } else {
              // In container, worker threads are not supported. Or they
              // are disabled.
              client.buildImage(archive, { t: imageTag, buildargs: env }).then(stream => {
                  logs.push('--------- Begin Build Log ---------');
                  client.modem.followProgress(stream, (err, res) => {
                      if (err) {
                          console.error(err);
                      } else {
                          let errorOccurred = false;
                          res.forEach(r => {
                              if (r.errorDetail) {
                                  errorOccurred = true;

                                  reject(r.errorDetail);
                              } else {
                                  const msg = r.stream?.trim();
                                  console.log(msg);

                                  logs.push(msg);
                              }
                          });
                          if (errorOccurred) {
                              return;
                          }
                          logs.push('--------- End Of Build Log ---------\n');
                          fs.unlinkSync(archive);
                          msgHandler(logs);
                          msgHandler(imageTag);
                      }
                  });
              });
          }
      }).finally(() => {
          // Clean up archive file if it still exists
          try {
              fs.unlinkSync(archive);
          } catch (e) {
              if (!e.message.includes('ENOENT')) {
                  console.error('Error cleaning up archive file:', e);
              }
          }
      })
    );
}

export default function (client: DockerClient): ServiceEngine['build'] {
    const arDir = process.cwd() + '/archives';
    if (!fs.existsSync(arDir)) {
        fs.mkdirSync(arDir);
    }

    return async (buildDir, options) => {
        if (!buildDir) {
            throw new Error('Docker engine does not support no-template mode!');
        }

        // Populate env with built-in vars
        options.env.SERVICE_PORT = options.port.toString();
        options.env.SERVICE_PORTS = options.ports.join(' ');
        options.env.SERVICE_RAM = options.ram.toString();
        options.env.SERVICE_CPU = options.cpu.toString();
        options.env.SERVICE_DISK = options.disk.toString();

        currentContext.logger.info("Building image for " + arDir + "...");
        const imageBuildClock = clock();
        const imageTag = await prepareImage({client, arDir, buildDir, env: options.env});
        currentContext.logger.info('Image built in ' + imageBuildClock.durFromCreation() + 'ms');

        return imageTag;
    }
}