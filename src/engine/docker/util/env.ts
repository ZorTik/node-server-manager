import {RunOptions} from "@nsm/engine";

export const propagateOptionsToEnv = (options: RunOptions, env: any) => {
  env.SERVICE_PORT = options.port.toString();
  env.SERVICE_PORTS = options.ports.join(' ');
  env.SERVICE_RAM = options.ram.toString();
  env.SERVICE_CPU = options.cpu.toString();
  env.SERVICE_DISK = options.disk.toString();
}