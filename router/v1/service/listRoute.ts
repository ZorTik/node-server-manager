import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {ListServicesOptions} from "@nsm/engine";
import z from "zod";

export default async function ({manager, database}: AppContext): Promise<RouterHandler> {
    return {
        url: '/servicelist',
        routes: {
            post: async (req, res) => {
                const page = req.body.page ?? 0;
                const pageSize = req.body.pageSize ?? 10;
                const meta = req.body.meta;
                if (typeof page !== 'number' || typeof pageSize !== 'number' || page < 0 || pageSize < 1) {
                    res.status(400).json({status: 400, message: 'Invalid page or pageSize.'}).end();
                    return;
                }

                // Options for the query
                const listOptions: ListServicesOptions = {
                    page,
                    pageSize,
                };

                const metaParse = z
                    .object({})
                    // Pass unrecognized keys
                    .passthrough()
                    // Meta filter is not required in req body
                    .optional()
                    .refine((data) => {
                        // Allow only primitives (no nested objects)
                        return Object.keys(data).every((key) => (typeof data[key]) !== "object")
                    }, {
                        message: "Meta should contain only primitives."
                    })
                    .safeParse(meta);
                if (metaParse.success) {
                    listOptions.filter = { meta: metaParse.data };
                } else {
                    res.status(400)
                        .json({status: 400, message: 'Invalid meta filter format.', error: metaParse.error})
                        .end();
                    return;
                }

                // Response body
                const data = {
                    services: await manager.listServices(listOptions),
                    meta: {
                        ...listOptions,
                        // Total num of services on this node
                        total: await database.count(manager.nodeId),
                    }
                };
                res.status(200).json(data).end();
            }
        },
    }
}