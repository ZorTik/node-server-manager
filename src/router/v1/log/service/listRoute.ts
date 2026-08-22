import { getServiceLogs } from "@nsm/log";
import { LazyCache } from "@nsm/log/cache";
import { LogsDto, Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";

const CACHE = new LazyCache<LogsDto>();

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/services/:nodeId',
        routes: {
            get: async (req, res) => {
                const { nodeId } = req.params;

                if (CACHE.get(nodeId) != undefined) {
                    return res.status(200).json(CACHE.get(nodeId));
                }

                const result = await getServiceLogs(nodeId)

                if (result.Status == Result.Failed) {
                    return res.status(500).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }
        
                const data = result.Data;
                const response = {
                    size: data.length,
                    results: data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                } as LogsDto;
                CACHE.set(nodeId, response, 8_000);
                return res.status(200).json(response);
            }
        },
    }
}