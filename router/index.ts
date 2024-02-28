import {AppContext} from "../app";
import {json, RequestHandler, Router} from "express";
import v1Routes from "./v1";

export type RouterHandler = {
    url: string;
    routes: {[method: string]: RequestHandler};
};

type RouterInit = (context: AppContext) => Promise<RouterHandler>;

// Load API by version
async function loadApi(ver: string, context: AppContext, routes: RouterInit[]) {
    const router = Router();
    router.use(json());
    for (let init of routes) {
        // Create handler with changed router to the sub-router that will be
        // used specifically for this API version
        const handler = await init({ ...context, router });
        let reg = false;
        for (const method of ['get', 'post', 'put', 'delete']) {
            if (handler.routes[method]) {
                // Register handler to express
                router[method](handler.url, handler.routes[method]);
                reg = true;
            }
        }
        if (reg) {
            context.logger.info(`-- ${handler.url}`);
        }
    }
    context.router.use(`/${ver}`, router);
    context.logger.info(`Loaded API version ${ver}`);
}

export default async function (context: AppContext) {
    context.logger.info('Routes');
    await loadApi('v1', context, v1Routes); // v1
}