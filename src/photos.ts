/**
 * Where photos live on the phone (spec 8.9): IndexedDB, one blob per id. The spec holds only the id. Nothing here
 * sends anything anywhere. Photos no design refers to any more (current, Back, Kept) are deleted (`prune`).
 */
import { decodePhoto, importPicture } from './engine/photoload';
import { photoOf, registerPhoto } from './engine/photo';

const DB = 'rstr-photos', STORE = 'photos';
let db: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  db ??= new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  return db;
}
function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((d) => new Promise<T>((ok, no) => {
    const t = d.transaction(STORE, mode), q = f(t.objectStore(STORE));
    t.oncomplete = () => ok(q.result);
    t.onerror = t.onabort = () => no(t.error);
  }));
}

/** A new id: random, not a seed of any design. */
function newId(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return 'p' + Date.now().toString(36) + a[0].toString(36) + a[1].toString(36);
}

const loading = new Map<string, Promise<boolean>>();
/** Ids added in this session: never pruned before the design that holds them is saved. */
const fresh = new Set<string>();

/** Import a file from the phone: kept as spec 8.9 says, stored, decoded and registered. Returns its id. */
export async function addPhoto(file: Blob): Promise<string> {
  const { blob, w, h } = await importPicture(file);
  const id = newId();
  fresh.add(id);
  await tx('readwrite', (s) => s.put({ id, blob, w, h, added: Date.now() }));
  registerPhoto(await decodePhoto(id, blob));
  return id;
}

/** Make a photo ready to draw: true if it is (registered now or before), false if it is not on this phone. */
export function ensurePhoto(id: string | null | undefined): Promise<boolean> {
  if (!id) return Promise.resolve(false);
  if (photoOf(id)) return Promise.resolve(true);
  let p = loading.get(id);
  if (!p) {
    p = tx<{ blob: Blob } | undefined>('readonly', (s) => s.get(id))
      .then(async (rec) => { if (!rec) return false; registerPhoto(await decodePhoto(id, rec.blob)); return true; })
      .catch(() => false)
      .finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}

/** Ids of every stored photo. */
export const storedIds = (): Promise<string[]> => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String)).catch(() => []);

/** Delete stored photos no design refers to (`used`), except those added in this session. */
export async function prune(used: Set<string>): Promise<void> {
  for (const id of await storedIds()) if (!used.has(id) && !fresh.has(id)) await tx('readwrite', (s) => s.delete(id)).catch(() => undefined);
}
