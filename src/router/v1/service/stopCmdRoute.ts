import {AppContext} from "@nsm/app";
import {RouterHandler} from "@nsm/router";
import {isServicePending} from "@nsm/engine/asyncp";
import {handleErr} from "@nsm/util/routes";
import {checkServicePending} from "@nsm/router/util/preconditions";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/stopcmd',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                if (!checkServicePending(id, res)) {
                    return;
                }
                if (!await manager.getService(id)) {
                    res.status(404).json({status: 404, message: 'Service not found.'});
                    return;
                }
                try {
                    const result = await manager.sendStopSignal(id);
                    if (result) {
                        res.status(200).json({status: 200, message: 'Service stop signal sent.'});
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