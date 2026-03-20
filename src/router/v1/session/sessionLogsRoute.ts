import {AppContext} from "@nsm/app";
import {RouterHandler} from "@nsm/router";
import {ListRecordsArgs} from "@nsm/database";

export default async function(ctx: AppContext): Promise<RouterHandler> {
  return {
    url: '/session/:id/logs',
    routes: {
      get: async (req, res) => {
        const id = req.params.id;

        const pageIndex = req.query.pageIndex ? Number(req.query.pageIndex) : 0;
        const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 10;

        // Use pagination only if it was requested by params
        const page = req.query.pageIndex || req.query.pageSize
          ? (
            {
              index: pageIndex,
              size: pageSize
            }
          )
          : undefined;

        const args: ListRecordsArgs = {
          filter: {
            sessionId: id
          },
          sort: {
            by: "timestamp",
            direction: "asc"
          },
          page
        };
        const logs = await ctx.sessionManager.listSessionLogs(args);

        res.status(200).json({ logs });
      }
    }
  }
}