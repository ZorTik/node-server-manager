import { AppContext } from "@nsm/app";
import { RouterHandler } from "../../index";
import {KnownError, ServiceNotRunningError} from "@nsm/engine/error";

export default async function ({
  runner,
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

        let promise: Promise<void>;
        try {
          const task = await runner.stopService(id, isForce);
          promise = task.promise;
        } catch (e) {
          if (e instanceof ServiceNotRunningError) {
            // not running, just start it
            promise = Promise.resolve();
          } else {
            throw e;
          }
        }
        promise.then(async () => {
          try {
            const task = await runner.resumeService(id);

            await task.promise;
          } catch (e) {
            // just log
            if (e instanceof KnownError) {
              console.error("Error while resuming service after reboot ", e.message);
            } else {
              console.error("Error while resuming service after reboot", e);
            }
          }
        });

        res.status(200).json({
          status: 200,
          message: "Service reboot action scheduled.",
        });
      },
    },
  };
}
