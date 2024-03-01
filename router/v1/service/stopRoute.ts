import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({engine}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/stop',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                try {
                    const result = await engine.stopService(id);
                    if (result) {
                        res.status(200).json({status: 200, message: 'Service stopped.'});
                    } else {
                        res.status(404).json({status: 404, message: 'Service not found or unknown error occured.'});
                    }
                } catch (e) {
                    res.status(500).json({status: 500, message: e.message});
                }
            }
        },
    }
}