import {AppContext} from "@nsm/app";
import {RouterHandler} from "../../index";
import {handleErr} from "@nsm/util/routes";
import {checkServiceExists} from "@nsm/router/util/preconditions";

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
                if (!await checkServiceExists(id, manager, res)) {
                    return;
                }
                try {
                    await manager.deleteService(id);

                    res.status(200).json({status: 200, message: 'Service deleted.'});
                } catch (e) {
                    handleErr(e, res);
                }
            }
        },
    }
}