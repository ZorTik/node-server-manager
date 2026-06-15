import { ServiceLogRecord } from "@nsm/engine";

export const infoRecord = (message: string): ServiceLogRecord => {
  return {
    level: "info",
    message,
  };
};

export const errorRecord = (message: string): ServiceLogRecord => {
  return {
    level: "error",
    message,
  };
};

/**
 * Demultiplexes a Docker log buffer (stdout/stderr) into a single string.
 * Docker headers are 8 bytes: [type (1), 0, 0, 0, size (4)]
 */
export const demuxBuffer = (buffer: Buffer): string => {
  let result = "";
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;

    const type = buffer.readUInt8(offset);
    // 0: stdin, 1: stdout, 2: stderr
    if (type > 2) {
      // Not a docker header, or at least not one we recognize as multiplexed
      return buffer.toString("utf8");
    }

    const length = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + length > buffer.length) {
      // Partial payload
      result += buffer.toString("utf8", offset);
      break;
    }

    result += buffer.toString("utf8", offset, offset + length);
    offset += length;
  }

  return result || buffer.toString("utf8");
};

