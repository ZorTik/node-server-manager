
import {RouterHandler} from "../../index";
import {AppContext} from "../../../app";
import {Options} from "../../../engine";

function isRequiredOption(value: any) {
    if (typeof value == "string" && value === "") {
        return true;
    }
    if (typeof value === "number" && value == -1) {
        return true;
    }
    // TODO: More required value types
    return false;
}

export default async function ({engine}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/create',
        routes: {
            /*
            {
                "template": string,
                "env": map
            }
             */
            post: async (req, res) => {
                const beginTime = Date.now();
                const body = req.body;
                if (!body || !body.template) {
                    res.status(400).json({status: 400, message: 'Missing body or template key.'}).end();
                    return;
                }
                const template = engine.getTemplate(body.template);
                if (!template) {
                    res.status(400).json({status: 400, message: 'Invalid template ID.'}).end();
                    return;
                }
                const env = req.body.env ?? {};
                // Load optional env (template options)
                for (const key of template.settings.env) {
                    if (env[key] && typeof env[key] == typeof template.settings.env[key]) {
                        // Keep the value
                        continue;
                    } else if (env[key]) {
                        res.status(400)
                            .json({status: 400, message: 'Invalid option type for ' + key + '. Got ' + typeof env[key] + ' but expected ' + typeof template.settings.env[key] + '.'})
                            .end();
                        return;
                    } else if (isRequiredOption(template.settings.env[key])) {
                        res.status(400)
                            .json({status: 400, message: 'Missing required option ' + key})
                            .end();
                        return;
                    } else {
                        // Set default
                        env[key] = template.settings.env[key];
                    }
                }
                // Create the service
                const options: Options = {};
                for (const key of Object.keys(options)) {
                    if (!body[key]) {
                        continue;
                    }
                    options[key] = body[key];
                }
                const serviceId = await engine.createService(template.id, options);
                res.status(200).json({status: 200, serviceId, time: Date.now() - beginTime}).end();
            }
        },
    }
}