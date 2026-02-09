"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { putSample } from "@/lib/db";
import {
  loadImageToCanvas,
  setupDrawing,
  exportCleanJpg,
  exportStrokePng,
  exportStrokeMaskPng,
  exportMarkedJpg,
  hasStrokes,
} from "@/lib/image";

const STROKE_STYLES = ["circle", "scribble", "arrow", "check", "other"];

export default function CapturePage() {
  const baseCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const drawingRef = useRef(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [strokeStyle, setStrokeStyle] = useState("circle");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [penColor, setPenColor] = useState("#FF0000");
  const [penThickness, setPenThickness] = useState(4);

  // Load pen defaults from localStorage
  useEffect(() => {
    setPenColor(localStorage.getItem("ris_pen_color") || "#FF0000");
    setPenThickness(Number(localStorage.getItem("ris_pen_thickness")) || 4);
  }, []);

  // Initialize or update drawing engine when pen settings change
  useEffect(() => {
    if (drawingRef.current) {
      drawingRef.current.setColor(penColor);
      drawingRef.current.setThickness(penThickness);
    }
  }, [penColor, penThickness]);

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Destroy previous drawing engine
      if (drawingRef.current) {
        drawingRef.current.destroy();
        drawingRef.current = null;
      }

      try {
        const { width, height } = await loadImageToCanvas(
          file,
          baseCanvasRef.current,
          overlayCanvasRef.current
        );
        setDimensions({ width, height });
        setImageLoaded(true);

        drawingRef.current = setupDrawing(overlayCanvasRef.current, {
          color: penColor,
          thickness: penThickness,
        });
      } catch {
        toast.error("Failed to load image.");
      }
    },
    [penColor, penThickness]
  );

  function handleUndo() {
    if (drawingRef.current) drawingRef.current.undo();
  }

  function handleClear() {
    if (drawingRef.current) drawingRef.current.clear();
  }

  async function handleSave() {
    const contributorId = localStorage.getItem("ris_contributor_id");
    if (!contributorId) {
      toast.error("Set your Contributor ID in Settings first.");
      return;
    }

    if (!hasStrokes(overlayCanvasRef.current)) {
      toast.error("Draw at least one stroke before saving.");
      return;
    }

    setSaving(true);
    try {
      const [clean, strokePng, strokeMaskPng, marked] = await Promise.all([
        exportCleanJpg(baseCanvasRef.current),
        exportStrokePng(overlayCanvasRef.current),
        exportStrokeMaskPng(overlayCanvasRef.current),
        exportMarkedJpg(baseCanvasRef.current, overlayCanvasRef.current),
      ]);

      const sample = {
        sample_id: uuidv4(),
        contributor_id: contributorId,
        created_at: new Date().toISOString(),
        width: dimensions.width,
        height: dimensions.height,
        stroke_style: strokeStyle,
        note,
        blobs: { clean, strokePng, strokeMaskPng, marked },
      };

      await putSample(sample);
      toast.success("Sample saved!");

      // Reset for next image
      setImageLoaded(false);
      setNote("");
      const baseCtx = baseCanvasRef.current.getContext("2d");
      baseCtx.clearRect(0, 0, dimensions.width, dimensions.height);
      const overlayCtx = overlayCanvasRef.current.getContext("2d");
      overlayCtx.clearRect(0, 0, dimensions.width, dimensions.height);
      if (drawingRef.current) {
        drawingRef.current.destroy();
        drawingRef.current = null;
      }
    } catch (err) {
      toast.error("Failed to save sample: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="file-input">Image</Label>
          <Input
            id="file-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-auto"
          />
        </div>

        <div className="space-y-1">
          <Label>Stroke Style</Label>
          <Select value={strokeStyle} onValueChange={setStrokeStyle}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STROKE_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label htmlFor="note">Note</Label>
          <Input
            id="note"
            placeholder="e.g. red pen around street sign"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="relative inline-block border rounded-md bg-muted overflow-hidden"
        style={{ maxWidth: "100%" }}
      >
        <canvas
          ref={baseCanvasRef}
          className="block max-w-full h-auto"
          style={{ display: imageLoaded ? "block" : "none" }}
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 max-w-full h-auto cursor-crosshair"
          style={{
            display: imageLoaded ? "block" : "none",
            width: "100%",
            height: "100%",
          }}
        />
        {!imageLoaded && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Upload an image to start drawing
          </div>
        )}
      </div>

      {/* Drawing toolbar */}
      {imageLoaded && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="pen-color" className="text-sm">
              Color
            </Label>
            <input
              id="pen-color"
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border p-0.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="pen-thickness" className="text-sm">
              Size
            </Label>
            <input
              id="pen-thickness"
              type="range"
              min={1}
              max={50}
              value={penThickness}
              onChange={(e) => setPenThickness(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground w-6">
              {penThickness}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={handleUndo}>
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>

          <Button
            className="ml-auto"
            onClick={handleSave}
            disabled={saving || !imageLoaded}
          >
            {saving ? "Saving..." : "Save Sample"}
          </Button>
        </div>
      )}
    </div>
  );
}
