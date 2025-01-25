import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({manager, database}: AppContext): Promise<RouterHandler> {
    return {
        url: '/servicelist',
        routes: {
            post: async (req, res) => {
                const page = req.body.page ?? 0;
                const pageSize = req.body.pageSize ?? 10;
                if (typeof page !== 'number' || typeof pageSize !== 'number' || page < 0 || pageSize < 1) {
                    res.status(400).json({status: 400, message: 'Invalid page or pageSize.'}).end();
                    return;
                }
                res.status(200).json({
                    services: await manager.listServices(page, pageSize),
                    meta: {
                        page,
                        pageSize,
                        total: await database.count(manager.nodeId),
                    }
                }).end();
            }
        },
    }
}