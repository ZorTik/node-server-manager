import { getApiLogs } from "@nsm/log";
import { LogsDto, Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";
import { LazySingleCache } from "@nsm/log/cache";

const CACHE = new LazySingleCache<LogsDto>();

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/api',
        routes: {
            get: async (req, res) => {
                if (CACHE.get() != undefined) {
                    return res.status(200).json(CACHE.get());
                }

                const result = await getApiLogs()

                if (result.Status == Result.Failed) {
                    return res.status(500).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }
        
                const data = result.Data;
                const response = {
                    size: data.length,
                    results: data
                } as LogsDto;

                CACHE.set(response, 8_000);
                return res.status(200).json(response);
            }
        },
    }
}