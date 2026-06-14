import { AppContext } from "@nsm/app";
import { RouterHandler } from "../../index";

export default async function ({
  runner,
  facade
}: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/:id",
    routes: {
      get: async (req, res) => {
        const id = req.params.id;

        const service = await facade.getServiceInfo(id, { includeSession: true });
        if (!service) {
          res
            .status(404)
            .json({ status: 404, message: "Invalid service ID." })
            .end();
          return;
        }

        const session = service.internalSession;
        let stats: any;
        if (session && session.containerId && req.query.stats === "true") {
          stats = await runner.engine.stat(session.containerId);
        } else {
          stats = null;
        }

        const data: any = {
          id: service.serviceId,
          templateId: service.template,
          state: service.state,
          port: service.port,
          options: service.options,
          env: service.env,
        };
        if (session) {
          data.session = {
            id: service.session.id,
            startedAt: service.session.startedAt.getTime(),
            stats,
          };
        }

        res.json(data).end();
      },
    },
  };
}
