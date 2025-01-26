import {init} from "./app";
import {postInit} from "./cleanup";
import server from "./server";

init(server)
    // Run some cleanup tasks and register handlers
    .then(postInit)
    .catch((e) => {
        console.log(e);
    });
