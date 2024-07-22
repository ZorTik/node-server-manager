import app from "./app";
import server from "./server";
import cleanup from "./cleanup";

// Start the server
app(server).then((ctx) => {
    // Catch signals
    process.on('SIGINT', () => {
        // Cleanup resources
        cleanup(ctx);
    });
});
