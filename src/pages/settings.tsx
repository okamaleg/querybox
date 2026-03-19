import { useState } from "react";
import { Loader2, Eye, EyeOff, ShieldCheck, ShieldOff } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, updateSettings } = useAppState();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    setSaving(true);
    await updateSettings({ api_key: apiKey });
    setSaving(false);
    setSaved(true);
    setApiKey("");
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleToggleSafety() {
    await updateSettings({ safety_mode: !settings.safety_mode });
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-8">
      {/* API Key */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Anthropic API Key</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {settings.has_api_key
              ? "An API key is stored. Enter a new one to replace it."
              : "Enter your Anthropic API key to enable AI features."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key" className="text-sm text-zinc-300">
            API Key
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                placeholder={settings.has_api_key ? "sk-ant-••••••••" : "sk-ant-..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim() || saving}
              className="bg-zinc-100 text-zinc-900 hover:bg-white shrink-0"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? "Saved!" : "Save"}
            </Button>
          </div>
        </div>
      </section>

      {/* Safety Mode */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Safety Mode</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            When enabled, only read-only queries are allowed.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleSafety}
          className={cn(
            "flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-sm transition-colors text-left",
            settings.safety_mode
              ? "border-amber-600/40 bg-amber-950/30 text-amber-400"
              : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
          )}
        >
          {settings.safety_mode ? (
            <ShieldCheck className="h-5 w-5 shrink-0" />
          ) : (
            <ShieldOff className="h-5 w-5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {settings.safety_mode ? "Safety Mode On" : "Safety Mode Off"}
            </p>
            <p className="text-xs mt-0.5 text-zinc-500">
              {settings.safety_mode
                ? "Only SELECT queries allowed."
                : "All queries including writes are allowed."}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex h-5 w-9 items-center rounded-full border-2 transition-colors shrink-0",
              settings.safety_mode
                ? "bg-amber-500 border-amber-500"
                : "bg-zinc-700 border-zinc-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                settings.safety_mode ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </span>
        </button>
      </section>
    </div>
  );
}
