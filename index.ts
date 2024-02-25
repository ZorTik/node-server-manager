import app from "./app";
import express from "express";

const server = express();

// Start the server
app(server).then(() => {
    console.log('Started');
});