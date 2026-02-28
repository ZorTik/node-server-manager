import {expect, it} from "@jest/globals";
import {middleLayer, registerErrorPublisher, ServiceActionError} from "@nsm/engine/middle";
import * as manager from "@nsm/engine/manager";
import {Options, ServiceManager} from "@nsm/engine/manager";

it("test receives action error", async () => {
  let receivedError: ServiceActionError | null = null;
  registerErrorPublisher({
    publishError(action: ServiceActionError): Promise<void> {
      receivedError = action;

      return Promise.resolve();
    }
  });

  let customManager: ServiceManager = {
    ...manager,
    async createService(_: string, __: Options) {
      throw new Error("Failed to create service");
    }
  };
  customManager = middleLayer(customManager);

  let threw = false;
  try {
    await customManager.createService("test-template", {});
  } catch (e) {
    // Expected to throw an error
    threw = true;
  }

  expect(threw).toBe(true);
  expect(receivedError).not.toBeNull();
  expect(receivedError?.serviceId).toBeUndefined();
  expect(receivedError?.type).toEqual("create");
  expect(receivedError?.message).toEqual("Failed to create service");
});

it("test sets service id in action error", async () => {
  let receivedError: ServiceActionError | null = null;
  registerErrorPublisher({
    publishError(action: ServiceActionError): Promise<void> {
      receivedError = action;

      return Promise.resolve();
    }
  });

  let customManager: ServiceManager = {
    ...manager,
    async resumeService(serviceId: string) {
      throw new Error("Failed to resume service");
    }
  };
  customManager = middleLayer(customManager);

  let threw = false;
  try {
    await customManager.resumeService("test-service-id");
  } catch (e) {
    // Expected to throw an error
    threw = true;
  }

  expect(threw).toBe(true);
  expect(receivedError).not.toBeNull();
  expect(receivedError?.serviceId).toEqual("test-service-id");
  expect(receivedError?.type).toEqual("resume");
  expect(receivedError?.message).toEqual("Failed to resume service");
});