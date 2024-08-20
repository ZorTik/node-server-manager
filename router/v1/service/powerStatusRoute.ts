import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";
import {isServicePending} from "../../../engine/asyncp";

export default async function ({manager}: AppContext): Promise<RouterHandler> {
    return {
        url: '/service/:id/powerstatus',
        routes: {
            get: async (req, res) => {
                const id = req.params.id;
                if (!id) {
                    res.status(400).json({status: 400, message: 'Required \'id\' field not present in the body.'});
                    return;
                }
                let status = 'IDLE';
                let error = undefined;
                if (isServicePending(id)) {
                    status = 'PENDING';
                } else {
                    const err = manager.getLastPowerError(id);
                    if (err) {
                        status = 'ERROR';
                        error = err;
                    }
                }
                res.status(200).json({ id, status, error }).end();
            }
        },
    }
}