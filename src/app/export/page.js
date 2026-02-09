"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getAllSamples } from "@/lib/db";
import { buildExportZip } from "@/lib/zipExport";
import { Download } from "lucide-react";

export default function ExportPage() {
  const [samples, setSamples] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportAll, setExportAll] = useState(true);
  const thumbUrlsRef = useRef({});
  const [thumbUrls, setThumbUrls] = useState({});

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllSamples();
      setSamples(all);
      setSelected(new Set(all.map((s) => s.sample_id)));

      // Create thumbnail URLs
      const oldUrls = thumbUrlsRef.current;
      Object.values(oldUrls).forEach((u) => URL.revokeObjectURL(u));
      const urls = {};
      for (const s of all) {
        if (s.blobs?.marked) {
          urls[s.sample_id] = URL.createObjectURL(s.blobs.marked);
        }
      }
      thumbUrlsRef.current = urls;
      setThumbUrls(urls);
    } catch (err) {
      toast.error("Failed to load samples: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSamples();
    return () => {
      Object.values(thumbUrlsRef.current).forEach((u) =>
        URL.revokeObjectURL(u),
      );
    };
  }, [loadSamples]);

  function toggleSample(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExportAllChange(checked) {
    setExportAll(checked);
    if (checked) {
      setSelected(new Set(samples.map((s) => s.sample_id)));
    }
  }

  const exportCount = exportAll ? samples.length : selected.size;

  async function handleExport() {
    const contributorId = localStorage.getItem("ris_contributor_id");
    if (!contributorId) {
      toast.error("Set your Contributor ID in Settings first.");
      return;
    }
    if (exportCount === 0) {
      toast.error("No samples selected.");
      return;
    }

    setExporting(true);
    setProgress(0);
    try {
      const toExport = exportAll
        ? samples
        : samples.filter((s) => selected.has(s.sample_id));

      const blob = await buildExportZip(
        toExport,
        contributorId,
        (current, total) => setProgress(Math.round((current / total) * 100)),
      );

      const date = new Date().toISOString().slice(0, 10);
      saveAs(blob, `RIS_EXPORT_${contributorId}_${date}.zip`);
      toast.success(`Exported ${toExport.length} samples.`);
    } catch (err) {
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
      setProgress(0);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Export</h1>
        <p className="text-sm text-muted-foreground">
          {samples.length} sample{samples.length !== 1 ? "s" : ""} in database
        </p>
      </div>

      {samples.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No samples to export. Go to Capture to create some.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="export-all"
              checked={exportAll}
              onCheckedChange={handleExportAllChange}
            />
            <label htmlFor="export-all" className="text-sm cursor-pointer">
              Export all samples
            </label>
          </div>

          {!exportAll && (
            <div className="border rounded-md max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="border-b bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 w-10"></th>
                    <th className="p-2 w-16 text-left">Preview</th>
                    <th className="p-2 text-left">Sample ID</th>
                    <th className="p-2 text-left">Style</th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.sample_id} className="border-b last:border-0">
                      <td className="p-2">
                        <Checkbox
                          checked={selected.has(s.sample_id)}
                          onCheckedChange={() => toggleSample(s.sample_id)}
                        />
                      </td>
                      <td className="p-1.5">
                        {thumbUrls[s.sample_id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrls[s.sample_id]}
                            alt="thumbnail"
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded" />
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs">
                        {s.sample_id.slice(0, 8)}...
                      </td>
                      <td className="p-2">{s.stroke_style}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground truncate max-w-[200px]">
                        {s.note || "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button
              onClick={handleExport}
              disabled={exporting || exportCount === 0}
            >
              <Download className="size-4 mr-2" />
              {exporting
                ? "Exporting..."
                : `Download ZIP (${exportCount} sample${exportCount !== 1 ? "s" : ""})`}
            </Button>
            {samples.length > 200 && (
              <p className="text-xs text-muted-foreground">
                Large export — this may take a moment.
              </p>
            )}
          </div>

          {exporting && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">
                {progress}%
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
