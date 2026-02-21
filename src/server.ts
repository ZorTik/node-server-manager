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

export function setStatus(status_: string) {
    status = status_;
}

export default server;