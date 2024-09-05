import {workerData, parentPort} from "worker_threads";
import {initDockerClient} from "./index";
import {currentContext as ctx} from "../../app";
import fs from "fs";

const appConfig = workerData['appConfig'] as any;
const archive = workerData['archive'] as string;
const tag = workerData['imageTag'] as string;
const env = workerData['env'] as any;

const client = initDockerClient(appConfig);
const logs = [];

client.buildImage(archive, { t: tag, buildargs: env }).then(stream => {
    logs.push('--------- Begin Build Log ---------');
    client.modem.followProgress(stream, (err, res) => {
        if (err) {
            ctx.logger.error(err);
        } else {
            res.forEach(r => {
                if (r.errorDetail) {
                    ctx.logger.error(new Error(r.errorDetail));
                } else {
                    const msg = r.stream?.trim();
                    //ctx.logger.info(msg);
                    logs.push(msg);
                }
            });
            logs.push('--------- End Of Build Log ---------\n');
            fs.unlinkSync(archive);
            parentPort.postMessage(logs);
            parentPort.postMessage(tag);
        }
    });
});