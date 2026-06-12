import express from "express";
import {AppContext} from "@nsm/app";

export interface Options {
  context: AppContext;
}

/**
 * Middleware for logging incoming requests in debug mode.
 *
 * @param options The options.
 */
export const debugRequestLogger = (
  options: Options
): express.RequestHandler => {
  return (req, _, next) => {
    const context = options.context;

    context.logger.debug(`${req.method.toUpperCase()} ${req.url}`);
    if (req.body) {
      context.logger.debug(`Body: ${JSON.stringify(req.body)}`);
    } else {
      context.logger.debug("No body");
    }
    next();
  }
}