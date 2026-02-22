import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {handleErr} from "@nsm/util/routes";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
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

                    manager.resumeService(id)
                      .then(() => {
                          // Service resumed successfully, do nothing here for now.
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