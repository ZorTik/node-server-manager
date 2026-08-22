import { getApiLogs } from "@nsm/log";
import { Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/api',
        routes: {
            get: async (req, res) => {
                const result = await getApiLogs()

                if (result.Status == Result.Failed) {
                    return res.status(500).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }
        
                const data = result.Data;
                return res.status(200).json({
                    size: data.length,
                    results: data
                });
            }
        },
    }
}