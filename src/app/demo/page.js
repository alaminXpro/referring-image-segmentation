"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { checkHealth, segmentImage, resizeForApi } from "@/lib/api";
import {
  loadImageToCanvas,
  setupDrawing,
  exportStrokeMaskPng,
  exportMarkedJpg,
  exportCleanJpg,
  hasStrokes,
} from "@/lib/image";

// ---------------------------------------------------------------------------
// Health status constants
// ---------------------------------------------------------------------------
const STATUS = { LOADING: "loading", HEALTHY: "healthy", ERROR: "error" };

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function DemoPage() {
  // ---- Health check state ----
  const [health, setHealth] = useState(STATUS.LOADING);
  const [healthError, setHealthError] = useState("");

  // ---- Draw-mode state ----
  const baseCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const drawingRef = useRef(null);
  const drawFileInputRef = useRef(null);
  const [drawImageLoaded, setDrawImageLoaded] = useState(false);
  const [drawDragging, setDrawDragging] = useState(false);
  const [penColor, setPenColor] = useState("#FF0000");
  const [penThickness, setPenThickness] = useState(4);

  // ---- Upload-mode state ----
  const uploadFileInputRef = useRef(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadDragging, setUploadDragging] = useState(false);

  // ---- Segmentation state ----
  const [segmenting, setSegmenting] = useState(false);
  const [result, setResult] = useState(null);

  // ---- Result canvas ref ----
  const resultCanvasRef = useRef(null);

  // =========================================================================
  // Health check
  // =========================================================================
  const runHealthCheck = useCallback(async () => {
    setHealth(STATUS.LOADING);
    setHealthError("");
    try {
      const data = await checkHealth();
      if (data.model_loaded) {
        setHealth(STATUS.HEALTHY);
      } else {
        setHealthError("Model is not loaded yet. Please try again shortly.");
        setHealth(STATUS.ERROR);
      }
    } catch (err) {
      setHealthError(err.message || "Cannot reach the segmentation server.");
      setHealth(STATUS.ERROR);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  // =========================================================================
  // Draw-mode: load pen defaults
  // =========================================================================
  useEffect(() => {
    setPenColor(localStorage.getItem("ris_pen_color") || "#FF0000");
    setPenThickness(
      Number(localStorage.getItem("ris_pen_thickness")) || 4
    );
  }, []);

  // Sync pen settings to drawing engine
  useEffect(() => {
    drawingRef.current?.setColor(penColor);
  }, [penColor]);

  useEffect(() => {
    drawingRef.current?.setThickness(penThickness);
  }, [penThickness]);

  // =========================================================================
  // Draw-mode: file loading
  // =========================================================================
  const loadDrawFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please select an image file.");
        return;
      }
      if (drawingRef.current) {
        drawingRef.current.destroy();
        drawingRef.current = null;
      }
      try {
        await loadImageToCanvas(
          file,
          baseCanvasRef.current,
          overlayCanvasRef.current
        );
        setDrawImageLoaded(true);
        setResult(null);
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

  // =========================================================================
  // Upload-mode: file loading
  // =========================================================================
  const loadUploadFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    setUploadFile(file);
    setResult(null);
    const url = URL.createObjectURL(file);
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  // =========================================================================
  // Segmentation
  // =========================================================================
  async function handleSegmentDraw() {
    console.log("[DEBUG] handleSegmentDraw called, drawImageLoaded:", drawImageLoaded);
    if (!drawImageLoaded) return;
    setSegmenting(true);
    try {
      console.log("[DEBUG] Exporting marked jpg...");
      const formData = new FormData();
      const markedBlob = await exportMarkedJpg(
        baseCanvasRef.current,
        overlayCanvasRef.current
      );
      console.log("[DEBUG] markedBlob:", markedBlob?.size, markedBlob?.type);

      // TODO: resize disabled — API returns bbox in image-space coords,
      // resizing here shifts them. Re-enable once coord mapping is added.
      // const resizedMarked = await resizeForApi(markedBlob);
      // formData.append("file", resizedMarked, "marked.jpg");
      formData.append("file", markedBlob, "marked.jpg");

      if (hasStrokes(overlayCanvasRef.current)) {
        console.log("[DEBUG] Exporting stroke mask...");
        const maskBlob = await exportStrokeMaskPng(overlayCanvasRef.current);
        console.log("[DEBUG] maskBlob:", maskBlob?.size, maskBlob?.type);
        // const resizedMask = await resizeForApi(maskBlob);
        // formData.append("stroke_mask", resizedMask, "stroke_mask.png");
        formData.append("stroke_mask", maskBlob, "stroke_mask.png");
      }

      console.log("[DEBUG] Exporting clean original...");
      const cleanBlob = await exportCleanJpg(baseCanvasRef.current);
      console.log("[DEBUG] cleanBlob:", cleanBlob?.size, cleanBlob?.type);
      formData.append("original_image", cleanBlob, "original.jpg");

      console.log("[DEBUG] Calling segmentImage...");
      const data = await segmentImage(formData);
      console.log("[DEBUG] Response:", data);
      setResult(data);
      toast.success("Segmentation complete!");
    } catch (err) {
      console.error("[DEBUG] handleSegmentDraw error:", err);
      toast.error(err.message || "Segmentation failed.");
    } finally {
      setSegmenting(false);
    }
  }

  async function handleSegmentUpload() {
    console.log("[DEBUG] handleSegmentUpload called, uploadFile:", uploadFile);
    if (!uploadFile) return;
    setSegmenting(true);
    try {
      const formData = new FormData();
      // TODO: resize disabled — see note in handleSegmentDraw
      // const resizedUpload = await resizeForApi(uploadFile);
      // formData.append("file", resizedUpload, uploadFile.name);
      formData.append("file", uploadFile, uploadFile.name);

      console.log("[DEBUG] Calling segmentImage...");
      const data = await segmentImage(formData);
      console.log("[DEBUG] Response:", data);
      setResult(data);
      toast.success("Segmentation complete!");
    } catch (err) {
      console.error("[DEBUG] handleSegmentUpload error:", err);
      toast.error(err.message || "Segmentation failed.");
    } finally {
      setSegmenting(false);
    }
  }

  // =========================================================================
  // Draw result overlay (mask + bbox) onto result canvas
  // =========================================================================
  useEffect(() => {
    if (!result || !resultCanvasRef.current) return;
    const canvas = resultCanvasRef.current;
    const ctx = canvas.getContext("2d");

    const origImg = new Image();
    origImg.onload = () => {
      canvas.width = origImg.naturalWidth;
      canvas.height = origImg.naturalHeight;
      ctx.drawImage(origImg, 0, 0);

      // Draw mask overlay
      if (result.mask_png_base64) {
        const maskImg = new Image();
        maskImg.onload = () => {
          ctx.globalAlpha = 0.4;
          ctx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1.0;

          // Draw bounding box
          if (result.bbox_xyxy) {
            const [x1, y1, x2, y2] = result.bbox_xyxy;
            ctx.strokeStyle = "#FF0000";
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          }
        };
        maskImg.src = `data:image/png;base64,${result.mask_png_base64}`;
      } else if (result.bbox_xyxy) {
        const [x1, y1, x2, y2] = result.bbox_xyxy;
        ctx.strokeStyle = "#FF0000";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
    };

    // Use the original image from base canvas or upload preview
    if (result.original_base64) {
      origImg.src = `data:image/jpeg;base64,${result.original_base64}`;
    } else if (baseCanvasRef.current && drawImageLoaded) {
      origImg.src = baseCanvasRef.current.toDataURL("image/jpeg");
    } else if (uploadPreview) {
      origImg.src = uploadPreview;
    }
  }, [result, drawImageLoaded, uploadPreview]);

  // =========================================================================
  // Confidence helpers
  // =========================================================================
  function confidenceColor(val) {
    if (val > 0.7) return "text-green-600";
    if (val > 0.4) return "text-yellow-600";
    return "text-red-600";
  }

  function confidenceBarClass(val) {
    if (val > 0.7) return "[&>div]:bg-green-500";
    if (val > 0.4) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-red-500";
  }

  // =========================================================================
  // Render
  // =========================================================================

  // --- Health: loading overlay ---
  if (health === STATUS.LOADING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner className="size-8" />
        <p className="text-muted-foreground text-sm">
          AI Model is initiating...
        </p>
      </div>
    );
  }

  // --- Health: error ---
  if (health === STATUS.ERROR) {
    return (
      <div className="mx-auto max-w-lg mt-20 px-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Model Unavailable</AlertTitle>
          <AlertDescription className="mt-1">
            {healthError}
          </AlertDescription>
        </Alert>
        <Button className="mt-4 w-full" onClick={runHealthCheck}>
          <RefreshCw className="size-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <h1 className="text-lg font-semibold">Segmentation Demo</h1>
        <Badge variant="secondary" className="ml-auto">
          Model Online
        </Badge>
      </div>

      <Separator />

      {/* Input tabs */}
      <Tabs defaultValue="draw">
        <TabsList>
          <TabsTrigger value="draw">Draw</TabsTrigger>
          <TabsTrigger value="upload">Upload Pre-marked</TabsTrigger>
        </TabsList>

        {/* ======================== DRAW TAB ======================== */}
        <TabsContent value="draw" className="space-y-4">
          <input
            ref={drawFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadDrawFile(f);
              e.target.value = "";
            }}
          />

          {/* Canvas / drop zone */}
          <div
            className={`relative border rounded-md bg-muted overflow-hidden transition-colors ${
              drawDragging ? "border-primary border-2 bg-primary/5" : ""
            } ${drawImageLoaded ? "inline-block" : "block"}`}
            style={{ maxWidth: "100%" }}
            onDragOver={(e) => {
              e.preventDefault();
              setDrawDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDrawDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDrawDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) loadDrawFile(f);
            }}
          >
            <canvas
              ref={baseCanvasRef}
              className="block max-w-full h-auto"
              style={{ display: drawImageLoaded ? "block" : "none" }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 max-w-full h-auto cursor-crosshair"
              style={{
                display: drawImageLoaded ? "block" : "none",
                width: "100%",
                height: "100%",
                touchAction: "none",
              }}
            />
            {!drawImageLoaded && (
              <div
                className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-2 cursor-pointer"
                onClick={() => drawFileInputRef.current?.click()}
              >
                <Upload className="size-8 opacity-40" />
                <span>Drop an image here or click to upload</span>
              </div>
            )}
          </div>

          {/* Toolbar */}
          {drawImageLoaded && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="demo-pen-color" className="text-sm">
                  Color
                </Label>
                <input
                  id="demo-pen-color"
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border p-0.5"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="demo-pen-size" className="text-sm">
                  Size
                </Label>
                <input
                  id="demo-pen-size"
                  type="range"
                  min={1}
                  max={50}
                  value={penThickness}
                  onChange={(e) => setPenThickness(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground w-6">
                  {penThickness}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => drawingRef.current?.undo()}
              >
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => drawingRef.current?.clear()}
              >
                Clear
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDrawImageLoaded(false);
                  setResult(null);
                  if (drawingRef.current) {
                    drawingRef.current.destroy();
                    drawingRef.current = null;
                  }
                }}
              >
                New Image
              </Button>

              <Button
                className="ml-auto"
                onClick={handleSegmentDraw}
                disabled={segmenting || !drawImageLoaded}
              >
                {segmenting ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Segmenting...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Segment
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* =================== UPLOAD PRE-MARKED TAB =================== */}
        <TabsContent value="upload" className="space-y-4">
          <input
            ref={uploadFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) loadUploadFile(f);
              e.target.value = "";
            }}
          />

          {/* Drop zone / preview */}
          <div
            className={`relative border rounded-md bg-muted overflow-hidden transition-colors ${
              uploadDragging ? "border-primary border-2 bg-primary/5" : ""
            }`}
            style={{ maxWidth: "100%" }}
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setUploadDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setUploadDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) loadUploadFile(f);
            }}
          >
            {uploadPreview ? (
              <img
                src={uploadPreview}
                alt="Uploaded preview"
                className="block max-w-full h-auto"
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-2 cursor-pointer"
                onClick={() => uploadFileInputRef.current?.click()}
              >
                <Upload className="size-8 opacity-40" />
                <span>
                  Drop a pre-marked image here or click to upload
                </span>
              </div>
            )}
          </div>

          {uploadPreview && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadFile(null);
                  if (uploadPreview) URL.revokeObjectURL(uploadPreview);
                  setUploadPreview(null);
                  setResult(null);
                }}
              >
                New Image
              </Button>

              <Button
                className="ml-auto"
                onClick={handleSegmentUpload}
                disabled={segmenting || !uploadFile}
              >
                {segmenting ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Segmenting...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Segment
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===================== RESULTS SECTION ===================== */}
      {result && (
        <div className="space-y-4">
          <Separator />

          <h2 className="text-base font-semibold">Segmentation Results</h2>

          {/* Visual results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mask + Bbox overlay */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Original + Mask Overlay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <canvas
                  ref={resultCanvasRef}
                  className="block max-w-full h-auto rounded border"
                />
              </CardContent>
            </Card>

            {/* Cutout */}
            {result.cutout_png_base64 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Extracted Cutout</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="rounded border overflow-hidden"
                    style={{
                      background:
                        "repeating-conic-gradient(#d4d4d4 0% 25%, transparent 0% 50%) 0 0 / 16px 16px",
                    }}
                  >
                    <img
                      src={`data:image/png;base64,${result.cutout_png_base64}`}
                      alt="Cutout"
                      className="block max-w-full h-auto"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Confidence */}
            {result.confidence != null && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Confidence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <span
                    className={`text-2xl font-bold ${confidenceColor(result.confidence)}`}
                  >
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                  <Progress
                    value={result.confidence * 100}
                    className={confidenceBarClass(result.confidence)}
                  />
                </CardContent>
              </Card>
            )}

            {/* Bounding box */}
            {result.bbox_xyxy && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Bounding Box</CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="text-sm font-mono">
                    [{result.bbox_xyxy.map((v) => Math.round(v)).join(", ")}]
                  </code>
                </CardContent>
              </Card>
            )}

            {/* Model path */}
            {result.model_path && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Model</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">{result.model_path}</Badge>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Debug info */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground"
              >
                <ChevronDown className="size-4" />
                Debug Info
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <CardContent className="pt-4">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-mono">
                    {result.stroke_present != null && (
                      <>
                        <dt className="text-muted-foreground">stroke_present</dt>
                        <dd>{String(result.stroke_present)}</dd>
                      </>
                    )}
                    {result.stroke_pixels != null && (
                      <>
                        <dt className="text-muted-foreground">stroke_pixels</dt>
                        <dd>{result.stroke_pixels.toLocaleString()}</dd>
                      </>
                    )}
                    {result.instances != null && (
                      <>
                        <dt className="text-muted-foreground">instances</dt>
                        <dd>{result.instances}</dd>
                      </>
                    )}
                    {result.overlap_scores && (
                      <>
                        <dt className="text-muted-foreground">overlap_scores</dt>
                        <dd>
                          [
                          {result.overlap_scores
                            .map((s) => s.toFixed(3))
                            .join(", ")}
                          ]
                        </dd>
                      </>
                    )}
                    {result.all_confidences && (
                      <>
                        <dt className="text-muted-foreground">
                          all_confidences
                        </dt>
                        <dd>
                          [
                          {result.all_confidences
                            .map((c) => c.toFixed(3))
                            .join(", ")}
                          ]
                        </dd>
                      </>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
