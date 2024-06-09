import {AppContext, ServiceManager} from "../../../app";
import {RouterHandler} from "../../index";
import ds from "check-disk-space";
import * as os from "os";

async function checkNsmResources(engine: ServiceManager) {
    const stats = await engine.engine.statAll();
    const res = stats.reduce((acc, s) => {
        acc.memory.used += s.memory.used;
        acc.memory.total += s.memory.total;
        acc.cpu.used += s.cpu.used;
        acc.cpu.total += s.cpu.total;
        return acc;
    }, {
        memory: {
            used: 0,
            total: 0,
            percent: 0,
        },
        cpu: {
            used: 0,
            total: 0,
            percent: 0,
        }
    });
    res.memory.percent = res.memory.used / res.memory.total;
    res.cpu.percent = res.cpu.used / res.cpu.total;
    return res;
}

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
                    ...(req.query.stats === 'true' ? { stats: checkNsmResources(engine) } : {})
                }).end();
            },
        },
    }
}