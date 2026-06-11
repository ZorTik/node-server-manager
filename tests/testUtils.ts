import {
  MariaDbContainer,
  StartedMariaDbContainer,
} from "@testcontainers/mariadb";
import { execSync } from "child_process";
import winston from "winston";

export const initDbContainerForTest = async (): Promise<
  [StartedMariaDbContainer, string]
> => {
  const container = await new MariaDbContainer("mariadb:10.4")
    .withRootPassword("test")
    .withDatabase("nsm")
    .start();
  const dbUrl = container.getConnectionUri().replace("mariadb://", "mysql://");

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
  return [container, dbUrl];
};

export const createTestLogger = (): winston.Logger => {
  return winston.createLogger({
    level: "debug",
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
  });
}