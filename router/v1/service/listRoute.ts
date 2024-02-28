import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function ({engine}: AppContext): Promise<RouterHandler> {
    return {
        url: '/servicelist',
        routes: {
            get: async (req, res) => {
                res.status(200).json(await engine.listServices()).end();
            }
        },
    }
}