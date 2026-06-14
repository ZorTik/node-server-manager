import { AppContext } from "@nsm/app";
import { RouterHandler } from "../../index";

export default async function ({
  facade,
}: AppContext): Promise<RouterHandler> {
  return {
    url: "/service/:id/delete",
    routes: {
      post: async (req, res) => {
        const id = req.params.id;
        if (!id) {
          res
            .status(400)
            .json({
              status: 400,
              message: "Required 'id' field not present in the body.",
            });
          return;
        }

        await facade.deleteService(id);

        res.status(200).json({ status: 200, message: "Service deleted." });
      },
    },
  };
}
