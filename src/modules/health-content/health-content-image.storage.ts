import * as fs from 'fs';
import * as path from 'path';
import { generateSafeNanoid } from '../../common/utils/human-readable-id.util';

export const HEALTH_CONTENT_UPLOAD_DIR = path.join(
  process.cwd(),
  'uploads',
  'health-content',
);

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export const HEALTH_CONTENT_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export function isHealthContentImage(mime: string, originalName: string): boolean {
  const normalizedMime = mime.toLowerCase();
  if (IMAGE_MIMES.has(normalizedMime)) return true;
  const ext = path.extname(originalName || '').toLowerCase();
  return (
    ALLOWED_EXT.has(ext) &&
    (normalizedMime === 'application/octet-stream' || normalizedMime === '')
  );
}

export function healthContentImageFilename(
  originalName: string,
  mime: string,
): string {
  const fromMime = EXT_BY_MIME[mime.toLowerCase()];
  const fromName = path.extname(originalName || '').toLowerCase();
  const ext =
    fromMime ??
    (fromName === '.jpeg'
      ? '.jpg'
      : ALLOWED_EXT.has(fromName)
        ? fromName
        : '.jpg');
  return `${generateSafeNanoid()}${ext}`;
}

const STORED_IMAGE =
  /^\/uploads\/health-content\/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp|gif)$/i;

export function isAllowedHealthImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (STORED_IMAGE.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveHealthContentImagePath(filename: string): string | null {
  if (!/^[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp|gif)$/.test(filename)) {
    return null;
  }
  const root = path.resolve(HEALTH_CONTENT_UPLOAD_DIR);
  const filePath = path.resolve(root, filename);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}
