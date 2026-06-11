import winston from "winston";
import fs from "fs";
import path from "path";
import { getResourcesPath } from "@nsm/filestructure";

const { combine, timestamp, label, errors, printf } = winston.format;

export let currentGlobalLogger: winston.Logger;

export function setCurrentGlobalLogger(logger: winston.Logger) {
  currentGlobalLogger = logger;
}

export function createLatestLogFile() {
  if (
    fs.existsSync(path.join(getResourcesPath(), "logs", "latest.log"))
  ) {
    const date =
      new Date(Date.now()).toJSON().slice(2, 10) +
      "." +
      new Date(Date.now()).getHours() +
      "." +
      new Date(Date.now()).getMinutes();

    fs.renameSync(
      path.join(getResourcesPath(), "logs", "latest.log"),
      path.join(getResourcesPath(), "logs", date + ".log"),
    );
  }
}

export function createLogger(options?: { label?: string }) {
  const debug = process.env.DEBUG === "true";
  return winston.createLogger({
    level: debug ? "debug" : "info",
    format: combine(
      errors({ stack: true }),
      label({ label: options?.label ?? "NSM" }),
      timestamp(),
      printf(({ level, message, label, timestamp, stack }) => {
        let row = `${timestamp} [${label}] ${level}: ${message}`;

        return stack ? row + `\n${stack}` : row;
      }),
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        dirname: path.join(getResourcesPath(), "logs"),
        filename: "latest.log",
      }),
    ],
  });
}
