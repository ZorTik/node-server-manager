import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/reboot',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                try {
                    if (await manager.stopService(id) && await manager.resumeService(id)) {
                        res.status(200).json({status: 200, message: 'Service reboot action successfully registered to be completed in a moment.'});
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