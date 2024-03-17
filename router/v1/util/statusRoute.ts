import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import ds from "check-disk-space";
import * as os from "os";

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
                const runningContainers = await engine.engine.listContainers(await engine.listTemplates());
                const sessions = await database.listSessions(engine.nodeId);
                const all = await database.count(nodeId);
                const {free, size} = await ds(engine.volumesDir);
                const system = {
                    totalmem: os.totalmem(),
                    freemem: os.freemem(),
                    totaldisk: size,
                    freedisk: free,
                }
                res.json({
                    nodeId,
                    running: sessions
                        .filter(s => runningContainers.includes(s.containerId))
                        .map(s => s.serviceId),
                    all,
                    system,
                }).end();
            },
        },
    }
}