import { RouterHandler } from "../../index";
import { AppContext } from "@nsm/app";
import { Options } from "@nsm/engine";
import { clock } from "@nsm/util/clock";
import { prepareEnvForTemplate } from "@nsm/engine/template";
import {TemplateNotFoundError} from "@nsm/engine/error";

export default async function ({
  manager,
}: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/create",
    routes: {
      post: async (req, res) => {
        const clk = clock();
        if (!req.body || !req.body.template) {
          res
            .status(400)
            .json({ status: 400, message: "Missing body or template key." })
            .end();
          return;
        }
        const template = manager.getTemplate(req.body.template);
        if (!template) {
          throw new TemplateNotFoundError(req.body.template);
        }

        let env = req.body.env ?? {};
        try {
          env = prepareEnvForTemplate(template, env);
        } catch (e) {
          res.status(400).json({ status: 400, message: e.message }).end();
          return;
        }

        // Build options
        const options: Options = req.body;
        options.env = env;

        const serviceId = await manager.createService(template.id, options);

        await manager.resumeService(serviceId);

        res
          .status(200)
          .json({
            status: 200,
            message: "Service created successfully.",
            serviceId,
            statusPath: "/v1/service/" + serviceId + "/powerstatus",
            time: clk.durFromCreation(),
          })
          .end();
      },
    },
  };
}
