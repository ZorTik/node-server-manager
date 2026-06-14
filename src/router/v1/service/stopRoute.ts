import { AppContext } from "@nsm/app";
import { RouterHandler } from "../../index";

export default async function ({
  runner
}: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/:id/stop",
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

        await runner.stopService(id, isForce);

        res.status(200).json({
          status: 200,
          message: "Service stop called.",
          statusPath: "/v1/service/" + id + "/powerstatus",
        });
      },
    },
  };
}
