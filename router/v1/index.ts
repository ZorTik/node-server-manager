import statusRoute from "./util/statusRoute";
import lookupRoute from "./service/lookupRoute";
import deleteRoute from "./service/deleteRoute";
import listRoute from "./service/listRoute";
import resumeRoute from "./service/resumeRoute";
import stopRoute from "./service/stopRoute";
import createRoute from "./service/createRoute";

export default [
    // v1 routes
    statusRoute,
    createRoute,
    lookupRoute,
    deleteRoute,
    resumeRoute,
    stopRoute,
    listRoute,
]