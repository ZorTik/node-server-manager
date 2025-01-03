import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {handleErr} from "@nsm/util/routes";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/delete',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                try {
                    const result = await manager.deleteService(id);
                    if (result) {
                        res.status(200).json({status: 200, message: 'Service deleted.'});
                    } else {
                        res.status(404).json({status: 404, message: 'Service not found or unknown error occured.'});
                    }
                } catch (e) {
                    handleErr(e, res);
                }
            }
        },
    }
}