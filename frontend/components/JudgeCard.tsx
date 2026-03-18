"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface JudgeState {
  content: string;
  status: "waiting" | "streaming" | "done" | "error";
}

export interface NoteVote {
  judgeLabel: string;
  noteText: string;
  vote: "agree" | "disagree";
}

interface Props {
  label: string;
  role: string;
  color: string;
  borderColor: string;
  state: JudgeState;
  reviewStarted: boolean;
  onNoteVote: (vote: NoteVote) => void;
}

const CHARS_PER_TICK = 4;
const TICK_MS = 16;

/** Extract numbered notes from after the --- divider */
function parseNotes(content: string): string[] {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 2) return [];
  const notesSection = parts[parts.length - 1];
  return notesSection
    .split("\n")
    .filter((l) => /^\d+\./.test(l.trim()))
    .map((l) => l.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

/** Split content into main review and notes section */
function splitContent(content: string): { main: string; notesRaw: string } {
  const idx = content.search(/^---\s*$/m);
  if (idx === -1) return { main: content, notesRaw: "" };
  return { main: content.slice(0, idx).trim(), notesRaw: content.slice(idx).trim() };
}

export default function JudgeCard({ label, role, color, borderColor, state, reviewStarted, onNoteVote }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const posRef    = useRef(0);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayed, setDisplayed]   = useState("");
  const [votes, setVotes]           = useState<Record<number, "agree" | "disagree">>({});

  // Reset on new review
  useEffect(() => {
    if (state.content === "") {
      posRef.current = 0;
      setDisplayed("");
      setVotes({});
    }
  }, [state.content]);

  // Typewriter
  useEffect(() => {
    if (!state.content || posRef.current >= state.content.length) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (posRef.current >= state.content.length) {
        clearInterval(timerRef.current!);
        return;
      }
      posRef.current = Math.min(posRef.current + CHARS_PER_TICK, state.content.length);
      setDisplayed(state.content.slice(0, posRef.current));
    }, TICK_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.content]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayed]);

  const isTyping = displayed.length < state.content.length && state.content.length > 0;
  const isActive = state.status === "streaming";
  const isDone   = state.status === "done";
  const isError  = state.status === "error";
  const renderMD = isDone && !isTyping && displayed.length > 0;

  const notes = renderMD ? parseNotes(displayed) : [];
  const { main } = renderMD ? splitContent(displayed) : { main: displayed };

  function handleVote(idx: number, note: string, vote: "agree" | "disagree") {
    setVotes((prev) => ({ ...prev, [idx]: vote }));
    onNoteVote({ judgeLabel: label, noteText: note, vote });
  }

  return (
    <div
      className={`
        bg-cinema-card rounded-xl border transition-all duration-300 flex flex-col overflow-hidden
        ${isActive ? `${borderColor} judge-active` : "border-cinema-border"}
        ${isDone && !isTyping ? `${borderColor} opacity-90` : ""}
        ${isError ? "border-cinema-red" : ""}
      `}
      style={{ minHeight: "360px", maxHeight: "520px" }}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${isActive ? "border-current/20" : "border-cinema-border"}`}>
        <div className="flex items-center gap-2">
          <StatusDot status={state.status} isTyping={isTyping} color={color} />
          <span className={`font-semibold text-sm ${color}`}>{label}</span>
          <span className="text-cinema-muted text-xs font-mono">{role}</span>
        </div>
        <StatusBadge status={state.status} isTyping={isTyping} reviewStarted={reviewStarted} />
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" style={{ scrollBehavior: "auto" }}>
        {/* Waiting */}
        {!reviewStarted && (
          <div className="h-full flex items-center justify-center">
            <p className="text-cinema-muted text-sm font-mono text-center">
              Press <span className="text-cinema-accent">Start Review</span> to convene the panel
            </p>
          </div>
        )}

        {/* Connecting */}
        {reviewStarted && state.status === "streaming" && state.content === "" && (
          <div className="flex items-center gap-2 text-cinema-muted text-sm font-mono">
            <span className={`inline-block w-2 h-4 ${color.replace("text-", "bg-")} animate-typing`} />
            <span>Analyzing your work…</span>
          </div>
        )}

        {/* Typewriter plain text */}
        {displayed && !renderMD && (
          <div className="font-mono text-cinema-text/90" style={{ fontSize: "0.78rem", lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {displayed}
            <span className={`inline-block w-[2px] h-[1em] ml-[1px] align-middle ${color.replace("text-", "bg-")} animate-typing`} style={{ verticalAlign: "text-bottom" }} />
          </div>
        )}

        {/* Rendered markdown (main review body) */}
        {renderMD && (
          <div className="animate-fade-in">
            <div className={`prose prose-sm max-w-none ${isError ? "text-cinema-red" : "text-cinema-text"}`} style={{ fontSize: "0.82rem", lineHeight: "1.6" }}>
              <ReactMarkdown components={mdComponents(color)}>{main}</ReactMarkdown>
            </div>

            {/* Notes with agree/disagree */}
            {notes.length > 0 && (
              <div className="mt-4 border-t border-cinema-border pt-4 space-y-3">
                <p className={`text-[10px] font-mono uppercase tracking-widest ${color} mb-2`}>Director's Notes — Your Call</p>
                {notes.map((note, idx) => {
                  const v = votes[idx];
                  // Strip markdown bold markers for display
                  const display = note.replace(/\*\*/g, "");
                  return (
                    <div key={idx} className={`rounded-lg border p-3 transition-all duration-200 ${
                      v === "agree"    ? "border-cinema-green bg-cinema-green/5" :
                      v === "disagree" ? "border-cinema-red bg-cinema-red/5" :
                      "border-cinema-border bg-cinema-black/30"
                    }`}>
                      <p className="text-cinema-text/90 text-xs leading-relaxed mb-2">{display}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVote(idx, display, "agree")}
                          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                            v === "agree"
                              ? "bg-cinema-green text-black"
                              : "border border-cinema-green/40 text-cinema-green hover:bg-cinema-green/10"
                          }`}
                        >
                          <ThumbUp /> Agree
                        </button>
                        <button
                          onClick={() => handleVote(idx, display, "disagree")}
                          className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                            v === "disagree"
                              ? "bg-cinema-red text-white"
                              : "border border-cinema-red/40 text-cinema-red hover:bg-cinema-red/10"
                          }`}
                        >
                          <ThumbDown /> Disagree
                        </button>
                        {v && (
                          <span className="text-cinema-muted text-[10px] font-mono ml-1">
                            {v === "agree" ? "✓ noted" : "✗ skipped"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Shared markdown component config
function mdComponents(color: string) {
  return {
    h1: ({ children }: { children: React.ReactNode }) => <h1 className="text-base font-bold text-cinema-text mb-2 mt-3">{children}</h1>,
    h2: ({ children }: { children: React.ReactNode }) => <h2 className="text-sm font-semibold text-cinema-text mb-1 mt-3">{children}</h2>,
    h3: ({ children }: { children: React.ReactNode }) => <h3 className={`text-xs font-semibold uppercase tracking-wider mb-1 mt-2 ${color}`}>{children}</h3>,
    p:  ({ children }: { children: React.ReactNode }) => <p className="text-cinema-text/90 mb-2">{children}</p>,
    ul: ({ children }: { children: React.ReactNode }) => <ul className="space-y-1 mb-2 pl-3">{children}</ul>,
    li: ({ children }: { children: React.ReactNode }) => <li className="text-cinema-text/80 list-disc list-inside">{children}</li>,
    strong: ({ children }: { children: React.ReactNode }) => <strong className={`font-semibold ${color}`}>{children}</strong>,
    em: ({ children }: { children: React.ReactNode }) => <em className="text-cinema-muted italic">{children}</em>,
    code: ({ children }: { children: React.ReactNode }) => <code className="bg-cinema-border/30 text-cinema-accent px-1 rounded font-mono text-xs">{children}</code>,
  };
}

function StatusDot({ status, isTyping, color }: { status: JudgeState["status"]; isTyping: boolean; color: string }) {
  const bg = color.replace("text-", "bg-");
  if (status === "streaming" || isTyping) return <div className={`w-2 h-2 rounded-full ${bg} animate-pulse`} />;
  if (status === "done")  return <div className={`w-2 h-2 rounded-full ${bg}`} />;
  if (status === "error") return <div className="w-2 h-2 rounded-full bg-cinema-red" />;
  return <div className="w-2 h-2 rounded-full bg-cinema-border" />;
}

function StatusBadge({ status, isTyping, reviewStarted }: { status: JudgeState["status"]; isTyping: boolean; reviewStarted: boolean }) {
  if (!reviewStarted) return null;
  if (status === "streaming" || isTyping)
    return <span className="text-[10px] font-mono border px-1.5 py-0.5 rounded text-cinema-accent border-cinema-accent animate-pulse">TYPING</span>;
  const map: Record<JudgeState["status"], { label: string; cls: string }> = {
    waiting:   { label: "QUEUED", cls: "text-cinema-muted border-cinema-border" },
    streaming: { label: "LIVE",   cls: "text-cinema-accent border-cinema-accent" },
    done:      { label: "DONE",   cls: "text-cinema-green border-cinema-green" },
    error:     { label: "ERROR",  cls: "text-cinema-red border-cinema-red" },
  };
  const { label, cls } = map[status];
  return <span className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
}

function ThumbUp() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017a2 2 0 01-1.415-.586l-3.096-3.096A2 2 0 016.22 15.9V13a2 2 0 012-2h2.764l.667-3A1 1 0 0112.626 7L14 10z" />
    </svg>
  );
}

function ThumbDown() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 011.414.586l3.096 3.096A2 2 0 0118.78 8.1V11a2 2 0 01-2 2h-2.764l-.667 3A1 1 0 0112.374 17L10 14z" />
    </svg>
  );
}
