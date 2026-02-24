import {afterEach, beforeEach, expect, it} from "@jest/globals";
import {MariaDbContainer, StartedMariaDbContainer} from "@testcontainers/mariadb";
import {execSync} from "child_process";
import getDb, {Database} from "@nsm/database";
import {initClientForTest} from "@nsm/database/manager";
import {PrismaClient} from "@prisma/client";

let container: StartedMariaDbContainer;
let db: Database;

beforeEach(async () => {
  container = await new MariaDbContainer("mariadb:10.4")
    .withRootPassword("test")
    .withDatabase("nsm")
    .start();

  const dbUrl = container.getConnectionUri()
    .replace("mariadb://", "mysql://");;
  process.env.DATABASE_URL = dbUrl;

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });
  db = getDb();
  initClientForTest(new PrismaClient({
    datasourceUrl: dbUrl,
  }));
}, 20000);

afterEach(async () => {
  await container.stop();
}, 20000);

it("saves image", async () => {
  const success = await db.saveImage({
    id: "test-image",
    templateId: "test-template",
    hash: "test-hash",
    buildOptions: {
      option1: "value1",
      option2: "value2",
    },
  });
  expect(success).toBe(true);

  const image = await db.getImage("test-image");
  expect(image).toBeDefined();
  expect(image?.id).toBe("test-image");
  expect(image?.templateId).toBe("test-template");
  expect(image?.hash).toBe("test-hash");
  expect(image?.buildOptions).toEqual({
    option1: "value1",
    option2: "value2",
  });
});

it("finds image by options", async () => {
  await db.saveImage({
    id: "test-image",
    templateId: "test-template",
    hash: "test-hash",
    buildOptions: {
      option1: "value1",
      option2: "value2",
    },
  });

  let imagesByOptions = await db.listImagesByOptions("test-template", {
    option1: "value1",
    option2: "value2",
  });
  expect(imagesByOptions).toHaveLength(1);
  expect(imagesByOptions[0]?.id).toBe("test-image");

  imagesByOptions = await db.listImagesByOptions("test-template", {
    option2: "value2",
    option1: "value1",
  });
  expect(imagesByOptions).toHaveLength(1);
  expect(imagesByOptions[0]?.id).toBe("test-image");

  imagesByOptions = await db.listImagesByOptions("test-template", {
    option1: "value1",
    option2: "value2",
    option3: "value3",
  });
  expect(imagesByOptions).toHaveLength(0);
});