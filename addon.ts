import winston from "winston";
import {Database} from "./database";
import {AppContext} from "./app";
import * as fs from "fs";

type FunctionTypes = {
    'BEFORE_CONFIG': (ctx: { logger: winston.Logger }) => Promise<void>;
    'BEFORE_DB': (ctx: { logger: winston.Logger, appConfig: any }) => Promise<void>;
    'BEFORE_ENGINE': (ctx: { logger: winston.Logger, appConfig: any, database: Database }) => Promise<void>;
    'BEFORE_SECURITY': (ctx: AppContext) => Promise<void>;
    'BEFORE_ROUTES': (ctx: AppContext) => Promise<void>;
    'BEFORE_SERVER': (ctx: AppContext) => Promise<void>;
}

export type Moment = keyof FunctionTypes;

export type Addon = {
    name: string,
    author?: string,
    version?: string,
    disabled?: boolean,
    steps: {
        [key in Moment]: FunctionTypes[key];
    }
}

// Load addons
export default async function (logger: winston.Logger) {
    const addons: Addon[] = [];
    fs.readdirSync(__dirname + '/addons')
        .map((dir) => __dirname + '/addons/' + dir + '/index.js')
        .filter((file) => fs.existsSync(file))
        .forEach((file) => {
            const addon = require(file).default as Addon;
            if (!addon.disabled) {
                addons.push(addon);

                const { name, author, version } = addon;

                logger.info(`Discovered addon ${name}${author ? ` by ${author}` : ``}${version ? ` (v${version})` : ``}`);
            }
    });
    return <T extends keyof FunctionTypes>(step: T): FunctionTypes[T][] => {
        return addons
            .filter((a) => a.steps[step])
            .map((a) => a.steps[step]);
    }
}