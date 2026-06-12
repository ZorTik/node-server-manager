import { AppContext } from "@nsm/app";
import { RouterHandler } from "@nsm/router";
import { checkServiceExists } from "@nsm/router/util/preconditions";

export default async function (ctx: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/:id/sessions",
    routes: {
      get: async (req, res) => {
        const id = req.params.id;

        const pageIndex = req.query.pageIndex ? Number(req.query.pageIndex) : 0;
        const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 10;

        if (!(await checkServiceExists(id, ctx.manager, res))) {
          return;
        }

        res.status(200).json({
          sessions: await ctx.sessionManager
            .listSessions({
              filter: {
                serviceId: id,
              },
              sort: {
                by: "startedAt",
                direction: "desc",
              },
              page: {
                index: pageIndex,
                size: pageSize,
              },
            })
            .then((sessions) => sessions.map((session) => session.id))
        });
      },
    },
  };
}
