import fs from 'fs';
import path from 'path';

export interface BackupResult {
  backupPath: string;
  prunedPaths: string[];
}

export function createDatabaseBackup(
  dbPath: string,
  backupDir?: string,
  maxBackups = 10
): BackupResult {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  const resolvedDir =
    backupDir || path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(resolvedDir, { recursive: true });

  const ext = path.extname(dbPath) || '.db';
  const base = path.basename(dbPath, ext);
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  const backupPath = path.join(resolvedDir, `${base}.backup-${stamp}${ext}`);

  fs.copyFileSync(dbPath, backupPath);

  const prefix = `${base}.backup-`;
  const allBackups = fs
    .readdirSync(resolvedDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
    .sort()
    .map((f) => path.join(resolvedDir, f));

  const prunedPaths: string[] = [];
  while (allBackups.length > maxBackups) {
    const oldest = allBackups.shift();
    if (oldest && oldest !== backupPath) {
      fs.unlinkSync(oldest);
      prunedPaths.push(oldest);
    }
  }

  return { backupPath, prunedPaths };
}
