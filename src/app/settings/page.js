"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const LS_CONTRIBUTOR = "ris_contributor_id";
const LS_PEN_THICKNESS = "ris_pen_thickness";
const LS_PEN_COLOR = "ris_pen_color";

export default function SettingsPage() {
  const [contributorId, setContributorId] = useState("");
  const [penThickness, setPenThickness] = useState(4);
  const [penColor, setPenColor] = useState("#FF0000");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setContributorId(localStorage.getItem(LS_CONTRIBUTOR) || "");
    setPenThickness(Number(localStorage.getItem(LS_PEN_THICKNESS)) || 4);
    setPenColor(localStorage.getItem(LS_PEN_COLOR) || "#FF0000");
    setLoaded(true);
  }, []);

  function handleSave() {
    if (!contributorId.trim()) {
      toast.error("Contributor ID cannot be empty.");
      return;
    }
    localStorage.setItem(LS_CONTRIBUTOR, contributorId.trim());
    localStorage.setItem(LS_PEN_THICKNESS, String(penThickness));
    localStorage.setItem(LS_PEN_COLOR, penColor);
    window.dispatchEvent(new Event("ris-settings-changed"));
    toast.success("Settings saved.");
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="contributor">Contributor ID</Label>
            <Input
              id="contributor"
              placeholder='e.g. "alice"'
              value={contributorId}
              onChange={(e) => setContributorId(e.target.value)}
            />
            {!contributorId.trim() && (
              <p className="text-sm text-destructive">
                Contributor ID is required before you can save samples.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="thickness">Default Pen Thickness</Label>
            <Input
              id="thickness"
              type="number"
              min={1}
              max={50}
              value={penThickness}
              onChange={(e) => setPenThickness(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Default Pen Color</Label>
            <Input
              id="color"
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="h-10 w-20 cursor-pointer p-1"
            />
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
