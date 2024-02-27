import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

/**
 * Status route
 * Status information about the service
 *
 * @param context The app context
 */
export default async function ({engine, appConfig}: AppContext): Promise<RouterHandler> {
    return {
        url: '/status',
        routes: {
            get: async (req, res) => {
                const nodeId = appConfig['node_id'];
                const { runningCount } = await engine.engine.info();
                res.json({
                    nodeId,
                    runningCount
                }).end();
            },
        },
    }
}