import express from "express";
import {isServicePending} from "@nsm/engine/asyncp";
import {handleErrorMessage} from "@nsm/util/routes";
import {ServiceManager} from "@nsm/engine";

export const checkServiceExists = async (
  serviceId: string, manager: ServiceManager, res: express.Response) => {
  if (!await manager.getService(serviceId)) {
    handleErrorMessage(404, 'Service not found.', res);

    return false;
  }

  return true;
}

export const checkServicePending = (serviceId: string, res: express.Response) => {
  if (isServicePending(serviceId)) {
    handleErrorMessage(409, 'Service is pending another action. Please wait a moment.', res);

    return false;
  }

  return true;
};