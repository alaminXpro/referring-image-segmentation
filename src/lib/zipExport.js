import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { SCHEMA_VERSION, APP_VERSION } from "./schema";

/**
 * Build an export ZIP blob from an array of sample records.
 * @param {Array} samples - sample records from IndexedDB
 * @param {string} contributorId
 * @param {function} [onProgress] - called with (current, total) for each sample processed
 * @returns {Promise<Blob>}
 */
export async function buildExportZip(samples, contributorId, onProgress) {
  const zip = new JSZip();
  const root = zip.folder("RIS_EXPORT");
  const exportId = uuidv4();

  root.file(
    "export_meta.json",
    JSON.stringify(
      {
        schema_version: SCHEMA_VERSION,
        export_id: exportId,
        contributor_id: contributorId,
        exported_at: new Date().toISOString(),
        sample_count: samples.length,
        app_version: APP_VERSION,
      },
      null,
      2
    )
  );

  const manifestLines = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const folder = root.folder("raw/" + s.sample_id);

    folder.file("clean.jpg", s.blobs.clean);
    folder.file("stroke.png", s.blobs.strokePng);
    folder.file("stroke_mask.png", s.blobs.strokeMaskPng);
    folder.file("marked.jpg", s.blobs.marked);

    const meta = {
      schema_version: SCHEMA_VERSION,
      sample_id: s.sample_id,
      contributor_id: s.contributor_id,
      created_at: s.created_at,
      width: s.width,
      height: s.height,
      stroke_style: s.stroke_style,
      note: s.note,
    };
    folder.file("meta.json", JSON.stringify(meta, null, 2));

    const manifestLine = {
      schema_version: SCHEMA_VERSION,
      sample_id: s.sample_id,
      contributor_id: s.contributor_id,
      created_at: s.created_at,
      paths: {
        clean: "raw/" + s.sample_id + "/clean.jpg",
        stroke: "raw/" + s.sample_id + "/stroke.png",
        stroke_mask: "raw/" + s.sample_id + "/stroke_mask.png",
        marked: "raw/" + s.sample_id + "/marked.jpg",
        meta: "raw/" + s.sample_id + "/meta.json",
      },
      width: s.width,
      height: s.height,
    };
    manifestLines.push(JSON.stringify(manifestLine));

    if (onProgress) onProgress(i + 1, samples.length);
  }

  root.file("manifest.jsonl", manifestLines.join("\n"));

  return zip.generateAsync({ type: "blob" });
}
