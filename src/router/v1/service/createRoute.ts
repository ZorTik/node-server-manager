
import {RouterHandler} from "../../index";
import {AppContext} from "../../../app";
import {Options} from "@nsm/engine";
import {clock} from "@nsm/util/clock";

// Defines if the value inside template settings.yml env represents required option.
function checkRequired(value: any) {
    return (
        (typeof value == "string" && value === "") ||
        (typeof value === "number" && value == -1)
    )
}

export default async function ({manager}: AppContext): Promise<RouterHandler> {
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
                const env = req.body.env ?? {};
                // Load optional env (template options)
                for (const key of Object.keys(template.settings['env'])) {
                    if (env[key] && typeof env[key] == typeof template.settings['env'][key]) {
                        // Keep the value
                        continue;
                    } else if (env[key]) {
                        res.status(400)
                            .json({status: 400, message: 'Invalid option type for ' + key + '. Got ' + typeof env[key] + ' but expected ' + typeof template.settings['env'][key] + '.'})
                            .end();
                        return;
                    } else if (checkRequired(template.settings['env'][key])) {
                        res.status(400)
                            .json({status: 400, message: 'Missing required option ' + key})
                            .end();
                        return;
                    } else {
                        // Set default
                        env[key] = template.settings['env'][key];
                    }
                }
                // Build options
                const options: Options = req.body;
                options.env = env;
                // Create the service
                try {
                    const serviceId = await manager.createService(template.id, options);

                    // Resume right afterward
                    await manager.resumeService(serviceId);

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