import app from "./app";
import express from "express";
import cors from "cors";

const server = express();

// Configure server
server.use(cors());

// Start the server
app(server).then(() => {
    console.log('Started');
});