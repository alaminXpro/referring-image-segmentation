"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const LS_CONTRIBUTOR = "ris_contributor_id";
const LS_PEN_THICKNESS = "ris_pen_thickness";
const LS_PEN_COLOR = "ris_pen_color";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    contributorId: "",
    penThickness: 4,
    penColor: "#FF0000",
  });
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings({
        contributorId: localStorage.getItem(LS_CONTRIBUTOR) || "",
        penThickness: Number(localStorage.getItem(LS_PEN_THICKNESS)) || 4,
        penColor: localStorage.getItem(LS_PEN_COLOR) || "#FF0000",
      });
    }
  }, []);

  function handleSave() {
    if (!settings.contributorId.trim()) {
      toast.error("Contributor ID cannot be empty.");
      return;
    }
    localStorage.setItem(LS_CONTRIBUTOR, settings.contributorId.trim());
    localStorage.setItem(LS_PEN_THICKNESS, String(settings.penThickness));
    localStorage.setItem(LS_PEN_COLOR, settings.penColor);
    window.dispatchEvent(new Event("ris-settings-changed"));
    toast.success("Settings saved.");
  }

  return (
    <div className="mx-auto max-w-lg">
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
              value={settings.contributorId}
              onChange={(e) => setSettings({ ...settings, contributorId: e.target.value })}
            />
            {!settings.contributorId.trim() && (
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
              value={settings.penThickness}
              onChange={(e) => setSettings({ ...settings, penThickness: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Default Pen Color</Label>
            <Input
              id="color"
              type="color"
              value={settings.penColor}
              onChange={(e) => setSettings({ ...settings, penColor: e.target.value })}
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
