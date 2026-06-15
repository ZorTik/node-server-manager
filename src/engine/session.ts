import { RunListener } from "@nsm/engine/engine";
import {
  CreateLogRecordArgs,
  Database,
  ListRecordsArgs,
  ListSessionsArgs,
  ServiceLogRecordModel,
  ServiceSessionModel,
} from "@nsm/persistence";
import {ServiceNotFoundError, ServiceWasNeverActiveError} from "@nsm/engine/error";

export interface SessionManager {
  /**
   * Initializes the session manager with the given database instance.
   *
   * @param db The database instance to use for storing session and log data.
   * This method must be called before using any other methods of the session manager.
   */
  init(db: Database): void;

  /**
   * Begins a new service session for the given service ID.
   *
   * @param serviceId The ID of the service for which to begin a session.
   * @return An object representing the active service session, including a run listener for handling session events.
   */
  beginServiceSession(serviceId: string): Promise<ActiveServiceSession>;

  /**
   * Retrieves the last session for a given service ID.
   *
   * @param serviceId The ID of the service for which to retrieve the last session.
   * @return An object representing the last service session, or undefined if no sessions were found.
   * @throws ServiceWasNeverActiveError if the service has never had an active session.
   */
  getLastSession(serviceId: string): Promise<ServiceSession>;

  /**
   * Lists service sessions.
   *
   * @param args The arguments for listing sessions
   * @return A list of service sessions matching the given criteria, or undefined if no sessions were found.
   */
  listSessions(
    args: ListSessionsArgs,
  ): Promise<ServiceSessionModel[] | undefined>;

  /**
   * Lists log records for a service session.
   *
   * @param args The arguments for listing log records
   * @return A list of log records matching the given criteria, or undefined if no records were found.
   */
  listSessionLogs(
    args: ListRecordsArgs,
  ): Promise<ServiceLogRecordModel[] | undefined>;
}

export interface ServiceSession {
  id: string;
  serviceId: string;
  startedAt: Date;
  // TODO: end timestamp
}

export interface ActiveServiceSession extends ServiceSession {
  /**
   * A run listener for this session.
   */
  runListener: RunListener;
}

let db: Database;

export const init = (db_: Database) => {
  db = db_;
};

/**
 * Begins a new service session for the given service ID.
 *
 * @param serviceId The ID of the service for which to begin a session.
 * @return An object representing the active service session.
 * @throws ServiceNotFoundError if the service with the given ID does not exist.
 */
export const beginServiceSession: SessionManager["beginServiceSession"] =
  async (serviceId: string): Promise<ActiveServiceSession> => {
    const perma = await db.permaRepository.getPerma(serviceId);
    if (!perma) {
      throw new ServiceNotFoundError(serviceId);
    }

    let session = await db.sessionRepository.createSession(serviceId);

    // Debounce the push in bulk to prevent database overhead
    const { flush: flushRecords, debounce: pushRecord } = debounceBulkPush();

    const runListener: RunListener = {
      onStateChange: async (state) => {
        pushRecord({
          sessionId: session.id,
          source: "ENGINE",
          logLevel: "INFO",
          message: state.description,
        });
      },
      onMessage: async (record) => {
        pushRecord({
          sessionId: session.id,
          source: "CONTAINER",
          logLevel: record.level.toUpperCase(),
          message: record.message,
        });
      },
      onClose: async () => {
        // Push remaining logs now
        await flushRecords();

        // TODO: mark session as closed
      },
    };

    return {
      ...session,
      runListener,
    };
  };

/**
 * Creates a debounced function for pushing log records in bulk to the database.
 *
 * This function maintains an internal buffer of log records and pushes them to the database
 * after a certain delay or when the buffer reaches a certain size, whichever comes first.
 *
 * @return A function that can be called to push a log record, which will be debounced and pushed in bulk.
 */
const debounceBulkPush = () => {
  const logRecordsBulk: Omit<ServiceLogRecordModel, "id">[] = [];

  const MAX_BATCH_SIZE = 50;
  const DEBOUNCE_MS = 500;

  let timeout: NodeJS.Timeout | null = null;
  let isFlushing = false;

  const flush = async () => {
    if (logRecordsBulk.length === 0) {
      return;
    }
    if (isFlushing) {
      // If currently flushing, move the timer
      renew();
      return;
    }

    isFlushing = true;

    let success = false;

    const batch = logRecordsBulk.splice(0, logRecordsBulk.length);
    try {
      success = await db.serviceLogRepository.createRecords(batch);
    } catch (err) {
      console.error("Failed to flush log records:", err);
    } finally {
      if (!success) {
        // If the operation did not complete for whatever reason,
        // bring back the records
        logRecordsBulk.unshift(...batch);
      }

      isFlushing = false;
    }
  };

  const renew = () => {
    // Renew timer
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;

      void flush();
    }, DEBOUNCE_MS);
  };

  return {
    // Also return flush to be able to forcibly push logs into the database
    flush,
    debounce: (log: CreateLogRecordArgs) => {
      logRecordsBulk.push({ ...log, timestamp: new Date(Date.now()) });

      // If we reached the bulk size limit, flush immediately
      if (logRecordsBulk.length >= MAX_BATCH_SIZE) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }

        void flush();
        return;
      }

      // Renew timer
      renew();
    },
  };
};

export const getLastSession: SessionManager["getLastSession"] = async (
  serviceId
) => {
  // Service not running, so we need to retrieve last session ID
  const lastSession = await listSessions({
    filter: { serviceId },
    sort: { by: "startedAt", direction: "desc" },
    page: { index: 0, size: 1 },
  });
  if (lastSession && lastSession.length > 0) {
    return lastSession[0];
  }

  throw new ServiceWasNeverActiveError();
}

export const listSessions: SessionManager["listSessions"] = async (
  args: ListSessionsArgs,
) => {
  return db.sessionRepository.listSessions(args);
};

export const listSessionLogs: SessionManager["listSessionLogs"] = async (
  args: ListRecordsArgs,
) => {
  return db.serviceLogRepository.listRecords(args);
};
