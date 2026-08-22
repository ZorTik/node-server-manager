import { getNodeLogContent } from "@nsm/log";
import { Result } from "@nsm/log/type";
import { RouterHandler } from "@nsm/router";

export default async function (): Promise<RouterHandler> {
    return {
        url: '/logs/services/:nodeId/:logId',
        routes: {
            get: async (req, res) => {
                const { nodeId, logId } = req.params;
                const result = await getNodeLogContent(nodeId, logId);
                
                if (result.Status == Result.Failed) {
                    return res.status(404).end();
                }
                if (result.Status == Result.Empty) {
                    return res.status(204).end();
                }

                const data = result.Data
                res.status(200).type("text/plain; charset=utf-8").send(data);
            }
        },
    }
}