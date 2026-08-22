import { readdir, readFile, stat } from 'fs/promises';
import * as path from 'path';
import { FileInfo, formatBytes, ProcessResult, Result } from './type';

const SERVICES_LOGS_PATH: string = path.join(process.cwd(), 'service_logs');
const API_LOGS_PATH: string = path.join(process.cwd(), 'logs');

async function readLogContent(fullPath: string): Promise<ProcessResult<string>> {
  try {
    const content = await readFile(fullPath, 'utf-8');
    if (content.length === 0) {
      return {
        Status: Result.Empty,
        Data: null
      };
    }
    return {
      Status: Result.Success,
      Data: content
    };
  } catch (error) {
    return {
      Status: Result.Failed,
      Data: null
    };
  }
}

async function getApiLogContent(logId: string): Promise<ProcessResult<string>> {
  return readLogContent(path.join(API_LOGS_PATH, logId));
}

async function getNodeLogContent(nodeId: string, logId: string): Promise<ProcessResult<string>> {
  return readLogContent(path.join(SERVICES_LOGS_PATH, nodeId, logId));
}

async function getLogsInDirectory(directoryPath: string): Promise<ProcessResult<FileInfo[]>> {
  try {
    const files = await getDirectoryFilesInfo(directoryPath);
    if (files.length === 0) {
      return {
        Status: Result.Empty,
        Data: []
      };
    }
    return {
      Status: Result.Success,
      Data: files
    };
  } catch (error) {
    return {
      Status: Result.Failed,
      Data: []
    };
  }
}

async function getApiLogs(): Promise<ProcessResult<FileInfo[]>> {
  return getLogsInDirectory(API_LOGS_PATH);
}

async function getServiceLogs(nodeId: string): Promise<ProcessResult<FileInfo[]>> {
  return getLogsInDirectory(path.join(SERVICES_LOGS_PATH, nodeId));
}

async function getDirectoryFilesInfo(directoryPath: string): Promise<FileInfo[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const fileInfoPromises = entries
      .filter(entry => entry.isFile())
      .map(async (entry) => {
        const fullPath = path.join(directoryPath, entry.name);
        const fileStats = await stat(fullPath);
        return {
          name: entry.name,
          path: entry.parentPath,
          size: formatBytes(fileStats.size),
          createdAt: fileStats.birthtime,
          modifiedAt: fileStats.mtime
        };
      });

    return await Promise.all(fileInfoPromises);
  } catch (error) {
    console.error('Chyba při získávání informací o souborech:', error);
    return [];
  }
}

export { API_LOGS_PATH, SERVICES_LOGS_PATH };
export { getApiLogs, getServiceLogs };
export { getApiLogContent, getNodeLogContent };