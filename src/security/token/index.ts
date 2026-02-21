import {AppContext} from "../../app";
import crypto from "crypto";

export default async function ({database, router, logger}: AppContext) {
    const token_new = crypto.randomBytes(30).toString('hex');
    const token = process.env.NSM_TOKEN ?? await database.getMetaVal('auth:basic_token', token_new);
    router.use((req, res, next) => {
        if (!req.header('Authorization') || req.header('Authorization') != token) {
            res.status(401).json({ status: 401, message: 'Unauthorized. Invalid \'Authorization\' header.' });
            return;
        }
        next();
    });
    if (token == token_new) {
        setTimeout(() => {
            logger.info('==============================================');
            logger.info('Your Authorization token has been generated');
            logger.info('since you enabled \'auth_token\' authorization');
            logger.info('for the first time. Please copy it and keep safe.');
            logger.info('You will need to use it while requesting NSM.');
            logger.info('');
            logger.info('Token: ' + token);
            logger.info('==============================================');
        }, 500);
    }
    if (process.env.NSM_TOKEN) {
        logger.info('Authorization token loaded from env');
    }
}