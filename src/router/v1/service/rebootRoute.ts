import { AppContext } from "@nsm/app";
import { RouterHandler } from "../../index";
import {
  checkServiceExists,
  checkServicePending,
} from "@nsm/router/util/preconditions";
import { consumeEnginePowerAction } from "@nsm/helpers";

export default async function ({
  manager,
}: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/:id/reboot",
    routes: {
      post: async (req, res) => {
        const id = req.params.id;
        const isForce = req.query.force === "true";
        if (!id) {
          res
            .status(400)
            .json({
              status: 400,
              message: "Required 'id' field not present in the body.",
            });
          return;
        }
        if (!(await checkServiceExists(id, manager, res))) {
          return;
        }
        if (!checkServicePending(id, res)) {
          return;
        }

        consumeEnginePowerAction(() =>
          manager.stopService(id, isForce)
            // continue after service is stopped
            .then(() => manager.waitForStopped(id))
            // resume
            .then(() => manager.resumeService(id)),
        );

        res.status(200).json({
          status: 200,
          message:
            "Service reboot action successfully registered to be completed in a moment.",
        });
      },
    },
  };
}
