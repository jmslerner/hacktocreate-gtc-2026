"use client";

import { useState } from "react";

interface Props {
  sessionId: string;
}

type Mode = "image-to-visual" | "visual-to-video";
type Status = "idle" | "generating" | "done" | "error";

export default function GeneratePanel({ sessionId }: Props) {
  const [mode, setMode] = useState<Mode>("image-to-visual");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.75);
  const [steps, setSteps] = useState(25);

  async function handleGenerate() {
    setStatus("generating");
    setOutputUrl(null);
    setErrorMsg(null);

    const endpoint = mode === "image-to-visual" ? "generate/visual" : "generate/video";

    try {
      const res = await fetch(`/api/backend/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          prompt: prompt || undefined,
          strength,
          steps,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let detail = "Generation failed";
        try { detail = JSON.parse(text).detail ?? detail; } catch {}
        throw new Error(detail);
      }

      const data = await res.json();
      setOutputUrl(`/api/backend/output/${data.filename}`);
      setStatus("done");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setErrorMsg(message);
      setStatus("error");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-cinema-text mb-1">GPU Generation Studio</h3>
        <p className="text-cinema-muted text-sm font-mono">
          Powered by Dell GB10 · FLUX.1-dev · LTX-Video
        </p>
      </div>

      {/* Mode selector */}
      <div className="bg-cinema-card border border-cinema-border rounded-xl p-4 space-y-4">
        <div className="flex gap-3">
          {(["image-to-visual", "visual-to-video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setStatus("idle"); setOutputUrl(null); }}
              className={`flex-1 py-3 px-4 rounded-lg border text-sm font-mono transition-all ${
                mode === m
                  ? "border-cinema-accent bg-cinema-accent/10 text-cinema-accent"
                  : "border-cinema-border text-cinema-muted hover:border-cinema-muted"
              }`}
            >
              <div className="font-semibold mb-0.5">
                {m === "image-to-visual" ? "Image → Visual" : "Visual → Video"}
              </div>
              <div className="text-[11px] opacity-70">
                {m === "image-to-visual"
                  ? "Generate concept art from key frame"
                  : "Animate image into a video clip"}
              </div>
            </button>
          ))}
        </div>

        {/* Prompt */}
        {mode === "image-to-visual" && (
          <div>
            <label className="block text-xs font-mono text-cinema-muted uppercase tracking-wider mb-2">
              Style Prompt (optional)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="cinematic lighting, film noir, golden hour, anamorphic lens..."
              className="w-full bg-cinema-black border border-cinema-border rounded-lg px-3 py-2 text-cinema-text text-sm font-mono placeholder:text-cinema-muted/50 focus:outline-none focus:border-cinema-accent transition-colors resize-none"
              rows={3}
            />
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          <SliderControl
            label="Strength"
            value={strength}
            min={0.3}
            max={1.0}
            step={0.05}
            onChange={setStrength}
            format={(v) => v.toFixed(2)}
          />
          <SliderControl
            label="Steps"
            value={steps}
            min={10}
            max={50}
            step={5}
            onChange={setSteps}
            format={(v) => String(v)}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={status === "generating"}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
            status === "generating"
              ? "bg-cinema-border text-cinema-muted cursor-not-allowed"
              : "bg-cinema-accent text-cinema-black hover:bg-yellow-400"
          }`}
        >
          {status === "generating" ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner /> Generating on GB10 GPU…
            </span>
          ) : mode === "image-to-visual" ? (
            "Generate Visual Concept"
          ) : (
            "Animate to Video"
          )}
        </button>
      </div>

      {/* Output */}
      {status === "generating" && (
        <div className="bg-cinema-card border border-cinema-border rounded-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 border-2 border-cinema-accent border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-cinema-accent font-mono text-sm">Running inference on GB10…</p>
          <p className="text-cinema-muted text-xs font-mono mt-1">This may take 10–60 seconds depending on the model</p>
        </div>
      )}

      {status === "done" && outputUrl && (
        <div className="bg-cinema-card border border-cinema-green rounded-xl overflow-hidden animate-slide-up">
          <div className="px-4 py-2 border-b border-cinema-border flex items-center justify-between">
            <span className="text-cinema-green text-xs font-mono uppercase tracking-wider">Output</span>
            <a
              href={outputUrl}
              download
              className="text-cinema-accent text-xs font-mono hover:underline"
            >
              Download
            </a>
          </div>
          {mode === "image-to-visual" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={outputUrl} alt="Generated visual" className="w-full object-contain max-h-[500px]" />
          ) : (
            <video src={outputUrl} controls className="w-full max-h-[500px]" />
          )}
        </div>
      )}

      {status === "error" && errorMsg && (
        <div className="bg-cinema-red/10 border border-cinema-red/30 rounded-xl p-4 text-cinema-red text-sm font-mono">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function SliderControl({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs font-mono text-cinema-muted uppercase tracking-wider">{label}</label>
        <span className="text-xs font-mono text-cinema-accent">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-yellow-400"
      />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
