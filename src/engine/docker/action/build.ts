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
      imageName: string|undefined,
      client: DockerClient,
      arDir: string,
      buildDir: string,
      env: any
  }
): Promise<string> {
    let {
        imageName,
        client,
        arDir,
        buildDir,
        env
    } = options;

    if (!imageName) {
        // Generate an unique image name
        imageName = "nsm-template-" + path.basename(buildDir) + '-' + Date.now(); // TODO: better unique name generation, maybe hash of the build context?
    }

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

    return async (imageId, buildDir, options) => {
        if (!buildDir) {
            throw new Error('Docker engine does not support no-template mode!');
        }

        currentContext.logger.info("Building image for " + arDir + "...");
        const imageBuildClock = clock();
        const imageTag = await prepareImage({imageName: imageId, client, arDir, buildDir, env: options});
        currentContext.logger.info('Image built in ' + imageBuildClock.durFromCreation() + 'ms');

        return imageTag;
    }
}