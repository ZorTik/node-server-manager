import {AppContext} from "@nsm/app";
import { setStatus } from "@nsm/server";
import { setStopping } from "@nsm/engine/asyncp";

let active = false;

const cleanup = (ctx: AppContext, exit?: boolean) => {
  const { runner, logger } = ctx;

  if (active == true) {
    return;
  }

  active = true;
  if (exit == true) {
    logger.info("SIGINT" + ": Executing stop sequence, please wait");
    setStatus("stopping");
    setStopping();
  }

  runner.stopRunning().then(() => {
    if (exit == true) {
      process.exit(0);
    }
  });
};

export const postInit = (ctx: AppContext) => {
  // Cleanup on start
  cleanup(ctx);

  // Handle exit
  process.on("exit", () => {
    // Cleanup on exit
    cleanup(ctx, true);
  });

  // Debug info
  ctx.logger.debug("Signal handlers");
};
