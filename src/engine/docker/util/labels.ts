import {ContainerFilter} from "@nsm/engine";

/**
 * Convert a ContainerFilter to Docker filters format.
 *
 * @param filter The ContainerFilter to convert
 * @returns The Docker filters JSON
 */
export const toDockerFilters = (filter: ContainerFilter) => {
  const dockerFilters: any = {};
  if (filter.labels) {
    dockerFilters.label = Object.entries(filter.labels).map(([key, value]) => `${key}=${value}`);
  }

  return JSON.stringify(dockerFilters);
}