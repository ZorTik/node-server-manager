import express from "express";
import {KnownError} from "@nsm/engine/error";

/**
 * Middleware to catch known errors and respond properly.
 */
export const catchKnownErrors = (): express.ErrorRequestHandler => {
  return (err, _, res) => {
    let status = 500;
    let message = "Internal Server Error";
    if (err instanceof KnownError) {
      status = err.code;
      message = err.message;
    }

    res.status(status).json({ status, message }).end();
  }
}