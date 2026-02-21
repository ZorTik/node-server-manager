import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {handleErr} from "@nsm/util/routes";
import {isServicePending} from "@nsm/engine/asyncp";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/stop',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                if (isServicePending(id)) {
                    res.status(500).json({status: 409, message: 'Service is pending another action.'});
                    return;
                }
                if (!await manager.getService(id)) {
                    res.status(404).json({status: 404, message: 'Service not found.'});
                    return;
                }
                try {
                    const result = req.query.force === 'true'
                        ? await manager.stopServiceForcibly(id)
                        : await manager.stopService(id);
                    if (result) {
                        res.status(200).json({status: 200, message: 'Service stopped.'});
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