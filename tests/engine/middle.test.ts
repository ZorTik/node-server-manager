import { expect, it } from "@jest/globals";
import {
  middleLayer,
  registerErrorPublisher,
  ServiceActionError,
} from "@nsm/engine/middle";
import * as runner from "@nsm/engine/runner";
import {ServiceRunner} from "@nsm/engine/runner";

it("test sets service id in action error", async () => {
  let receivedError: ServiceActionError | null = null;
  registerErrorPublisher({
    publishError(action: ServiceActionError): Promise<void> {
      receivedError = action;

      return Promise.resolve();
    },
  });

  let customRunner: ServiceRunner = {
    ...runner,
    async resumeService(_: string) {
      throw new Error("Failed to resume service");
    },
  };
  customRunner = middleLayer(customRunner);

  let threw = false;
  try {
    await customRunner.resumeService("test-service-id");
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
