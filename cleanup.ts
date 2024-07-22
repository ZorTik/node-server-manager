import {AppBootContext} from "@nsm/app";
import {setStatus} from "@nsm/server";
import * as bus from "@nsm/event/bus";
import {resolveSequentially} from "@nsm/util/promises";

let active = false;

export default function (ctx: AppBootContext) {
    const { manager, logger, steps } = ctx;

    if (active == true) {
        return;
    }

    active = true;
    logger.info('SIGINT' + ': Executing stop sequence, please wait');

    setStatus("stopping");
    resolveSequentially(
        () => bus.callEvent('nsm:exit', undefined),
        () => steps('EXIT', ctx),
        () => manager.stopRunning()
    ).then(() => {
        process.exit(0);
    });
}