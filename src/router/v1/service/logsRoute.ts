import { AppContext } from "@nsm/app";
import { RouterHandler } from "@nsm/router";
import {ServiceWasNeverActiveError} from "@nsm/engine/error";
import {ServiceLogRecordModel} from "@nsm/persistence";

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

        // Use pagination only if it was requested by params
        const page =
          req.query.pageIndex || req.query.pageSize
            ? {
              index: req.query.pageIndex ? Number(req.query.pageIndex) : 0,
              size: req.query.pageSize ? Number(req.query.pageSize) : 10,
            }
            : undefined;

        let logs: ServiceLogRecordModel[];
        try {
          const session = await ctx.sessionManager.getLastSession(id);
          logs = await ctx.sessionManager.listSessionLogs({
            filter: {
              sessionId: session.id,
            },
            sort: {
              by: "timestamp",
              direction: "asc",
            },
            page,
          });
        } catch (e) {
          if (e instanceof ServiceWasNeverActiveError) {
            logs = [];
          } else {
            throw e;
          }
        }

        res.status(200).json({
          logs
        });
      },
    },
  };
}
