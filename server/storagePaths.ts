import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function isDirectoryWritable(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveWritableBaseDir(): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NOW_REGION
  );

  if (process.env.CC_DATA_ROOT && isDirectoryWritable(process.env.CC_DATA_ROOT)) {
    return process.env.CC_DATA_ROOT;
  }

  if (!isServerless) {
    const cwdData = path.resolve(process.cwd(), 'data');
    if (isDirectoryWritable(cwdData)) {
      return process.cwd();
    }
  }

  const tmpRoot = path.join(os.tmpdir(), 'campus-consult-dehradun');
  fs.mkdirSync(tmpRoot, { recursive: true });
  return tmpRoot;
}

const BASE_WRITABLE_ROOT = resolveWritableBaseDir();

export const WRITABLE_DATA_DIR = path.join(BASE_WRITABLE_ROOT, 'data');
export const WRITABLE_UPLOAD_DIR = path.join(BASE_WRITABLE_ROOT, 'storage', 'uploads');

fs.mkdirSync(WRITABLE_DATA_DIR, { recursive: true });
fs.mkdirSync(WRITABLE_UPLOAD_DIR, { recursive: true });
