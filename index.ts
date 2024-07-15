import app from "./app";
import server, {setStatus, status} from "./server";
import * as bus from "@nsm/event/bus";

// Start the server
app(server).then((ctx) => {
    const {manager, logger, steps} = ctx;

    ctx.logger.info('Registering signal handlers');

    // On SIGINT, stop all running services
    process.once('SIGINT', async () => {
        logger.info('Stopping running services...');
        setStatus("stopping");
        await bus.callEvent('nsm:exit', undefined);
        steps('EXIT', ctx);
        await manager.stopRunning();
        process.exit(0);
    });
});