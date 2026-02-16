const API_URL = process.env.NEXT_PUBLIC_RIS_API_URL;

/**
 * Resize an image Blob to 640×640 via the /api/resize server route (sharp).
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export async function resizeForApi(blob) {
  const fd = new FormData();
  fd.append("file", blob, "image.jpg");
  const res = await fetch("/api/resize", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Resize failed: " + res.status);
  return res.blob();
}

/**
 * Check if the segmentation model is healthy and loaded.
 * @returns {{ status: string, model_loaded: boolean }}
 */
export async function checkHealth() {
  const res = await fetch(`${API_URL}/health`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

/**
 * Send an image (and optional stroke mask) to the segmentation endpoint.
 * @param {FormData} formData - must contain `file`; may contain `stroke_mask`
 * @returns {Promise<Object>} full JSON response from the model
 */
export async function segmentImage(formData) {
  const res = await fetch(`${API_URL}/segment`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Segmentation failed: ${res.status}`);
  }
  return res.json();
}
