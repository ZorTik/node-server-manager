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
        for (const method of ['get', 'post', 'put', 'delete']) {
            if (handler[method]) {
                // Register handler to express
                router[method](handler.url, handler[method]);
            }
        }
    }
    context.router.use(`/${ver}`, router);
}

export default async function (context: AppContext) {
    await loadApi('v1', context, v1Routes); // v1
}