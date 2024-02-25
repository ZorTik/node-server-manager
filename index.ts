import app from "./app";
import express from "express";

const server = express();

app(server).then(() => {
    console.log('Started');
});