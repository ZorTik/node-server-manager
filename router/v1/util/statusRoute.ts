import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

/**
 * Status route
 * Status information about the service
 *
 * @param context The app context
 */
export default async function ({engine, appConfig, database}: AppContext): Promise<RouterHandler> {
    return {
        url: '/status',
        routes: {
            get: async (req, res) => {
                const nodeId = appConfig['node_id'];
                const running = await engine.engine.listContainers(await engine.listTemplates());
                const all = await database.count(nodeId);
                res.json({
                    nodeId,
                    running,
                    all,
                }).end();
            },
        },
    }
}