import { openDB as idbOpen } from "idb";
import { DB_NAME, DB_VERSION, STORE_SAMPLES } from "./schema";

let dbPromise = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = idbOpen(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
          db.createObjectStore(STORE_SAMPLES, { keyPath: "sample_id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function putSample(sample) {
  const db = await openDB();
  await db.put(STORE_SAMPLES, sample);
}

export async function getSample(sampleId) {
  const db = await openDB();
  return db.get(STORE_SAMPLES, sampleId);
}

export async function getAllSamples() {
  const db = await openDB();
  const all = await db.getAll(STORE_SAMPLES);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function deleteSample(sampleId) {
  const db = await openDB();
  await db.delete(STORE_SAMPLES, sampleId);
}

export async function bulkGetSamples(sampleIds) {
  const db = await openDB();
  const results = await Promise.all(
    sampleIds.map((id) => db.get(STORE_SAMPLES, id))
  );
  return results.filter(Boolean);
}

export async function countSamples() {
  const db = await openDB();
  return db.count(STORE_SAMPLES);
}
