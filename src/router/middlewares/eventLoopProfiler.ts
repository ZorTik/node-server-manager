import express from "express";
import {measureEventLoop} from "@nsm/profiler";

/**
 * Middleware to measure the event loop delay for each request.
 */
export const eventLoopProfiler = (): express.RequestHandler => {
  return (_, __, next) => {
    measureEventLoop();
    next();
  }
}