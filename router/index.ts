import {AppContext, currentContext} from "../app";
import {json, RequestHandler, Router} from "express";
import v1Routes from "./v1";
import {measureEventLoop} from "@nsm/profiler";

export type RouterHandler = {
    url: string;
    routes: {[method: string]: RequestHandler};
};

type RouterInit = (context: AppContext) => Promise<RouterHandler>;

// Load API by version
async function loadApi(ver: string, context: AppContext, routes: RouterInit[]) {
    context.logger.info(`API ${ver} routes`);
    const router = Router();
    router.use(json());
    if (currentContext.debug) {
        router.use((req, res, next) => {
            if (req.body) {
                currentContext.logger.debug(`Body: ${JSON.stringify(req.body)}`);
            } else {
                currentContext.logger.debug('No body');
            }
            next();
        });
        router.use((_, __, next) => {
            measureEventLoop();
            next();
        });
    }
    for (let init of routes) {
        // Create handler with changed router to the sub-router that will be
        // used specifically for this API version
        const handler = await init({ ...context, router });
        let reg = false;
        for (const method of ['get', 'post', 'put', 'delete']) {
            if (handler.routes[method]) {
                // Register handler to express
                router[method](handler.url, (req, res, next) => {
                    context.logger.info(`${method.toUpperCase()} ${req.url}`);
                    next();
                }, handler.routes[method]);
                reg = true;
            }
        }
        if (reg) {
            context.logger.info(`-- ${handler.url}`);
        }
    }
    context.router.use(`/${ver}`, router);
}

export default async function (context: AppContext) {
    await loadApi('v1', context, v1Routes); // v1
}