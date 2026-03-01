import {AppContext} from "@nsm/app";
import {RouterHandler} from "../../index";
import {checkServiceExists, checkServicePending} from "@nsm/router/util/preconditions";

export default async function ({manager, logger}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/reboot',
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

                manager.stopService(id)
                  .then(() => {
                      // Service stopped successfully, now wait for it to be unlocked before resuming.

                      manager.whenUnlocked(id, (_, __, err) => {
                          if (err) {
                              logger.error(err);
                          } else {
                              manager.resumeService(id);
                          }
                      });
                  });

                res.status(200).json({
                    status: 200,
                    message: 'Service reboot action successfully registered to be completed in a moment.'
                });
            }
        },
    }
}