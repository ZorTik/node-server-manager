import {AppContext} from "@nsm/app";
import {RouterHandler} from "../../index";
import {checkServiceExists, checkServicePending} from "@nsm/router/util/preconditions";
import {consumeEnginePowerAction} from "@nsm/helpers";

export default async function ({manager, logger}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/stop',
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
                if (!checkServicePending(id, res)) {
                    return;
                }
                if (!manager.isRunning(id)) {
                    res.status(409).json({status: 400, message: 'Service is not running.'});
                    return;
                }

                consumeEnginePowerAction(async () => {
                    if (req.query.force === 'true') {
                        await manager.stopServiceForcibly(id);
                    } else {
                        await manager.stopService(id)
                    }
                });

                res.status(200).json({
                    status: 200,
                    message: 'Service stop action successfully registered to be completed in a moment.',
                    statusPath: '/v1/service/' + id + '/powerstatus',
                });
            }
        },
    }
}