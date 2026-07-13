# Regional Intent Segmentation (RIS)

Turn a rough stroke (circle, scribble, arrow, checkmark) drawn on an image into a precise segmentation mask of the object the user meant.

## How it works

**Teacher → Student distillation:**

```
User stroke → SAM 3 / SAM 2.1 (teacher, offline) → ground-truth masks → YOLO26s-seg (student) → fast CPU inference
```

- **Teacher (offline):** SAM generates high-quality masks from stroke-derived prompts (bbox + skeleton points). Used once, during training data prep — too slow for production.
- **Student (production):** YOLO26s-seg predicts candidate instance masks directly from the marked image.
- **Instance selection:** the candidate mask with the highest stroke-overlap × confidence score is chosen as the intended object.

## Project structure

```
├── dataset-builder/      # Next.js web app for capturing stroke annotations (client-side, IndexedDB)
├── RIS_Training_Pipeline.ipynb   # Colab: mask generation → YOLO format → training → ONNX export
├── api/                  # FastAPI + ONNX Runtime inference service
└── docs/                 # Production spec, workflow plan
```

## Pipeline stages

1. **Capture** — teammates upload images and draw stroke annotations in the dataset builder; export as `RIS_EXPORT.zip`.
2. **Ground truth generation** — SAM (teacher) converts strokes into prompts and produces `mask_gt.png` for each sample.
3. **YOLO format conversion** — masks → simplified polygons, 80/20 train/val split.
4. **Training** — YOLO26s-seg, with `mosaic/mixup/copy_paste` disabled (they break stroke↔object intent), mild geometric augmentation, heavy photometric augmentation.
5. **Export** — ONNX (CPU-optimized) for production.
6. **Deploy** — FastAPI + Docker on AWS Lightsail (CPU-only).

## API

```
POST /segment
```
Input: marked image (+ optional stroke mask). Output:
```json
{
  "status": "ok",
  "mask_png_base64": "...",
  "cutout_png_base64": "...",
  "bbox_xyxy": [x1, y1, x2, y2],
  "intent_confidence": 0.92,
  "model_path": "student|fallback",
  "debug": { "instances": 3, "selected_instance": 1, "overlap_scores": [0.02, 0.68, 0.11] }
}
```

## Stack

- **Frontend:** Next.js (canvas-based stroke capture)
- **Training:** Google Colab Pro, Ultralytics YOLO26s-seg, SAM 3 / SAM 2.1 Hiera-Large
- **Serving:** FastAPI, ONNX Runtime, Docker, AWS Lightsail (8GB RAM, 2 vCPU, CPU-only)

## Status

- ✅ Dataset builder + export format (`ris-v1`)
- ✅ Training pipeline (mask gen → YOLO conversion → training → ONNX export)
- ✅ FastAPI inference tested locally
- 🚧 SAM 3 upgrade for teacher masks
- 🚧 Full frontend integration
- 🚧 Production deployment hardening

## License

TBD
