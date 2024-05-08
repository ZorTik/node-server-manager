import winston from "winston";
import * as fs from "fs";

const { combine, timestamp, label, printf } = winston.format;

export function prepareLogger(debug: boolean) {
    if (fs.existsSync(process.cwd() + '/logs/latest.log')) {
        const date = new Date(Date.now()).toJSON().slice(2, 10) + '.'
            + new Date(Date.now()).getHours() + '.'
            + new Date(Date.now()).getMinutes();
        fs.renameSync(process.cwd() + '/logs/latest.log', process.cwd() + '/logs/' + date + '.log');
    }
    return winston.createLogger({
        level: debug ? 'debug' : 'info',
        format: combine(
            label({ label: 'NSM' }),
            timestamp(),
            printf(({ level, message, label, timestamp }) => {
                return `${timestamp} [${label}] ${level}: ${message}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({dirname: 'logs', filename: 'latest.log'})
        ]
    });
}