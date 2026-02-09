"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { getAllSamples, putSample, deleteSample, bulkDeleteSamples } from "@/lib/db";
import { importZip } from "@/lib/zipImport";
import { Pencil, Trash2, Eye, CheckSquare, X, Upload, Search, Filter } from "lucide-react";

const STROKE_STYLES = ["circle", "scribble", "arrow", "check", "other"];

export default function LibraryPage() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [thumbUrls, setThumbUrls] = useState({});

  // Import state
  const importInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ pct: 0, msg: "" });

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  // Preview dialog
  const [previewSample, setPreviewSample] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStyle, setFilterStyle] = useState("all");
  const [filterContributor, setFilterContributor] = useState("all");
  const [filterTime, setFilterTime] = useState("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
      setThumbUrls((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, [loadSamples]);

  // Derived filter options
  const uniqueContributors = useMemo(
    () => [...new Set(samples.map((s) => s.contributor_id).filter(Boolean))].sort(),
    [samples]
  );
  const uniqueStyles = useMemo(
    () => [...new Set(samples.map((s) => s.stroke_style).filter(Boolean))].sort(),
    [samples]
  );

  // Filtered samples
  const filteredSamples = useMemo(() => {
    let result = samples;

    // Search by note or sample_id
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.sample_id.toLowerCase().includes(q) ||
          (s.note && s.note.toLowerCase().includes(q))
      );
    }

    // Filter by style
    if (filterStyle !== "all") {
      result = result.filter((s) => s.stroke_style === filterStyle);
    }

    // Filter by contributor
    if (filterContributor !== "all") {
      result = result.filter((s) => s.contributor_id === filterContributor);
    }

    // Filter by time
    if (filterTime !== "all") {
      if (filterTime === "custom") {
        if (customDateFrom) {
          const from = new Date(customDateFrom);
          result = result.filter((s) => new Date(s.created_at) >= from);
        }
        if (customDateTo) {
          const to = new Date(customDateTo + "T23:59:59.999");
          result = result.filter((s) => new Date(s.created_at) <= to);
        }
      } else {
        const now = new Date();
        let cutoff;
        if (filterTime === "today") {
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filterTime === "week") {
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (filterTime === "month") {
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        if (cutoff) {
          result = result.filter((s) => new Date(s.created_at) >= cutoff);
        }
      }
    }

    return result;
  }, [samples, searchQuery, filterStyle, filterContributor, filterTime, customDateFrom, customDateTo]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    filterStyle !== "all" ||
    filterContributor !== "all" ||
    filterTime !== "all";

  function clearFilters() {
    setSearchQuery("");
    setFilterStyle("all");
    setFilterContributor("all");
    setFilterTime("all");
    setCustomDateFrom("");
    setCustomDateTo("");
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredSamples.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSamples.map((s) => s.sample_id)));
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    await bulkDeleteSamples([...selected]);
    toast.success(`Deleted ${selected.size} sample(s).`);
    setSelected(new Set());
    setSelectMode(false);
    setShowBulkDelete(false);
    await loadSamples();
  }

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

  async function handleImportZip(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setImporting(true);
    setImportProgress({ pct: 0, msg: "Starting import..." });

    try {
      const stats = await importZip(file, ({ current, total, message }) => {
        setImportProgress({
          pct: Math.round((current / total) * 100),
          msg: message,
        });
      });

      const parts = [`Imported ${stats.imported} sample(s).`];
      if (stats.skipped > 0) parts.push(`${stats.skipped} already existed.`);
      if (stats.errors.length > 0) parts.push(`${stats.errors.length} error(s).`);

      if (stats.imported > 0) {
        toast.success(parts.join(" "));
      } else {
        toast.info(parts.join(" "));
      }

      await loadSamples();
    } catch (err) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
      setImportProgress({ pct: 0, msg: "" });
    }
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">
          Library{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({hasActiveFilters
              ? `${filteredSamples.length} of ${samples.length}`
              : samples.length}{" "}
            sample{(hasActiveFilters ? filteredSamples.length : samples.length) !== 1 ? "s" : ""})
          </span>
        </h1>

        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".zip"
            onChange={handleImportZip}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="size-3.5 mr-1" />
            {importing ? "Importing..." : "Import ZIP"}
          </Button>
          {samples.length > 0 && (
            selectMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={toggleSelectAll}
                >
                  {selected.size === filteredSamples.length ? "Deselect All" : "Select All"}
                </Button>
                <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={selected.size === 0}
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Delete ({selected.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {selected.size} sample{selected.size !== 1 ? "s" : ""}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove the selected samples from your
                        local database. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={exitSelectMode}
                >
                  <X className="size-3.5 mr-1" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectMode(true)}
              >
                <CheckSquare className="size-3.5 mr-1" />
                Select
              </Button>
            )
          )}
        </div>
      </div>

      {/* Search & Filters */}
      {samples.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by note or sample ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="size-3.5 mr-1" />
              Filters
              {hasActiveFilters && !showFilters && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  on
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={clearFilters}
              >
                <X className="size-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/30">
              <Select value={filterStyle} onValueChange={setFilterStyle}>
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All styles</SelectItem>
                  {uniqueStyles.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterContributor} onValueChange={setFilterContributor}>
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <SelectValue placeholder="Contributor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contributors</SelectItem>
                  {uniqueContributors.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterTime}
                onValueChange={(v) => {
                  setFilterTime(v);
                  if (v !== "custom") {
                    setCustomDateFrom("");
                    setCustomDateTo("");
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs w-[130px]">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {filterTime === "custom" && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="h-8 text-xs w-[140px]"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="h-8 text-xs w-[140px]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {importing && (
        <div className="space-y-1">
          <Progress value={importProgress.pct} />
          <p className="text-xs text-muted-foreground text-center">
            {importProgress.msg}
          </p>
        </div>
      )}

      {samples.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No samples yet. Go to Capture to create your first one.
        </p>
      ) : filteredSamples.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No samples match your filters.{" "}
          <button onClick={clearFilters} className="underline hover:text-foreground">
            Clear filters
          </button>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSamples.map((sample) => (
            <Card
              key={sample.sample_id}
              className={`overflow-hidden py-0 gap-0 transition-shadow ${
                selectMode && selected.has(sample.sample_id)
                  ? "ring-2 ring-primary"
                  : ""
              }`}
            >
              <CardHeader className="p-0 relative">
                {selectMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selected.has(sample.sample_id)}
                      onCheckedChange={() => toggleSelect(sample.sample_id)}
                      className="bg-background"
                    />
                  </div>
                )}
                {thumbUrls[sample.sample_id] ? (
                  <img
                    src={thumbUrls[sample.sample_id]}
                    alt="marked preview"
                    className="w-full h-48 object-cover cursor-pointer"
                    onClick={() =>
                      selectMode
                        ? toggleSelect(sample.sample_id)
                        : handlePreview(sample)
                    }
                  />
                ) : (
                  <div
                    className="w-full h-48 bg-muted flex items-center justify-center text-sm text-muted-foreground cursor-pointer"
                    onClick={() =>
                      selectMode && toggleSelect(sample.sample_id)
                    }
                  >
                    No preview
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-3 pt-3 space-y-2">
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
              {!selectMode && editingId !== sample.sample_id && (
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-mono text-sm">
              {previewSample?.sample_id}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="min-h-0 flex-1 overflow-auto">
              <img
                src={previewUrl}
                alt="Full preview"
                className="w-full rounded-md"
              />
            </div>
          )}
          {previewSample && (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground shrink-0">
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
