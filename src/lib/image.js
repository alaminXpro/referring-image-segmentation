const MAX_DIMENSION = 4096;

/**
 * Load an image file onto base and overlay canvases.
 * Scales down if either dimension exceeds MAX_DIMENSION.
 * Returns { width, height }.
 */
export function loadImageToCanvas(file, baseCanvas, overlayCanvas) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      let { naturalWidth: w, naturalHeight: h } = img;

      // Scale down if too large
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      baseCanvas.width = w;
      baseCanvas.height = h;
      overlayCanvas.width = w;
      overlayCanvas.height = h;

      const baseCtx = baseCanvas.getContext("2d");
      baseCtx.drawImage(img, 0, 0, w, h);

      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.clearRect(0, 0, w, h);

      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Attach drawing listeners to the overlay canvas.
 * Returns { undo, clear, setColor, setThickness, destroy }.
 */
export function setupDrawing(overlayCanvas, options = {}) {
  const ctx = overlayCanvas.getContext("2d");
  let color = options.color || "#FF0000";
  let thickness = options.thickness || 4;
  let drawing = false;
  const undoStack = [];
  const MAX_UNDO = 30;

  function getPos(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function saveState() {
    const data = ctx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
    undoStack.push(data);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    drawing = true;
    saveState();
    const pos = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    overlayCanvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function onPointerUp() {
    if (!drawing) return;
    drawing = false;
  }

  overlayCanvas.addEventListener("pointerdown", onPointerDown);
  overlayCanvas.addEventListener("pointermove", onPointerMove);
  overlayCanvas.addEventListener("pointerup", onPointerUp);

  return {
    undo() {
      if (undoStack.length === 0) return false;
      const data = undoStack.pop();
      ctx.putImageData(data, 0, 0);
      return true;
    },
    clear() {
      saveState();
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    },
    setColor(c) {
      color = c;
    },
    setThickness(t) {
      thickness = t;
    },
    destroy() {
      overlayCanvas.removeEventListener("pointerdown", onPointerDown);
      overlayCanvas.removeEventListener("pointermove", onPointerMove);
      overlayCanvas.removeEventListener("pointerup", onPointerUp);
    },
  };
}

/** Export the overlay canvas as a PNG blob (RGBA stroke layer). */
export function exportStrokePng(overlayCanvas) {
  return new Promise((resolve) => {
    overlayCanvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/** Export a binary mask: white where strokes exist, black elsewhere. */
export function exportStrokeMaskPng(overlayCanvas) {
  const { width, height } = overlayCanvas;
  const ctx = overlayCanvas.getContext("2d");
  const src = ctx.getImageData(0, 0, width, height);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d");
  const dst = tempCtx.createImageData(width, height);

  for (let i = 0; i < src.data.length; i += 4) {
    const hasStroke = src.data[i + 3] > 0;
    dst.data[i] = hasStroke ? 255 : 0;
    dst.data[i + 1] = hasStroke ? 255 : 0;
    dst.data[i + 2] = hasStroke ? 255 : 0;
    dst.data[i + 3] = 255;
  }

  tempCtx.putImageData(dst, 0, 0);
  return new Promise((resolve) => {
    tempCanvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/** Composite base + overlay into a JPEG blob. */
export function exportMarkedJpg(baseCanvas, overlayCanvas) {
  const { width, height } = baseCanvas;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(overlayCanvas, 0, 0);
  return new Promise((resolve) => {
    tempCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

/** Export the base canvas as a clean JPEG blob. */
export function exportCleanJpg(baseCanvas) {
  return new Promise((resolve) => {
    baseCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

/** Check if the overlay canvas has any non-transparent pixels. */
export function hasStrokes(overlayCanvas) {
  const ctx = overlayCanvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}
