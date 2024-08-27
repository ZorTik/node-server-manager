import config from "./configuration/appConfig";

// Preload app config here to set needed env variables
// before some modules require them.
config();

import app from "./app";
import server from "./server";
import cleanup from "./cleanup";

app(server).then((ctx) => {
    // Cleanup on start
    cleanup(ctx);
    process.on('SIGINT', () => {
        // Cleanup on exit
        cleanup(ctx, true);
    });
});
