import express from "express";
import {isServicePending} from "@nsm/engine/asyncp";
import {handleErrorMessage} from "@nsm/util/routes";

export const checkServicePending = (serviceId: string, res: express.Response) => {
  if (isServicePending(serviceId)) {
    handleErrorMessage(409, 'Service is pending another action. Please wait a moment.', res);

    return false;
  }

  return true;
}