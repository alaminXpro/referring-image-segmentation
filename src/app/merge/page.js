"use client";

import { useState, useRef } from "react";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { validateZip, mergeZips } from "@/lib/zipMerge";
import { Upload, Merge, CheckCircle, XCircle } from "lucide-react";

export default function MergePage() {
  const fileInputRef = useRef(null);
  const [zipInfos, setZipInfos] = useState([]);
  const [deduplicate, setDeduplicate] = useState(true);
  const [validating, setValidating] = useState(false);
  const [merging, setMerging] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [log, setLog] = useState([]);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setValidating(true);
    setZipInfos([]);
    setLog([]);

    const infos = [];
    for (const file of files) {
      const result = await validateZip(file);
      infos.push({
        file,
        name: file.name,
        valid: result.valid,
        exportMeta: result.exportMeta,
        sampleCount: result.sampleCount,
        errors: result.errors,
      });
    }

    setZipInfos(infos);
    setValidating(false);

    const validCount = infos.filter((i) => i.valid).length;
    if (validCount === 0) {
      toast.error("No valid ZIPs found.");
    } else {
      toast.success(`${validCount} of ${infos.length} ZIP(s) valid.`);
    }
  }

  const validZips = zipInfos.filter((i) => i.valid);
  const totalSamples = validZips.reduce((sum, i) => sum + i.sampleCount, 0);

  async function handleMerge() {
    if (validZips.length === 0) return;

    setMerging(true);
    setProgressPct(0);
    setProgressMsg("Starting merge...");
    setLog([]);

    try {
      const { blob, stats } = await mergeZips(
        validZips.map((i) => i.file),
        { deduplicate },
        ({ current, total, message }) => {
          setProgressMsg(message);
          setProgressPct(Math.round((current / total) * 100));
        }
      );

      const logLines = [`Total samples in merged ZIP: ${stats.total}`];
      if (stats.duplicatesSkipped > 0) {
        logLines.push(`Duplicates skipped: ${stats.duplicatesSkipped}`);
      }
      if (stats.errors.length > 0) {
        logLines.push(`Errors: ${stats.errors.length}`);
        stats.errors.forEach((e) => logLines.push(`  - ${e}`));
      }
      setLog(logLines);

      const date = new Date().toISOString().slice(0, 10);
      saveAs(blob, `RIS_MERGED_${date}.zip`);
      toast.success(`Merged ${stats.total} samples.`);
    } catch (err) {
      toast.error("Merge failed: " + err.message);
    } finally {
      setMerging(false);
      setProgressMsg("");
      setProgressPct(0);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Merge ZIPs</h1>
        <p className="text-sm text-muted-foreground">
          Upload multiple RIS export ZIPs to merge them into one dataset.
        </p>
      </div>

      {/* File input */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip"
          onChange={handleFilesSelected}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={validating || merging}
        >
          <Upload className="size-4 mr-2" />
          {validating ? "Validating..." : "Select ZIP Files"}
        </Button>
      </div>

      {/* Validation results table */}
      {zipInfos.length > 0 && (
        <div className="border rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-2 text-left">File</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left hidden sm:table-cell">Contributor</th>
                <th className="p-2 text-left">Samples</th>
              </tr>
            </thead>
            <tbody>
              {zipInfos.map((info, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs truncate max-w-[200px]">
                    {info.name}
                  </td>
                  <td className="p-2">
                    {info.valid ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600"
                      >
                        <CheckCircle className="size-3 mr-1" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="size-3 mr-1" />
                        Invalid
                      </Badge>
                    )}
                  </td>
                  <td className="p-2 text-xs hidden sm:table-cell">
                    {info.exportMeta?.contributor_id || "\u2014"}
                  </td>
                  <td className="p-2 text-xs">{info.sampleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Show errors for invalid ZIPs */}
          {zipInfos
            .filter((i) => !i.valid)
            .map((info, idx) => (
              <div key={idx} className="border-t p-2 bg-destructive/5 text-xs">
                <strong>{info.name}</strong>:{" "}
                {info.errors.join("; ")}
              </div>
            ))}
        </div>
      )}

      {/* Merge controls */}
      {validZips.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="deduplicate"
              checked={deduplicate}
              onCheckedChange={setDeduplicate}
            />
            <label htmlFor="deduplicate" className="text-sm cursor-pointer">
              Deduplicate by sample_id
            </label>
          </div>

          <div>
            <Button onClick={handleMerge} disabled={merging}>
              <Merge className="size-4 mr-2 shrink-0" />
              {merging
                ? "Merging..."
                : `Merge & Download (${totalSamples} samples)`}
            </Button>
          </div>

          {merging && (
            <div className="space-y-1">
              <Progress value={progressPct} />
              <p className="text-xs text-muted-foreground text-center">
                {progressMsg}
              </p>
            </div>
          )}
        </>
      )}

      {/* Log output */}
      {log.length > 0 && (
        <div className="border rounded-md bg-muted/30 p-3">
          <p className="text-xs font-semibold mb-1">Merge Log</p>
          {log.map((line, i) => (
            <p key={i} className="text-xs font-mono text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
