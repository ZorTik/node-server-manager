import winston from "winston";
import fs from "fs";

const { combine, timestamp, label, errors, printf } = winston.format;

export function createLatestLogFile() {
    if (fs.existsSync(process.cwd() + '/logs/latest.log')) {
        const date = new Date(Date.now()).toJSON().slice(2, 10) + '.'
            + new Date(Date.now()).getHours() + '.'
            + new Date(Date.now()).getMinutes();

        fs.renameSync(process.cwd() + '/logs/latest.log', process.cwd() + '/logs/' + date + '.log');
    }
}

export function createLogger(options?: { label?: string }) {
    const debug = process.env.DEBUG === 'true';
    return winston.createLogger({
        level: debug ? 'debug' : 'info',
        format: combine(
          errors({ stack: true }),
          label({ label: options?.label ?? 'NSM' }),
          timestamp(),
          printf(({ level, message, label, timestamp, stack }) => {
              let row = `${timestamp} [${label}] ${level}: ${message}`;

              return stack ? row + `\n${stack}` : row;
          })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({dirname: 'logs', filename: 'latest.log'})
        ]
    });
}

export function logService(id: string, str: any) {
    // Isn't this thing blocking??? Look at it later, zort - by zort xdd
    const log_path = process.cwd() + '/service_logs/' + id + '.log';
    fs.appendFileSync(log_path, (str ?? '').toString() + '\n');
}