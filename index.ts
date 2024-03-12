import app from "./app";
import express from "express";
import cors from "cors";
import ws from "express-ws";

const server = ws(express()).app;

// Configure server
server.use(cors());

// Start the server
app(server).then(({engine, logger}) => {
    // On SIGINT, stop all running services
    process.once('SIGINT', async () => {
        logger.info('Stopping running services...');
        await engine.stopRunning();
        process.exit(0);
    });
});