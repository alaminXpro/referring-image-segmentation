import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { SCHEMA_VERSION, APP_VERSION } from "./schema";

/**
 * Validate a ZIP file against the RIS export spec.
 * @param {File} file
 * @returns {Promise<{valid: boolean, exportMeta: object|null, sampleCount: number, errors: string[]}>}
 */
export async function validateZip(file) {
  const errors = [];
  let exportMeta = null;
  let sampleCount = 0;

  try {
    const zip = await JSZip.loadAsync(file);

    // Check export_meta.json
    const metaFile = zip.file("RIS_EXPORT/export_meta.json");
    if (!metaFile) {
      errors.push("Missing RIS_EXPORT/export_meta.json");
      return { valid: false, exportMeta, sampleCount, errors };
    }

    const metaText = await metaFile.async("text");
    exportMeta = JSON.parse(metaText);

    if (exportMeta.schema_version !== SCHEMA_VERSION) {
      errors.push(
        `Schema version mismatch: expected "${SCHEMA_VERSION}", got "${exportMeta.schema_version}"`
      );
    }

    // Check manifest.jsonl
    const manifestFile = zip.file("RIS_EXPORT/manifest.jsonl");
    if (!manifestFile) {
      errors.push("Missing RIS_EXPORT/manifest.jsonl");
      return { valid: false, exportMeta, sampleCount, errors };
    }

    const manifestText = await manifestFile.async("text");
    const lines = manifestText.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        errors.push("Invalid JSON in manifest line");
        continue;
      }

      const id = entry.sample_id;
      const requiredFiles = [
        `RIS_EXPORT/raw/${id}/clean.jpg`,
        `RIS_EXPORT/raw/${id}/stroke.png`,
        `RIS_EXPORT/raw/${id}/stroke_mask.png`,
        `RIS_EXPORT/raw/${id}/marked.jpg`,
      ];

      for (const path of requiredFiles) {
        if (!zip.file(path)) {
          errors.push(`Missing file: ${path}`);
        }
      }

      sampleCount++;
    }
  } catch (err) {
    errors.push("Failed to read ZIP: " + err.message);
  }

  return {
    valid: errors.length === 0,
    exportMeta,
    sampleCount,
    errors,
  };
}

/**
 * Merge multiple ZIP files into one unified RIS export ZIP.
 * @param {File[]} files - array of ZIP File objects
 * @param {{deduplicate?: boolean}} options
 * @param {function} [onProgress] - called with { phase, current, total, message }
 * @returns {Promise<{blob: Blob, stats: {total: number, duplicatesSkipped: number, errors: string[]}}>}
 */
export async function mergeZips(files, options = {}, onProgress) {
  const deduplicate = options.deduplicate !== false;
  const seen = new Set();
  const mergedManifestLines = [];
  const sourceExportIds = [];
  const stats = { total: 0, duplicatesSkipped: 0, errors: [] };

  const outputZip = new JSZip();
  const root = outputZip.folder("RIS_EXPORT");

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];

    if (onProgress) {
      onProgress({
        phase: "processing",
        current: fi + 1,
        total: files.length,
        message: `Processing ${file.name}...`,
      });
    }

    let sourceZip;
    try {
      sourceZip = await JSZip.loadAsync(file);
    } catch (err) {
      stats.errors.push(`Failed to read ${file.name}: ${err.message}`);
      continue;
    }

    // Parse export_meta
    const metaFile = sourceZip.file("RIS_EXPORT/export_meta.json");
    if (metaFile) {
      try {
        const meta = JSON.parse(await metaFile.async("text"));
        if (meta.export_id) sourceExportIds.push(meta.export_id);
      } catch {
        // non-critical
      }
    }

    // Parse manifest
    const manifestFile = sourceZip.file("RIS_EXPORT/manifest.jsonl");
    if (!manifestFile) {
      stats.errors.push(`${file.name}: missing manifest.jsonl`);
      continue;
    }

    const manifestText = await manifestFile.async("text");
    const lines = manifestText.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        stats.errors.push(`${file.name}: invalid manifest line`);
        continue;
      }

      const id = entry.sample_id;

      if (deduplicate && seen.has(id)) {
        stats.duplicatesSkipped++;
        continue;
      }
      seen.add(id);

      // Copy all files for this sample
      const samplePrefix = `RIS_EXPORT/raw/${id}/`;
      const sampleFiles = Object.keys(sourceZip.files).filter((p) =>
        p.startsWith(samplePrefix)
      );

      for (const path of sampleFiles) {
        const fileObj = sourceZip.file(path);
        if (fileObj && !fileObj.dir) {
          const blob = await fileObj.async("blob");
          root.file(path.replace("RIS_EXPORT/", ""), blob);
        }
      }

      mergedManifestLines.push(line);
      stats.total++;
    }
  }

  // Write merged export_meta.json
  root.file(
    "export_meta.json",
    JSON.stringify(
      {
        schema_version: SCHEMA_VERSION,
        export_id: uuidv4(),
        merged: true,
        source_export_ids: sourceExportIds,
        merged_at: new Date().toISOString(),
        sample_count: stats.total,
        app_version: APP_VERSION,
      },
      null,
      2
    )
  );

  root.file("manifest.jsonl", mergedManifestLines.join("\n"));

  if (onProgress) {
    onProgress({
      phase: "generating",
      current: files.length,
      total: files.length,
      message: "Generating merged ZIP...",
    });
  }

  const blob = await outputZip.generateAsync({ type: "blob" });
  return { blob, stats };
}
