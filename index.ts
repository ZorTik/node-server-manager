import app from "./app";
import server, {setStatus, status} from "./server";
import * as bus from "@nsm/event/bus";

// Start the server
app(server).then((ctx) => {
    const {manager, logger, steps} = ctx;

    // Catch signals
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(sig => {
        process.on(sig, async () => {
            logger.info(sig + ': Executing stop sequence, please wait');
            setStatus("stopping");
            await bus.callEvent('nsm:exit', undefined);
            steps('EXIT', ctx);
            await manager.stopRunning();
            process.exit(0);
        });
    });
});