import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {handleErr} from "../../../util/routes";

export default async function ({engine}: AppContext): Promise<RouterHandler> {
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
                    const result = await engine.resumeService(id);
                    if (result) {
                        res.status(200).json({
                            status: 200,
                            message: 'Service resume action successfully registered to be completed in a moment.',
                            statusPath: '/v1/service/' + id + '/powerstatus',
                        });
                    } else {
                        res.status(404).json({
                            status: 404,
                            message: 'Service not found or unknown error occured.'
                        });
                    }
                } catch (e) {
                    handleErr(e, res);
                }
            }
        },
    }
}