import {AppContext} from "@nsm/app";
import {RouterHandler} from "../../index";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id',
        routes: {
            get: async (req, res) => {
                const id = req.params.id;
                const service = await manager.getService(id, { includeSession: true });
                if (!service) {
                    res.status(404).json({status: 404, message: 'Invalid service ID.'}).end();
                    return;
                }
                const session = service.internalSession;
                let stats: any;
                if (session && req.query.stats === 'true') {
                    stats = await manager.engine.stat(session.containerId);
                } else {
                    stats = null;
                }
                // Build that info
                res.json({
                    id: service.serviceId,
                    templateId: service.template,
                    state: service.state,
                    port: service.port,
                    options: service.options,
                    env: service.env,
                    ...(session ? {
                        session: {
                            id: service.session.id,
                            ...session,
                            stats,
                        }
                    } : {})
                }).end();
            },
        },
    }
}