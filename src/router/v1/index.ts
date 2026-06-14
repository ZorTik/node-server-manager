import statusRoute from "./status";
import lookupRoute from "./service/lookupRoute";
import deleteRoute from "./service/deleteRoute";
import listRoute from "./service/listRoute";
import resumeRoute from "./service/resumeRoute";
import stopRoute from "./service/stopRoute";
import createRoute from "./service/createRoute";
import rebootRoute from "./service/rebootRoute";
import powerStatusRoute from "./service/powerStatusRoute";
import optionsRoute from "@nsm/router/v1/service/optionsRoute";
import sessionsRoute from "@nsm/router/v1/service/sessionsRoute";
import sessionLogsRoute from "@nsm/router/v1/session/sessionLogsRoute";
import logsRoute from "@nsm/router/v1/service/logsRoute";

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
  optionsRoute,
  listRoute,
  sessionsRoute,
  logsRoute,
  sessionLogsRoute,
];
