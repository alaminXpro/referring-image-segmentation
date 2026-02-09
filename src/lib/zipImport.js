import JSZip from "jszip";
import { SCHEMA_VERSION } from "./schema";
import { putSample, getSample } from "./db";

/**
 * Import samples from an exported RIS ZIP file into IndexedDB.
 * Skips samples that already exist (by sample_id).
 * @param {File} file - the ZIP file to import
 * @param {function} [onProgress] - called with { current, total, message }
 * @returns {Promise<{ imported: number, skipped: number, errors: string[] }>}
 */
export async function importZip(file, onProgress) {
  const stats = { imported: 0, skipped: 0, errors: [] };

  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    stats.errors.push("Failed to read ZIP: " + err.message);
    return stats;
  }

  // Read manifest
  const manifestFile = zip.file("RIS_EXPORT/manifest.jsonl");
  if (!manifestFile) {
    stats.errors.push("Missing RIS_EXPORT/manifest.jsonl");
    return stats;
  }

  const manifestText = await manifestFile.async("text");
  const lines = manifestText.trim().split("\n").filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: lines.length,
        message: `Importing sample ${i + 1} of ${lines.length}...`,
      });
    }

    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      stats.errors.push(`Invalid manifest line ${i + 1}`);
      continue;
    }

    const id = entry.sample_id;

    // Skip if already exists
    const existing = await getSample(id);
    if (existing) {
      stats.skipped++;
      continue;
    }

    // Read the sample files
    const prefix = `RIS_EXPORT/raw/${id}/`;
    try {
      const cleanFile = zip.file(prefix + "clean.jpg");
      const strokeFile = zip.file(prefix + "stroke.png");
      const strokeMaskFile = zip.file(prefix + "stroke_mask.png");
      const markedFile = zip.file(prefix + "marked.jpg");
      const metaFile = zip.file(prefix + "meta.json");

      if (!cleanFile || !strokeFile || !strokeMaskFile || !markedFile) {
        stats.errors.push(`Missing files for sample ${id}`);
        continue;
      }

      const [clean, strokePng, strokeMaskPng, marked] = await Promise.all([
        cleanFile.async("blob"),
        strokeFile.async("blob"),
        strokeMaskFile.async("blob"),
        markedFile.async("blob"),
      ]);

      // Read meta if available, otherwise use manifest entry
      let meta = entry;
      if (metaFile) {
        try {
          meta = JSON.parse(await metaFile.async("text"));
        } catch {
          // fall back to manifest entry
        }
      }

      const sample = {
        sample_id: id,
        contributor_id: meta.contributor_id || entry.contributor_id || "unknown",
        created_at: meta.created_at || entry.created_at || new Date().toISOString(),
        width: meta.width || entry.width || 0,
        height: meta.height || entry.height || 0,
        stroke_style: meta.stroke_style || "other",
        note: meta.note || "",
        blobs: { clean, strokePng, strokeMaskPng, marked },
      };

      await putSample(sample);
      stats.imported++;
    } catch (err) {
      stats.errors.push(`Error importing sample ${id}: ${err.message}`);
    }
  }

  return stats;
}
