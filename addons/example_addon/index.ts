import {Addon} from "@nsm/addon";
import winston from "winston";

async function initAfterLogger(ctx: { logger: winston.Logger }) {
    ctx.logger.info('Hello from example addon!');
}

export default {
    name: 'example_addon',
    disabled: true,
    steps: {
        BEFORE_CONFIG: initAfterLogger,
    }
} as Addon;