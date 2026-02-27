import {init} from "@nsm/app";
import {postInit} from "@nsm/cleanup";
import server from "@nsm/server";

init(server)
    // Run some cleanup tasks and register handlers
    .then(postInit)
    .catch((e) => {
        console.log(e);
    });
