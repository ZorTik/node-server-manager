export class InternalError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class KnownError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(message);
  }
}

export class InvalidMetaError extends KnownError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ServiceNotFoundError extends KnownError {
  constructor(
    public readonly serviceId: string
  ) {
    super(404, `Service not found.`);
  }
}

export class ServiceNotRunningError extends KnownError {
  constructor(
    public readonly serviceId: string
  ) {
    super(409, `Service is not running.`);
  }
}

export class ServiceAlreadyRunningError extends KnownError {
  constructor(
    public readonly serviceId: string
  ) {
    super(409, `Service is already running.`);
  }
}

export class ServiceWasNeverActiveError extends KnownError {
  constructor() {
    super(400, "Service was never active.");
  }
}

export class ServicePendingActionError extends KnownError {
  constructor(
    public readonly serviceId: string,
    public readonly pendingAction: string
  ) {
    super(409, `Service has a pending action '${pendingAction}'.`);
  }
}

export class ServiceEngineError extends InternalError {
  constructor(
    public readonly cause: Error
  ) {
    super("An error occurred in the service engine. Cause: " + cause.message + (cause.stack ? `\nStack trace: ${cause.stack}` : ""));
  }
}

export class TemplateNotFoundError extends KnownError {
  constructor(
    public readonly templateId: string
  ) {
    super(404, `Template with ID ${templateId} not found.`);
  }
}

export class TemplateRepositoryConfigurationError extends InternalError {
  constructor(
    public readonly repository: string,
    public readonly cause?: Error | string,
  ) {
    super(`Failed to configure template repository '${repository}'.` + (cause ? ` Cause: ${
      cause instanceof Error ? cause.message : String(cause)
    }` : ""));
  }
}