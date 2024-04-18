import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({database, engine}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id',
        routes: {
            get: async (req, res) => {
                const id = req.params.id;
                const service = await database.getPerma(id);
                if (!service) {
                    res.status(404).json({status: 404, message: 'Invalid service ID.'}).end();
                    return;
                }
                const session = await database.getSession(id);
                let stats: any;
                if (session && req.query.stats === 'true') {
                    stats = await engine.engine.stat(session.containerId);
                } else {
                    stats = null;
                }
                const template = engine.getTemplate(service.template);
                // Build that info
                res.json({
                    id: service.serviceId,
                    template: {
                        id: service.template,
                        ...template
                    },
                    port: service.port,
                    options: service.options,
                    env: service.env,
                    ...(session ? {
                        session: {
                            ...session,
                            ...stats,
                        }
                    } : {})
                }).end();
            },
        },
    }
}