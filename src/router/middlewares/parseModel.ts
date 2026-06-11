import express from "express";
import z from "zod";

export interface ParseModelOptions {
  model: {
    body: z.ZodObject<any>;
    query: z.ZodObject<any>;
    params: z.ZodObject<any>;
  }
}

/**
 * Middleware to parse and validate request parts using Zod schemas.
 *
 * @param options The options.
 */
export const parseModel = (
  options: ParseModelOptions
): express.RequestHandler => {
  return (req, res, next) => {
    for (const key in options.model) {
      const model = options.model[key as keyof ParseModelOptions["model"]];

      const result = model.safeParse(req[key as keyof express.Request]);
      if (result.success) {
        continue;
      }

      res.status(400).json({
        status: 400,
        message: `Invalid ${key} format.`,
        errors: result.error.errors,
      });
      return;
    }

    next();
  }
}