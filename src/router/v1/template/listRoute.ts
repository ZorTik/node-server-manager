import {AppContext} from "@nsm/app";
import {RouterHandler} from "@nsm/router";

export default async function (ctx: AppContext): Promise<RouterHandler> {
  return {
    url: "/templates",
    routes: {
      get: async (req, res) => {
        const templates = await ctx.templateManager.getAllTemplates();

        res.json(templates);
      },
    },
  };
}
