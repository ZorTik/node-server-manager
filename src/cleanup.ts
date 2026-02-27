import {AppBootContext} from "@nsm/app";
import {setStatus} from "@nsm/server";
import {resolveSequentially} from "@nsm/util/promises";
import {setStopping} from "@nsm/engine/asyncp";

let active = false;

const cleanup = (ctx: AppBootContext, exit?: boolean) => {
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
            () => steps('EXIT', ctx)
        ] : []),
        () => manager.stopRunning()
    ).then(() => {
        if (exit == true) {
            process.exit(0);
        }
    });
}

export const postInit = (ctx: AppBootContext) => {
    // Cleanup on start
    cleanup(ctx);

    // Handle exit
    process.on('exit', () => {
        // Cleanup on exit
        cleanup(ctx, true);
    });

    // Debug info
    ctx.logger.debug('Signal handlers');
}