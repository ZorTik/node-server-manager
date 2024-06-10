import app from "./app";
import express from "express";
import cors from "cors";
import ws from "express-ws";
import temp from "temp";

// Pre
// toJSON() for BigInt to avoid JSON.stringify() errors
(BigInt.prototype as any).toJSON = function () {
    return this.toString();
}

const server = ws(express()).app;

export let status = "running";

// Configure server
server.use(cors());

// Track temporary files and make sure
// they are cleaned up
temp.track();

// Start the server
app(server).then((ctx) => {
    const {engine, logger, steps} = ctx;

    // On SIGINT, stop all running services
    process.once('SIGINT', async () => {
        logger.info('Stopping running services...');
        status = "stopping";
        steps('EXIT').forEach((f: any) => f(ctx));
        await engine.stopRunning();
        process.exit(0);
    });
});