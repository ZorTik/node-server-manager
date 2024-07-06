
import {RouterHandler} from "../../index";
import {AppContext} from "../../../app";
import {Options} from "../../../engine";

// Defines if the value inside template settings.yml env represents required option.
function isRequiredOption(value: any) {
    if (typeof value == "string" && value === "") {
        return true;
    }
    if (typeof value === "number" && value == -1) {
        return true;
    }
    return false;
}

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/create',
        routes: {
            post: async (req, res) => {
                const beginTime = Date.now();
                const body = req.body;
                if (!body || (!manager.noTemplateMode() && !body.template)) {
                    res.status(400).json({status: 400, message: 'Missing body or template key.'}).end();
                    return;
                }
                const template = manager.getTemplate(body.template);
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
                    } else if (isRequiredOption(template.settings['env'][key])) {
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
                const options: Options = {};
                for (const key of Object.keys(body)) {
                    options[key] = body[key];
                }
                options.env = env;
                // Create the service
                try {
                    const serviceId = await manager.createService(template.id, options);
                    res.status(200).json({
                        status: 200,
                        message: 'Service create action successfully registered to be completed in a moment.',
                        serviceId,
                        statusPath: '/v1/service/' + serviceId + '/powerstatus',
                        time: Date.now() - beginTime
                    }).end();
                } catch (e) {
                    res.status(500).json({status: 500, message: e.message}).end();
                }
            }
        },
    }
}