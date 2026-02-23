import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {handleErr} from "@nsm/util/routes";
import {checkServicePending} from "@nsm/router/util/preconditions";

export default async function ({manager, logger}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/resume',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                try {
                    if (!await manager.getService(id)) {
                        res.status(404).json({
                            status: 404,
                            message: 'Service not found.'
                        });
                        return;
                    }
                    if (!checkServicePending(id, res)) {
                        return;
                    }

                    manager.resumeService(id)
                      .then(() => {
                          // Service resumed successfully, do nothing here for now.
                      })
                      .catch((e: Error) => {
                          logger.error(e);
                      });

                    res.status(200).json({
                        status: 200,
                        message: 'Service resume action successfully registered to be completed in a moment.',
                        statusPath: '/v1/service/' + id + '/powerstatus',
                    });
                } catch (e) {
                    handleErr(e, res);
                }
            }
        },
    }
}