import {Service} from "@nsm/engine";

export type NSMObjectLabels = {
  id: string;
};

// Default labels to use in docker engine objects produced by NSM
export const constructObjectLabels = ({ id }: NSMObjectLabels) => {
  return {
    nsm: "true",
    "nsm.id": id,
  };
}

export const parseResourceOptionsSet = (service: Service) => {
  return {
    ram: service.env.SERVICE_RAM ? Number(service.env.SERVICE_RAM) : 0,
    cpu: service.env.SERVICE_CPU ? Number(service.env.SERVICE_CPU) : 0,
    disk: service.env.SERVICE_DISK ? Number(service.env.SERVICE_DISK) : 0,
  };
}