"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getAllSamples, putSample, deleteSample } from "@/lib/db";
import { Pencil, Trash2, Eye } from "lucide-react";

const STROKE_STYLES = ["circle", "scribble", "arrow", "check", "other"];

export default function LibraryPage() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [thumbUrls, setThumbUrls] = useState({});

  // Preview dialog
  const [previewSample, setPreviewSample] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editStyle, setEditStyle] = useState("");

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllSamples();
      setSamples(all);

      // Create thumbnail URLs from marked blobs
      const urls = {};
      for (const s of all) {
        if (s.blobs?.marked) {
          urls[s.sample_id] = URL.createObjectURL(s.blobs.marked);
        }
      }
      setThumbUrls((prev) => {
        // Revoke old URLs
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return urls;
      });
    } catch (err) {
      toast.error("Failed to load samples: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSamples();
    return () => {
      // Cleanup object URLs on unmount
      setThumbUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [loadSamples]);

  function handlePreview(sample) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = sample.blobs?.marked
      ? URL.createObjectURL(sample.blobs.marked)
      : null;
    setPreviewUrl(url);
    setPreviewSample(sample);
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewSample(null);
  }

  function startEdit(sample) {
    setEditingId(sample.sample_id);
    setEditNote(sample.note || "");
    setEditStyle(sample.stroke_style || "other");
  }

  async function saveEdit(sample) {
    const updated = {
      ...sample,
      note: editNote,
      stroke_style: editStyle,
    };
    await putSample(updated);
    setEditingId(null);
    toast.success("Sample updated.");
    await loadSamples();
  }

  async function handleDelete(sampleId) {
    await deleteSample(sampleId);
    toast.success("Sample deleted.");
    await loadSamples();
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Loading samples...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          Library{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({samples.length} sample{samples.length !== 1 ? "s" : ""})
          </span>
        </h1>
      </div>

      {samples.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No samples yet. Go to Capture to create your first one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {samples.map((sample) => (
            <Card key={sample.sample_id} className="overflow-hidden">
              <CardHeader className="p-0">
                {thumbUrls[sample.sample_id] ? (
                  <img
                    src={thumbUrls[sample.sample_id]}
                    alt="marked preview"
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() => handlePreview(sample)}
                  />
                ) : (
                  <div className="w-full h-48 bg-muted flex items-center justify-center text-sm text-muted-foreground">
                    No preview
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{sample.stroke_style}</Badge>
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    {sample.sample_id.slice(0, 8)}...
                  </span>
                </div>

                {editingId === sample.sample_id ? (
                  <div className="space-y-2">
                    <Select value={editStyle} onValueChange={setEditStyle}>
                      <SelectTrigger className="h-8 text-xs">
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
                    <Input
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Note"
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => saveEdit(sample)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {sample.note && (
                      <p className="text-xs text-muted-foreground truncate">
                        {sample.note}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(sample.created_at).toLocaleString()}
                    </p>
                  </>
                )}
              </CardContent>
              {editingId !== sample.sample_id && (
                <CardFooter className="p-3 pt-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => handlePreview(sample)}
                  >
                    <Eye className="size-3.5 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => startEdit(sample)}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete sample?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this sample from your
                          local database. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(sample.sample_id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewSample} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {previewSample?.sample_id}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Full preview"
              className="w-full rounded-md"
            />
          )}
          {previewSample && (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>Style: {previewSample.stroke_style}</span>
              <span>
                {previewSample.width} x {previewSample.height}
              </span>
              <span>
                {new Date(previewSample.created_at).toLocaleString()}
              </span>
              {previewSample.note && <span>Note: {previewSample.note}</span>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
