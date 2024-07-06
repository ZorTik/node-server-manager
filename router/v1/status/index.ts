import {AppContext, Database, ServiceManager} from "../../../app";
import {RouterHandler} from "../../index";
import ds from "check-disk-space";
import * as os from "os";

async function checkNsmResources(engine: ServiceManager, db: Database) {
    const stats = await engine.engine.statAll();
    const servicesGlobal = await db.list(engine.nodeId);
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
        },
        services: { // TODO: Ukazuje stále 0???
            memTotal: BigInt(0),
            cpuTotal: BigInt(0),
            diskTotal: BigInt(0),
        },
    });
    for (const s of servicesGlobal) {
        const service = await engine.getService(s);
        res.services.memTotal += BigInt(service.optionsRam);
        res.services.cpuTotal += BigInt(service.optionsCpu);
        res.services.diskTotal += BigInt(service.optionsDisk);
    }
    if (res.memory.total > 0) {
        res.memory.percent = res.memory.used / res.memory.total;
    }
    if (res.cpu.total > 0) {
        res.cpu.percent = res.cpu.used / res.cpu.total;
    }
    return res;
}

/**
 * Status route
 * Status information about the service
 *
 * @param context The app context
 */
export default async function ({manager, appConfig, database}: AppContext): Promise<RouterHandler> {
    return {
        url: '/status',
        routes: {
            get: async (req, res) => {
                const nodeId = appConfig['node_id'];
                const runningContainers = await manager.engine.listContainers(await manager.listTemplates());
                const sessions = await database.listSessions(manager.nodeId);
                const all = await database.list(nodeId);
                const {free, size} = await ds(manager.volumesDir);
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
                    all: all.length,
                    system,
                    ...(req.query.stats === 'true' ? { stats: await checkNsmResources(manager, database) } : {})
                }).end();
            },
        },
    }
}