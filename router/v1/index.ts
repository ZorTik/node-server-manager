import statusRoute from "./util/statusRoute";
import lookupRoute from "./service/lookupRoute";
import deleteRoute from "./service/deleteRoute";
import listRoute from "./service/listRoute";
import resumeRoute from "./service/resumeRoute";
import stopRoute from "./service/stopRoute";
import createRoute from "./service/createRoute";
import rebootRoute from "./service/rebootRoute";
import powerStatusRoute from "./service/powerStatusRoute";

export default [
    // v1 routes
    statusRoute,
    createRoute,
    lookupRoute,
    deleteRoute,
    resumeRoute,
    rebootRoute,
    stopRoute,
    powerStatusRoute,
    listRoute,
]