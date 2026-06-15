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
    ram: service.args.SERVICE_RAM ? Number(service.args.SERVICE_RAM) : 0,
    cpu: service.args.SERVICE_CPU ? Number(service.args.SERVICE_CPU) : 0,
    disk: service.args.SERVICE_DISK ? Number(service.args.SERVICE_DISK) : 0,
  };
}