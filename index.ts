import app from "./app";
import server, {setStatus, status} from "./server";

// Start the server
app(server).then((ctx) => {
    const {engine, logger, steps} = ctx;

    // On SIGINT, stop all running services
    process.once('SIGINT', async () => {
        logger.info('Stopping running services...');
        setStatus("stopping");
        steps('EXIT').forEach((f: any) => f(ctx));
        await engine.stopRunning();
        process.exit(0);
    });
});