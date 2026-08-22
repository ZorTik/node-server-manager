import winston from "winston";
import fs from "fs";
import { API_LOGS_PATH, SERVICES_LOGS_PATH } from "./log";

const { combine, timestamp, label, printf } = winston.format;

export function createNewLatest() {
    if (fs.existsSync(API_LOGS_PATH + '/latest.log')) {
        const date = new Date(Date.now()).toJSON().slice(2, 10) + '.'
            + new Date(Date.now()).getHours() + '.'
            + new Date(Date.now()).getMinutes();
        fs.renameSync(API_LOGS_PATH + '/latest.log', process.cwd() + '/logs/' + date + '.log');
    }
}

export function createLogger(options?: { label?: string }) {
    const debug = process.env.DEBUG === 'true';
    return winston.createLogger({
        level: debug ? 'debug' : 'info',
        format: combine(
            label({ label: options?.label ?? 'NSM' }),
            timestamp(),
            printf(({ level, message, label, timestamp }) => {
                return `${timestamp} [${label}] ${level}: ${message}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({dirname: API_LOGS_PATH, filename: 'latest.log'})
        ]
    });
}

export function logService(id: string, str: any) {
    // Isn't this thing blocking??? Look at it later, zort - by zort xdd
    const log_path = SERVICES_LOGS_PATH + id + '.log';
    fs.appendFileSync(log_path, (str ?? '').toString() + '\n');
}

