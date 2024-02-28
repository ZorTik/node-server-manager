import statusRoute from "./util/statusRoute";
import lookupRoute from "./service/lookupRoute";
import deleteRoute from "./service/deleteRoute";
import listRoute from "./service/listRoute";

export default [
    // v1 routes
    statusRoute,
    lookupRoute,
    deleteRoute,
    listRoute,
]