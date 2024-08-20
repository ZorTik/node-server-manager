import winston from "winston";
import {AppContext} from "./app";
import * as fs from "fs";
import npm from "npm";
import * as http from "http";
import {isDebug} from "./helpers";

type FunctionTypes = {
    'BEFORE_CONFIG': (ctx: { logger: winston.Logger }) => Promise<void>;
    'BEFORE_DB': (ctx: { logger: winston.Logger, appConfig: any }) => Promise<void>;
    'BEFORE_ENGINE': (ctx: AppContext) => Promise<void>;
    'BEFORE_SECURITY': (ctx: AppContext) => Promise<void>;
    'BEFORE_ROUTES': (ctx: AppContext) => Promise<void>;
    'BEFORE_SERVER': (ctx: AppContext) => Promise<void>;
    'BOOT': (ctx: AppContext, srv: http.Server) => Promise<void>;
    'EXIT': (ctx: AppContext) => Promise<void>;
}

export type Moment = keyof FunctionTypes;
export type AddonSteps = {
    [key in Moment]: FunctionTypes[key];
};
export type Addon = {
    name: string,
    author?: string,
    version?: string,
    disabled?: boolean,
    steps: AddonSteps,
}

async function initNpm() {
    await npm.load();
    npm.config.set('save', false);
    npm.config.set('save-dev', false);
}

// Installs dependencies written in libraries.txt
async function installLibs(logger: winston.Logger, libs: { [key: string]: string }) {
    const libsArray = Object.keys(libs).map((key) => key + '@' + libs[key]);
    logger.info(`Installing ${libsArray.join(', ')}`);
    await new Promise((resolve, reject) => {
        npm.commands.install(libsArray, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

// Load addons
export default async function (logger: winston.Logger) {
    const addons: Addon[] = [];
    // Load NPM client
    await initNpm();
    // Loop addon dirs
    for (const dir of (
        // Directories array
        fs.readdirSync(__dirname + '/addons')
            .map((dir) => __dirname + '/addons/' + dir)
            .filter((file) => fs.existsSync(file + '/index.js'))
    )) {
        if (dir.endsWith('example_addon')) {
            // Skip default example addon
            continue;
        }
        logger.info(`Loading addon from ${dir}`);
        if (fs.existsSync(dir + '/libraries.txt')) {
            await installLibs(logger, (
                // Libraries mapped
                fs.readFileSync(dir + '/libraries.txt', 'utf8')
                    .split('\n')
                    .filter((lib) => lib.includes("="))
                    .map((lib) => lib.split('='))
                    .reduce((acc, [name, version]) => {
                        acc[name] = version.replace('\r', '');
                        return acc;
                    }, {} as { [key: string]: string })
            ));
        }

        const addon = require(dir + '/index.js').default as Addon;
        if (!addon.disabled) {
            addons.push(addon);

            const { name, author, version } = addon;

            logger.info(`Loaded addon ${name}${author ? ` by ${author}` : ``}${version ? ` (v${version})` : ``}`);
        }
    }
    return <T extends keyof FunctionTypes>(step: T, ...args: any[]) => {
        if (isDebug()) {
            logger.info(`Running step ${step}`);
        }
        addons
            .filter((addon) => addon.steps[step])
            .map((addon) => addon.steps[step])
            .forEach(f => f.apply(f, args));
    }
}