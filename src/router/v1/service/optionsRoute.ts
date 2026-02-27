import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/options',
        routes: {
            post: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                const options = req.body;
                if (!options) {
                    res.status(400).json({status: 400, message: 'Body is required.'});
                    return;
                }
                if (Object.keys(options).includes('port') || Object.keys(options).includes('ports')) {
                    res.status(400).json({status: 400, message: 'Port(s) cannot be changed yet.'});
                    return;
                }
                if (await manager.updateOptions(id, options)) {
                    res.status(200).json({status: 200, message: 'Service options updated.'});
                } else {
                    res.status(404).json({status: 404, message: 'Service not found or unknown error occured.'});
                }
            }
        },
    }
}