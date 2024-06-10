import winston from "winston";
import {Database} from "./database";
import {AppContext} from "./app";
import * as fs from "fs";
import npm from "npm";
import * as http from "http";
import {isDebug} from "./helpers";

type FunctionTypes = {
    'BEFORE_CONFIG': (ctx: { logger: winston.Logger }) => Promise<void>;
    'BEFORE_DB': (ctx: { logger: winston.Logger, appConfig: any }) => Promise<void>;
    'BEFORE_ENGINE': (ctx: { logger: winston.Logger, appConfig: any, database: Database }) => Promise<void>;
    'BEFORE_SECURITY': (ctx: AppContext) => Promise<void>;
    'BEFORE_ROUTES': (ctx: AppContext) => Promise<void>;
    'BEFORE_SERVER': (ctx: AppContext) => Promise<void>;
    'AFTER_SERVER': (ctx: AppContext, srv: http.Server) => Promise<void>;
    'EXIT': (ctx: AppContext) => Promise<void>;
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

// Installs dependencies written in libraries.txt
async function installDeps(logger: winston.Logger, libs: { [key: string]: string }) {
    for (const lib in libs) {
        const dep = `${lib}@${libs[lib]}`;
        logger.info(`Installing ${dep}`);
        await new Promise((resolve, reject) => {
            npm.commands.install([dep], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    }
}

// Load addons
export default async function (logger: winston.Logger) {
    const addons: Addon[] = [];
    let npmLoaded = false;
    const dirs = fs.readdirSync(__dirname + '/addons')
        .map((dir) => __dirname + '/addons/' + dir)
        .filter((file) => fs.existsSync(file + '/index.js'));
    for (const dir of dirs) {
        if (dir.endsWith('example_addon')) {
            // Skip default example addon
            continue;
        }
        logger.info(`Loading addon from ${dir}`);
        if (fs.existsSync(dir + '/libraries.txt')) {
            if (!npmLoaded) {
                await npm.load();
                npm.config.set('save', false);
                npm.config.set('save-dev', false);
                npmLoaded = true;
            }
            const libs = fs.readFileSync(dir + '/libraries.txt', 'utf8')
                .split('\n')
                .filter((lib) => lib.includes("="))
                .map((lib) => lib.split('='))
                .reduce((acc, [name, version]) => {
                    acc[name] = version;
                    return acc;
                }, {} as { [key: string]: string });
            await installDeps(logger, libs);
        }

        const file = dir + '/index.js';
        const addon = require(file).default as Addon;
        if (!addon.disabled) {
            addons.push(addon);

            const { name, author, version } = addon;

            logger.info(`Loaded addon ${name}${author ? ` by ${author}` : ``}${version ? ` (v${version})` : ``}`);
        }
    }
    return <T extends keyof FunctionTypes>(step: T): FunctionTypes[T][] => {
        if (isDebug()) {
            logger.info(`Running step ${step}`);
        }
        return addons
            .filter((a) => a.steps[step])
            .map((a) => a.steps[step]);
    }
}