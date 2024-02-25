import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

export default async function (context: AppContext): Promise<RouterHandler> {
    // TODO: Init middleware
    return {
        url: '/status',
        routes: {
            get: async (req, res) => {
                // TODO
            },
        },
    }
}