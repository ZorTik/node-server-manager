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

import contentServicesRoute from "@nsm/router/v1/log/service/contentRoute";
import listServicesRoute from "@nsm/router/v1/log/service/listRoute";
import contentApiRoute from "@nsm/router/v1/log/api/contentRoute";
import listApiRoute from "@nsm/router/v1/log/api/listRoute";

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

    contentServicesRoute,
    listServicesRoute,
    
    contentApiRoute,
    listApiRoute
]