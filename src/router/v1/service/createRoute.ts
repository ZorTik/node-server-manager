
import {RouterHandler} from "../../index";
import {AppContext} from "@nsm/app";
import {Options} from "@nsm/engine";
import {clock} from "@nsm/util/clock";
import {prepareEnvForTemplate} from "@nsm/engine/template";

export default async function ({manager, logger}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/create',
        routes: {
            post: async (req, res) => {
                const clk = clock();
                if (!req.body || (!manager.noTemplateMode() && !req.body.template)) {
                    res.status(400).json({status: 400, message: 'Missing body or template key.'}).end();
                    return;
                }
                const template = manager.getTemplate(req.body.template);
                if (!template) {
                    res.status(400).json({status: 400, message: 'Invalid template ID.'}).end();
                    return;
                }
                let env = req.body.env ?? {};
                try {
                    env = prepareEnvForTemplate(template, env);
                } catch (e) {
                    res.status(400).json({status: 400, message: e.message}).end();
                    return;
                }

                // Build options
                const options: Options = req.body;
                options.env = env;
                // Create the service
                try {
                    const serviceId = await manager.createService(template.id, options);

                    // Resume right afterward
                    manager.resumeService(serviceId)
                      .then(() => {
                          // Service resumed successfully, do nothing here for now.
                      })
                      .catch((e) => {
                          // TODO: more robust logging
                          logger.error(e);
                      });

                    res.status(200).json({
                        status: 200,
                        message: 'Service create action successfully registered to be completed in a moment.',
                        serviceId,
                        statusPath: '/v1/service/' + serviceId + '/powerstatus',
                        time: clk.durFromCreation()
                    }).end();
                } catch (e) {
                    res.status(500).json({status: 500, message: e.message}).end();
                }
            }
        },
    }
}