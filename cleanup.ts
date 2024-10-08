import {AppBootContext} from "@nsm/app";
import {setStatus} from "@nsm/server";
import * as bus from "@nsm/event/bus";
import {resolveSequentially} from "@nsm/util/promises";
import {setStopping} from "@nsm/engine/asyncp";

let active = false;

export default function (ctx: AppBootContext, exit?: boolean) {
    const { manager, logger, steps } = ctx;

    if (active == true) {
        return;
    }

    active = true;
    if (exit == true) {
        logger.info('SIGINT' + ': Executing stop sequence, please wait');
        setStatus("stopping");
        setStopping();
    }

    resolveSequentially(
        ...(exit == true ? [
            // Those steps that should only be called on exit
            () => bus.callEvent('nsm:exit', undefined),
            () => steps('EXIT', ctx)
        ] : []),
        () => manager.stopRunning()
    ).then(() => {
        if (exit == true) {
            process.exit(0);
        }
    });
}