import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { gzipSync } from 'zlib';
import { stringifyBackupPayload } from './stringify-backup';

export type WriteGzipBackupResult = {
  path: string;
  sizeBytes: number;
};

/**
 * Writes a gzip-compressed JSON backup to `outPath` (typically ends with `.json.gz`).
 * Plain `.json` is written uncompressed when the path does not end with `.gz`.
 */
export function writeBackupFile(
  outPath: string,
  payload: object,
): WriteGzipBackupResult {
  mkdirSync(dirname(outPath), { recursive: true });
  const json = stringifyBackupPayload(payload);
  const wantsGzip = outPath.toLowerCase().endsWith('.gz');
  if (wantsGzip) {
    const compressed = gzipSync(Buffer.from(json, 'utf-8'));
    writeFileSync(outPath, compressed);
    return { path: outPath, sizeBytes: compressed.length };
  }
  writeFileSync(outPath, json, 'utf-8');
  return { path: outPath, sizeBytes: Buffer.byteLength(json, 'utf-8') };
}
