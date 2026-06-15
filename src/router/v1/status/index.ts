import { AppContext } from "@nsm/app";
import { RouterHandler } from "../../index";
import * as os from "os";
import {Filters, ServiceEngine, ServiceManager} from "@nsm/engine";
import { Database } from "@nsm/persistence";
import {parseResourceOptionsSet} from "@nsm/util/services";

async function checkNsmResources(
  nodeId: string,
  manager: ServiceManager,
  engine: ServiceEngine,
  db: Database
) {
  const stats = await engine.statAll(Filters.node(nodeId));
  const servicesGlobal = await db.permaRepository.listPerma(nodeId);
  const res = stats.reduce(
    (acc, s) => {
      acc.memory.used += s.memory.used;
      acc.memory.total += s.memory.total;
      acc.cpu.used += s.cpu.used;
      acc.cpu.total += s.cpu.total;
      return acc;
    },
    {
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
      services: {
        // TODO: Ukazuje stále 0???
        memTotal: BigInt(0),
        cpuTotal: BigInt(0),
        diskTotal: BigInt(0),
      },
    },
  );
  for (const s of servicesGlobal) {
    const service = await manager.getService(s);
    const resourceOptions = parseResourceOptionsSet(service);

    res.services.memTotal += BigInt(resourceOptions.ram);
    res.services.cpuTotal += BigInt(resourceOptions.cpu);
    res.services.diskTotal += BigInt(resourceOptions.disk);
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
export default async function ({
  manager,
  runner,
  appConfig,
  database,
}: AppContext): Promise<RouterHandler> {
  return {
    url: "/status",
    routes: {
      get: async (req, res) => {
        const nodeId = appConfig.getNodeId();
        const all = await database.permaRepository.listPerma(nodeId);
        const [free, size] = await runner.engine.calcHostUsage();
        const system = {
          totalmem: os.totalmem(),
          freemem: os.freemem(),
          totaldisk: size,
          freedisk: free,
        };
        res
          .json({
            nodeId,
            running: runner.getRunningServices().map((s) => s.id),
            all: all.length,
            system,
            ...(req.query.stats === "true"
              ? {
              stats: await checkNsmResources(appConfig.getNodeId(), manager, runner.engine, database)
            }
              : {
            }),
          })
          .end();
      },
    },
  };
}
