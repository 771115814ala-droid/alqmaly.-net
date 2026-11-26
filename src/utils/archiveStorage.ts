import type { RegistrationRecord } from '../types';

export const MIN_RETENTION_HOURS = 48;
export const MIN_RETENTION_MS = MIN_RETENTION_HOURS * 60 * 60 * 1000;

const DB_NAME = 'taiz_traffic_archive_db';
const DB_VERSION = 1;
const STORE_NAME = 'registrations';

export function computeRetainUntil(baseIso?: string): string {
  const baseMs = baseIso ? Date.parse(baseIso) : Date.now();
  const safeBase = Number.isNaN(baseMs) ? Date.now() : baseMs;
  return new Date(safeBase + MIN_RETENTION_MS).toISOString();
}

export function getRetainUntilMs(record: Pick<RegistrationRecord, 'retainUntil' | 'createdAt' | 'updatedAt'>): number {
  if (record.retainUntil) {
    const explicit = Date.parse(record.retainUntil);
    if (!Number.isNaN(explicit)) {
      return explicit;
    }
  }
  const baseStr = record.updatedAt || record.createdAt;
  const baseMs = baseStr ? Date.parse(baseStr) : Date.now();
  return (Number.isNaN(baseMs) ? Date.now() : baseMs) + MIN_RETENTION_MS;
}

export function getRemainingRetentionMs(
  record: Pick<RegistrationRecord, 'retainUntil' | 'createdAt' | 'updatedAt'>
): number {
  return Math.max(0, getRetainUntilMs(record) - Date.now());
}

export function formatRemainingRetention(
  record: Pick<RegistrationRecord, 'retainUntil' | 'createdAt' | 'updatedAt'>
): string {
  const remainingMs = getRemainingRetentionMs(record);
  if (remainingMs <= 0) return '';
  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours} ساعة و ${minutes} دقيقة`;
  }
  if (hours > 0) {
    return `${hours} ساعة`;
  }
  return `${minutes} دقيقة`;
}

function openArchiveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getAllLocalRegistrations(): Promise<RegistrationRecord[]> {
  try {
    const db = await openArchiveDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as RegistrationRecord[]) : [];
        list.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveLocalRegistration(record: RegistrationRecord): Promise<void> {
  try {
    const db = await openArchiveDb();
    const withRetention: RegistrationRecord = {
      ...record,
      retainUntil: record.retainUntil || computeRetainUntil(record.updatedAt || record.createdAt),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(withRetention);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore local cache write errors
  }
}

export async function saveAllLocalRegistrations(records: RegistrationRecord[]): Promise<void> {
  try {
    const db = await openArchiveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const rec of records) {
        store.put({
          ...rec,
          retainUntil: rec.retainUntil || computeRetainUntil(rec.updatedAt || rec.createdAt),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore local cache write errors
  }
}

export async function deleteLocalRegistration(id: string): Promise<void> {
  try {
    const db = await openArchiveDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore local cache delete errors
  }
}
