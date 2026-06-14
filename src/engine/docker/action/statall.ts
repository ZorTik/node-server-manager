import { ServiceEngine } from "@nsm/engine";

export default function (self: ServiceEngine): ServiceEngine["statAll"] {
  return async (filter) => {
    const containers = await self.listContainers(filter);

    return Promise.all(containers.map((c) => self.stat(c)));
  };
}
