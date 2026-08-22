import { getNodeLogContent } from "@nsm/log";
import { LazyCache } from "@nsm/log/cache";
import { Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";
import { sendPlainText } from "@nsm/router/util/preconditions";

const CACHE = new LazyCache<string>();

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/services/:nodeId/:logId',
        routes: {
            get: async (req, res) => {
                const { nodeId, logId } = req.params;
                const token = nodeId + ':' + logId
                if (CACHE.get(token) != undefined) {
                    return sendPlainText(res, CACHE.get(token));
                }
                
                const result = await getNodeLogContent(nodeId, logId);
                if (result.Status == Result.Failed) {
                    return res.status(404).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }

                const data = result.Data;
                CACHE.set(token, data, 10_000);
                return sendPlainText(res, data);
            }
        },
    }
}