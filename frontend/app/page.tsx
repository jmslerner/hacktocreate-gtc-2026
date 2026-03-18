"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";

export default function Home() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/backend/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Upload failed");
      }

      const data = await res.json();
      router.push(`/review/${data.session_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed. Is the backend running?";
      setError(message);
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-12 animate-fade-in">
        <p className="text-cinema-muted font-mono text-xs tracking-widest uppercase mb-4">
          Dell GB10 · AI Production Panel · FLUX · LTX-Video
        </p>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 leading-none">
          Your AI{" "}
          <span className="text-cinema-accent">Production</span>
          <br />
          Company
        </h1>
        <p className="text-cinema-muted text-lg max-w-xl mx-auto leading-relaxed">
          Upload your short film, video, or image. Four specialist AI judges
          will review your work — writing, sound, cinematography, and art
          direction — in real time.
        </p>
      </div>

      {/* Upload zone */}
      <div className="w-full max-w-2xl animate-slide-up">
        <UploadZone onUpload={handleUpload} isUploading={isUploading} />
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 bg-cinema-red/10 border border-cinema-red/30 rounded-lg text-cinema-red text-sm font-mono max-w-2xl w-full">
          {error}
        </div>
      )}

      {/* Judge cards preview */}
      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl w-full animate-fade-in">
        {[
          { label: "Writing", role: "Script · Story · Dialogue", color: "text-cinema-accent", dot: "bg-cinema-accent" },
          { label: "Sound", role: "Audio · Music · Mix", color: "text-cinema-green", dot: "bg-cinema-green" },
          { label: "Cinematography", role: "Framing · Light · Color", color: "text-cinema-blue", dot: "bg-cinema-blue" },
          { label: "Art Direction", role: "Design · Aesthetic · Style", color: "text-cinema-purple", dot: "bg-cinema-purple" },
        ].map((judge) => (
          <div
            key={judge.label}
            className="bg-cinema-card border border-cinema-border rounded-lg p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${judge.dot}`} />
              <span className={`font-semibold text-sm ${judge.color}`}>{judge.label}</span>
            </div>
            <p className="text-cinema-muted text-xs font-mono">{judge.role}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-cinema-muted text-xs font-mono">
        Supports MP4, MOV, AVI, MKV, JPG, PNG · Max 500MB
      </p>
    </div>
  );
}
