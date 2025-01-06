import boot, {AppBootContext, AppBootOptions} from "@nsm/app";
import {beforeAll, describe} from "@jest/globals";
import server from "@nsm/server";

export const describeWithBoot = (name: string, fn: (ctxRef: { ctx?: AppBootContext }) => void) => {
    describe(name, () => {
        let ctxRef: { ctx?: AppBootContext } = {};

        beforeAll((done) => {
            const options: AppBootOptions = {
                test: true,
                disableWorkers: true,
            };
            boot(server, options).then((ctx_) => {
                ctxRef.ctx = ctx_;
                done();
            }).catch(err => {
                console.log(err);
            });
        }, 20000);

        fn(ctxRef);
    });
};