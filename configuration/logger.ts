import winston from "winston";

const { combine, timestamp, label, printf } = winston.format;

export function prepareLogger() {
    return winston.createLogger({
        level: 'info',
        format: combine(
            label({ label: 'NSM' }),
            timestamp(),
            printf(({ level, message, label, timestamp }) => {
                return `${timestamp} [${label}] ${level}: ${message}`;
            })
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({dirname: 'logs'})
        ]
    });
}