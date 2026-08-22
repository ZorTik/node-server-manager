import { getApiLogContent } from "@nsm/log";
import { LazyCache } from "@nsm/log/cache";
import { Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";
import { sendPlainText } from "@nsm/router/util/preconditions";

const CACHE = new LazyCache<string>();

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/api/:logId',
        routes: {
            get: async (req, res) => {
                const { logId } = req.params;
                if (CACHE.get(logId) != undefined) {
                    return sendPlainText(res, CACHE.get(logId));
                }
                const result = await getApiLogContent(logId);
        
                if (result.Status == Result.Failed) {
                    return res.status(404).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }

                const data = result.Data;
                CACHE.set(logId, data, 10_000)
                return sendPlainText(res, data);
            }
        },
    }
}