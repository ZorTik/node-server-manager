import { AppContext } from "../app";
import { json, RequestHandler, Router } from "express";
import v1Routes from "./v1";
import {eventLoopProfiler} from "@nsm/router/middlewares/eventLoopProfiler";
import {debugRequestLogger} from "@nsm/router/middlewares/debugRequestLogger";
import {catchKnownErrors} from "@nsm/router/middlewares/catchKnownErrors";

export type RouterHandler = {
  url: string;
  routes: { [method: string]: RequestHandler|RequestHandler[] };
};

type RouterInit = (context: AppContext) => Promise<RouterHandler>;

// Load API by version
async function api(ver: string, context: AppContext, routes: RouterInit[]) {
  const router = Router();
  router.use(json());
  if (context.debug) {
    router.use(debugRequestLogger({context}));
    // Measure event loop process time if in debug mode
    router.use(eventLoopProfiler());
  }

  for (let init of routes) {
    // Create handler with changed router to the sub-router that will be
    // used specifically for this API version
    const handler = await init({ ...context, router });

    let reg = false;
    for (const method of ["get", "post", "put", "delete"]) {
      const userDefinedRoutes = handler.routes[method];
      if (userDefinedRoutes) {
        const handlers: RequestHandler[] = [];
        if (Array.isArray(userDefinedRoutes)) {
          handlers.push(...userDefinedRoutes);
        } else {
          handlers.push(userDefinedRoutes);
        }

        // Register handler to express
        router[method](handler.url, ...handlers);
        reg = true;
      }
    }

    if (reg) {
      context.logger.debug(`Registered route ${handler.url}`);
    }
  }
  router.use(catchKnownErrors());

  context.router.use(`/${ver}`, router);
}

export default async function (context: AppContext) {
  await api("v1", context, v1Routes); // v1
}
