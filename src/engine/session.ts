import {RunListener} from "@nsm/engine/engine";
import {CreateLogRecordArgs, Database} from "@nsm/database";

export interface ServiceSession {
  id: string;
  serviceId: string;
  // TODO: begin timestamp, end timestamp
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
}

/**
 * Begins a new service session for the given service ID.
 *
 * @param serviceId The ID of the service for which to begin a session.
 * @return An object representing the active service session.
 */
export const beginServiceSession = async (serviceId: string): Promise<ActiveServiceSession> => {
  let session = await db.sessionRepository.createSession(serviceId);

  // Debounce the push in bulk to prevent database overhead
  const {
    flush: flushRecords,
    debounce: pushRecord
  } = debounceBulkPush();

  const runListener: RunListener = {
    onStateChange: async (state) => {
      const log: CreateLogRecordArgs = {
        sessionId: session.id,
        source: 'ENGINE',
        logLevel: 'INFO',
        message: state.description
      }

      pushRecord(log);
    },
    onMessage: async (record) => {
      const log: CreateLogRecordArgs = {
        sessionId: session.id,
        source: 'CONTAINER',
        logLevel: record.level.toUpperCase(),
        message: record.message
      }

      pushRecord(log);
    },
    onClose: async () => {
      // Push remaining logs now
      await flushRecords();

      // TODO: mark session as closed
    }
  }

  return {
    ...session,
    runListener
  }
}

/**
 * Creates a debounced function for pushing log records in bulk to the database.
 *
 * This function maintains an internal buffer of log records and pushes them to the database
 * after a certain delay or when the buffer reaches a certain size, whichever comes first.
 *
 * @return A function that can be called to push a log record, which will be debounced and pushed in bulk.
 */
const debounceBulkPush = () => {
  const logRecordsBulk: CreateLogRecordArgs[] = [];

  const MAX_BATCH_SIZE = 50;
  const DEBOUNCE_MS = 500;

  let timeout: NodeJS.Timeout|null = null;
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
      logRecordsBulk.push(log);

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
    }
  }
}

// TODO: get service session

// TODO: list service session logs