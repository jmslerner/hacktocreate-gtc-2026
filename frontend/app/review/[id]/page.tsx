"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import JudgeCard, { NoteVote } from "@/components/JudgeCard";
import GeneratePanel from "@/components/GeneratePanel";

interface JudgeState {
  content: string;
  status: "waiting" | "streaming" | "done" | "error";
}

interface SessionMeta {
  filename: string;
  metadata: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    file_type?: string;
    size_mb?: number;
    has_audio?: boolean;
  };
}

type AgentName = "writing" | "sound" | "cinematography" | "art_direction";

const JUDGES: { key: AgentName; label: string; role: string; color: string; borderColor: string }[] = [
  { key: "writing",        label: "Writing",        role: "Script · Story · Dialogue",  color: "text-cinema-accent",  borderColor: "border-cinema-accent"  },
  { key: "sound",          label: "Sound",           role: "Audio · Music · Mix",         color: "text-cinema-green",   borderColor: "border-cinema-green"   },
  { key: "cinematography", label: "Cinematography",  role: "Framing · Light · Color",     color: "text-cinema-blue",    borderColor: "border-cinema-blue"    },
  { key: "art_direction",  label: "Art Direction",   role: "Design · Aesthetic · Style",  color: "text-cinema-purple",  borderColor: "border-cinema-purple"  },
];

type RemixStatus = "idle" | "prompting" | "remixing" | "done" | "error";

export default function ReviewPage() {
  const params   = useParams();
  const router   = useRouter();
  const sessionId = params.id as string;

  const [session,        setSession]        = useState<SessionMeta | null>(null);
  const [judges,         setJudges]         = useState<Record<AgentName, JudgeState>>({
    writing:        { content: "", status: "waiting" },
    sound:          { content: "", status: "waiting" },
    cinematography: { content: "", status: "waiting" },
    art_direction:  { content: "", status: "waiting" },
  });
  const [reviewStarted,  setReviewStarted]  = useState(false);
  const [allDone,        setAllDone]        = useState(false);
  const [activeTab,      setActiveTab]      = useState<"review" | "generate">("review");

  // Votes from all judges
  const [votes,          setVotes]          = useState<NoteVote[]>([]);

  // Remix flow
  const [remixStatus,    setRemixStatus]    = useState<RemixStatus>("idle");
  const [remixOutput,    setRemixOutput]    = useState<{ filename: string; type: "image" | "video" } | null>(null);
  const [remixError,     setRemixError]     = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Show remix prompt once review is fully done and there are votes
  const showRemixPrompt = allDone && votes.length > 0 && remixStatus === "idle";

  useEffect(() => {
    fetch(`/api/backend/session/${sessionId}`)
      .then((r) => r.json())
      .then(setSession)
      .catch(console.error);
  }, [sessionId]);

  function startReview() {
    if (reviewStarted) return;
    setReviewStarted(true);

    setJudges((prev) => {
      const next = { ...prev };
      (Object.keys(next) as AgentName[]).forEach((k) => {
        next[k] = { content: "", status: "streaming" };
      });
      return next;
    });

    const es = new EventSource(`/api/backend/review/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.all_done) { setAllDone(true); es.close(); return; }
      if (data.agent && data.done) {
        setJudges((prev) => ({ ...prev, [data.agent]: { ...prev[data.agent as AgentName], status: "done" } }));
        return;
      }
      if (data.agent && data.content) {
        setJudges((prev) => ({
          ...prev,
          [data.agent]: { content: prev[data.agent as AgentName].content + data.content, status: "streaming" },
        }));
      }
      if (data.agent && data.error) {
        setJudges((prev) => ({ ...prev, [data.agent]: { content: data.error, status: "error" } }));
      }
    };

    es.onerror = () => es.close();
  }

  useEffect(() => () => eventSourceRef.current?.close(), []);

  function handleNoteVote(vote: NoteVote) {
    setVotes((prev) => {
      // Replace existing vote for same note
      const filtered = prev.filter((v) => !(v.judgeLabel === vote.judgeLabel && v.noteText === vote.noteText));
      return [...filtered, vote];
    });
  }

  async function handleRemix() {
    setRemixStatus("remixing");
    setRemixError(null);

    const agreedNotes  = votes.filter((v) => v.vote === "agree").map((v) => `[${v.judgeLabel}] ${v.noteText}`);
    const hasAudio     = session?.metadata?.has_audio ?? false;
    const isVideo      = session?.metadata?.file_type !== "png" && session?.metadata?.file_type !== "jpg" && session?.metadata?.file_type !== "jpeg";

    try {
      const endpoint = isVideo ? "remix/video" : "remix/visual";
      const res = await fetch(`/api/backend/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          agreed_notes: agreedNotes,
          has_audio: hasAudio,
        }),
      });

      const text = await res.text();
      let data: { filename?: string; detail?: string };
      try { data = JSON.parse(text); } catch { throw new Error(text || "Remix failed"); }

      if (!res.ok) throw new Error(data.detail || "Remix failed");

      setRemixOutput({ filename: data.filename!, type: isVideo ? "video" : "image" });
      setRemixStatus("done");
    } catch (err: unknown) {
      setRemixError(err instanceof Error ? err.message : "Remix failed");
      setRemixStatus("error");
    }
  }

  function declineRemix() {
    setRemixStatus("idle");
    setVotes([]);
  }

  const agreedCount   = votes.filter((v) => v.vote === "agree").length;
  const disagreedCount = votes.filter((v) => v.vote === "disagree").length;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Session header */}
      <div className="border-b border-cinema-border bg-cinema-dark px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <button onClick={() => router.push("/")} className="text-cinema-muted hover:text-cinema-text text-xs font-mono mb-1 flex items-center gap-1 transition-colors">
              ← New Upload
            </button>
            <h2 className="text-lg font-semibold text-cinema-text truncate max-w-md">{session?.filename ?? "Loading…"}</h2>
            {session?.metadata && (
              <p className="text-cinema-muted text-xs font-mono mt-0.5">
                {session.metadata.file_type?.toUpperCase()}
                {session.metadata.duration && ` · ${session.metadata.duration.toFixed(1)}s`}
                {session.metadata.width && ` · ${session.metadata.width}×${session.metadata.height}`}
                {session.metadata.fps && ` · ${session.metadata.fps}fps`}
                {session.metadata.size_mb && ` · ${session.metadata.size_mb.toFixed(1)}MB`}
                {session.metadata.has_audio && ` · 🔊 Audio`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-cinema-card border border-cinema-border rounded-lg overflow-hidden">
              {(["review", "generate"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                    activeTab === tab ? "bg-cinema-accent text-cinema-black font-semibold" : "text-cinema-muted hover:text-cinema-text"
                  }`}>{tab}</button>
              ))}
            </div>
            {!reviewStarted && activeTab === "review" && (
              <button onClick={startReview} className="px-5 py-2 bg-cinema-accent text-cinema-black font-semibold text-sm rounded-lg hover:bg-yellow-400 transition-colors">
                Start Review
              </button>
            )}
            {reviewStarted && !allDone && (
              <div className="flex items-center gap-2 text-cinema-muted text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-cinema-accent animate-pulse" /> Reviewing…
              </div>
            )}

            {/* Remix controls — shown in header once review is done */}
            {allDone && remixStatus === "idle" && votes.length === 0 && (
              <div className="flex items-center gap-2 text-cinema-green text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-cinema-green" /> Review Complete
              </div>
            )}
            {showRemixPrompt && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-cinema-text text-xs font-mono hidden sm:block">
                  Wanna remix? <span className="text-cinema-accent">{agreedCount} note{agreedCount !== 1 ? "s" : ""} agreed</span>
                </span>
                <button onClick={handleRemix}
                  className="px-4 py-2 bg-cinema-accent text-cinema-black font-bold text-xs rounded-lg hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95">
                  Yes, remix it 🎬
                </button>
                <button onClick={declineRemix}
                  className="px-3 py-2 border border-cinema-border text-cinema-muted text-xs font-mono rounded-lg hover:border-cinema-muted transition-colors">
                  Not yet
                </button>
              </div>
            )}
            {remixStatus === "remixing" && (
              <div className="flex items-center gap-2 text-cinema-accent text-xs font-mono animate-fade-in">
                <div className="w-4 h-4 border-2 border-cinema-accent border-t-transparent rounded-full animate-spin" />
                Remixing on GB10…
              </div>
            )}
            {remixStatus === "done" && remixOutput && (
              <div className="flex items-center gap-2 animate-fade-in">
                <div className="flex items-center gap-1.5 text-cinema-green text-xs font-mono">
                  <div className="w-2 h-2 rounded-full bg-cinema-green" /> Remix ready
                </div>
                <a href={`/api/backend/output/${remixOutput.filename}`} download
                  className="px-3 py-1.5 border border-cinema-accent text-cinema-accent text-xs font-mono rounded-lg hover:bg-cinema-accent/10 transition-colors">
                  Download
                </a>
                <button onClick={() => { setRemixStatus("idle"); setRemixOutput(null); setVotes([]); }}
                  className="text-cinema-muted text-xs font-mono hover:text-cinema-text transition-colors">
                  Again
                </button>
              </div>
            )}
            {remixStatus === "error" && (
              <div className="flex items-center gap-2">
                <span className="text-cinema-red text-xs font-mono">Remix failed</span>
                <button onClick={() => setRemixStatus("idle")} className="text-cinema-muted text-xs font-mono hover:text-cinema-text underline">
                  retry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">

        {activeTab === "review" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {JUDGES.map((judge) => (
                <JudgeCard
                  key={judge.key}
                  label={judge.label}
                  role={judge.role}
                  color={judge.color}
                  borderColor={judge.borderColor}
                  state={judges[judge.key]}
                  reviewStarted={reviewStarted}
                  onNoteVote={handleNoteVote}
                />
              ))}
            </div>

            {/* Vote tally */}
            {votes.length > 0 && remixStatus === "idle" && (
              <div className="mt-4 flex items-center gap-4 text-xs font-mono text-cinema-muted animate-fade-in">
                {agreedCount > 0    && <span className="text-cinema-green">✓ {agreedCount} agreed</span>}
                {disagreedCount > 0 && <span className="text-cinema-red">✗ {disagreedCount} dismissed</span>}
              </div>
            )}

            {/* ── Remix output ── */}
            {remixStatus === "done" && remixOutput && (
              <RemixResult
                output={remixOutput}
                agreedCount={agreedCount}
                onRemixAgain={() => { setRemixStatus("idle"); setRemixOutput(null); setVotes([]); }}
              />
            )}
          </>
        )}

        {activeTab === "generate" && <GeneratePanel sessionId={sessionId} />}
      </div>
    </div>
  );
}

// ── Remix Result ──────────────────────────────────────────────────────────────

function RemixResult({
  output,
  agreedCount,
  onRemixAgain,
}: {
  output: { filename: string; type: "image" | "video" };
  agreedCount: number;
  onRemixAgain: () => void;
}) {
  const fileUrl = `/api/backend/output/${output.filename}`;
  const remixRef = useRef<HTMLDivElement>(null);

  // Scroll into view when result appears
  useEffect(() => {
    remixRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div ref={remixRef} className="mt-8 animate-slide-up">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-cinema-green font-semibold text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cinema-green inline-block" />
            Remix Complete
          </h3>
          <p className="text-cinema-muted text-xs font-mono mt-0.5">
            {agreedCount} note{agreedCount !== 1 ? "s" : ""} applied · LTX-2 · Dell GB10
          </p>
        </div>
        <button
          onClick={onRemixAgain}
          className="text-cinema-muted text-xs font-mono hover:text-cinema-text transition-colors border border-cinema-border px-3 py-1.5 rounded-lg"
        >
          Remix Again
        </button>
      </div>

      {/* Preview */}
      <div className="bg-cinema-black rounded-xl border border-cinema-green overflow-hidden">
        {output.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt="Remixed visual"
            className="w-full object-contain max-h-[600px]"
          />
        ) : (
          <video
            src={fileUrl}
            controls
            autoPlay
            loop
            className="w-full max-h-[600px]"
          />
        )}
      </div>

      {/* Action bar */}
      <div className="mt-3 flex items-center gap-3">
        <a
          href={fileUrl}
          download={output.filename}
          className="flex items-center gap-2 px-5 py-2.5 bg-cinema-accent text-cinema-black font-bold text-sm rounded-lg hover:bg-yellow-400 transition-all hover:scale-105 active:scale-95"
        >
          <DownloadIcon />
          Download Remix
        </a>
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 border border-cinema-border text-cinema-text text-sm font-mono rounded-lg hover:border-cinema-muted transition-colors"
        >
          <ExternalIcon />
          Open in New Tab
        </a>
        <span className="text-cinema-muted text-xs font-mono ml-auto">{output.filename}</span>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

