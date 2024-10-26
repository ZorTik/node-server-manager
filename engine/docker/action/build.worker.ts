import {workerData, parentPort} from "worker_threads";
import fs from "fs";
import {initDockerClient} from "../client";

const appConfig = workerData['appConfig'] as any;
const archive = workerData['archive'] as string;
const tag = workerData['imageTag'] as string;
const env = workerData['env'] as any;
const debug = workerData['debug'] as boolean;

const client = initDockerClient(appConfig);
const logs = [];

if (debug) {
    console.log("Running image build inside worker.");
}

client.buildImage(archive, { t: tag, buildargs: env }).then(stream => {
    logs.push('--------- Begin Build Log ---------');
    client.modem.followProgress(stream, (err, res) => {
        if (err) {
            console.error(err);
        } else {
            res.forEach(r => {
                if (r.errorDetail) {
                    console.error(new Error(r.errorDetail));
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

if (debug) {
    console.log("End of worker.");
}