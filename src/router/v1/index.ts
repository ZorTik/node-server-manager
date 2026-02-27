import statusRoute from "./status";
import lookupRoute from "./service/lookupRoute";
import deleteRoute from "./service/deleteRoute";
import listRoute from "./service/listRoute";
import resumeRoute from "./service/resumeRoute";
import stopRoute from "./service/stopRoute";
import createRoute from "./service/createRoute";
import rebootRoute from "./service/rebootRoute";
import powerStatusRoute from "./service/powerStatusRoute";
import stopCmdRoute from "@nsm/router/v1/service/stopCmdRoute";
import optionsRoute from "@nsm/router/v1/service/optionsRoute";

export default [
    // v1 routes
    statusRoute,
    createRoute,
    lookupRoute,
    deleteRoute,
    resumeRoute,
    rebootRoute,
    stopCmdRoute,
    stopRoute,
    powerStatusRoute,
    optionsRoute,
    listRoute,
]