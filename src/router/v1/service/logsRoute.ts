import { AppContext } from "@nsm/app";
import { RouterHandler } from "@nsm/router";
import { ListRecordsArgs } from "@nsm/database";
import { checkServiceExists } from "@nsm/router/util/preconditions";

export default async function (ctx: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/:id/logs",
    routes: {
      get: async (req, res) => {
        const id = req.params.id;
        if (!id) {
          res
            .status(400)
            .json({
              status: 400,
              message: "Required 'id' field not present in the body.",
            });
          return;
        }
        if (!(await checkServiceExists(id, ctx.manager, res))) {
          return;
        }

        let sessionId: string;

        const runningService = ctx.manager.getRunningService(id);
        if (runningService) {
          // Service currently running, we can use logs from the current session
          sessionId = runningService.session.id;
        } else {
          // Service not running, so we need to retrieve last session ID
          const lastSession = await ctx.sessionManager.listSessions({
            filter: { serviceId: id },
            sort: { by: "startedAt", direction: "desc" },
            page: { index: 0, size: 1 },
          });
          if (lastSession && lastSession.length > 0) {
            sessionId = lastSession[0].id;
          }
        }

        if (!sessionId) {
          res
            .status(400)
            .json({ status: 400, message: "Service was never active." });
          return;
        }

        const pageIndex = req.query.pageIndex ? Number(req.query.pageIndex) : 0;
        const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 10;

        // Use pagination only if it was requested by params
        const page =
          req.query.pageIndex || req.query.pageSize
            ? {
                index: pageIndex,
                size: pageSize,
              }
            : undefined;

        const args: ListRecordsArgs = {
          filter: {
            sessionId,
          },
          sort: {
            by: "timestamp",
            direction: "asc",
          },
          page,
        };
        const logs = await ctx.sessionManager.listSessionLogs(args);

        res.status(200).json({ logs });
      },
    },
  };
}
