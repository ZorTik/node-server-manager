import {ServiceLogRecord} from "@nsm/engine";

export const infoRecord = (message: string): ServiceLogRecord => {
  return {
    level: 'info',
    message
  }
}

export const errorRecord = (message: string): ServiceLogRecord => {
  return {
    level: 'error',
    message
  }
}