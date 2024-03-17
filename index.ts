import app from "./app";
import express from "express";
import cors from "cors";
import ws from "express-ws";

const server = ws(express()).app;

export let status = "running";

// Configure server
server.use(cors());

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