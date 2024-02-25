import {AppContext} from "../../../app";
import {RouterHandler} from "../../index";

/**
 * Status route
 * Status information about the service
 *
 * @param context The app context
 */
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