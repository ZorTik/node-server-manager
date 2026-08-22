import { getApiLogContent } from "@nsm/log";
import { LazyCache } from "@nsm/log/cache";
import { Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";
import { sendPlainText } from "@nsm/router/util/http";

const CACHE = new LazyCache<string>();

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/api/:logName',
        routes: {
            get: async (req, res) => {
                const { logName } = req.params;
                if (CACHE.get(logName) != undefined) {
                    return sendPlainText(res, CACHE.get(logName));
                }
                const result = await getApiLogContent(logName);
        
                if (result.Status == Result.Failed) {
                    return res.status(404).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }

                const data = result.Data;
                CACHE.set(logName, data, 10_000)
                return sendPlainText(res, data);
            }
        },
    }
}