import app from "./app";
import server, {setStatus, status} from "./server";

// Start the server
app(server).then((ctx) => {
    const {manager, logger, steps} = ctx;

    ctx.logger.info('Registering signal handlers');

    // On SIGINT, stop all running services
    process.once('SIGINT', async () => {
        logger.info('Stopping running services...');
        setStatus("stopping");
        //steps('EXIT').forEach((f: any) => f(ctx));
        steps('EXIT', ctx);
        await manager.stopRunning();
        process.exit(0);
    });
});