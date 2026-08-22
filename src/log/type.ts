interface LogsDto {
    size: number;         // count of files
    results: FileInfo[];  // array of file info
}

enum Result {
  Success,
  Empty,
  Failed
}

interface FileInfo {
  name: string;
  size: string;
  createdAt: Date;
  modifiedAt: Date;
}

interface ProcessResult<D> {
  Status: Result, 
  Data: D
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export { formatBytes, FileInfo, LogsDto, Result, ProcessResult }