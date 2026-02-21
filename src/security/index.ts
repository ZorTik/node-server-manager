import {AppContext} from "../app";
import token from './token';

export default async function (ctx: AppContext) {
    // This code block is initialized before app routes.
    if (ctx.appConfig['auth'] == 'auth_token') {
        // Basic credentials auth type
        await token(ctx);
    }
    ctx.logger.info('Using ' + ctx.appConfig['auth'] + ' auth.');
}