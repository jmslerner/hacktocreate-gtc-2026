"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

const ACCEPTED_TYPES: Record<string, string[]> = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/x-msvideo": [".avi"],
  "video/x-matroska": [".mkv"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
};

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

interface Props {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export default function UploadZone({ onUpload, isUploading }: Props) {
  const [dragError, setDragError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: { file: File; errors: { message: string }[] }[]) => {
      setDragError(null);
      if (rejected.length > 0) {
        const err = rejected[0].errors[0];
        setDragError(err.message.includes("size") ? "File too large (max 500MB)" : "Unsupported format");
        return;
      }
      if (accepted.length > 0) {
        onUpload(accepted[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-all duration-300 group
        ${isDragActive
          ? "border-cinema-accent bg-cinema-accent/5 scale-[1.01]"
          : "border-cinema-border bg-cinema-card hover:border-cinema-accent/50 hover:bg-cinema-accent/5"
        }
        ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} />

      {/* Icon */}
      <div className="flex justify-center mb-4">
        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-colors
          ${isDragActive ? "border-cinema-accent text-cinema-accent" : "border-cinema-border text-cinema-muted group-hover:border-cinema-accent/50"}`}>
          {isUploading ? (
            <Spinner />
          ) : isDragActive ? (
            <FilmIcon />
          ) : (
            <UploadIcon />
          )}
        </div>
      </div>

      {/* Text */}
      {isUploading ? (
        <div>
          <p className="text-cinema-accent font-semibold text-lg mb-1">Uploading…</p>
          <p className="text-cinema-muted text-sm font-mono">Sending to production pipeline</p>
        </div>
      ) : isDragActive ? (
        <div>
          <p className="text-cinema-accent font-semibold text-lg mb-1">Drop to submit</p>
          <p className="text-cinema-muted text-sm font-mono">Your film is ready for the panel</p>
        </div>
      ) : (
        <div>
          <p className="text-cinema-text font-semibold text-lg mb-1">
            Drag & drop your film here
          </p>
          <p className="text-cinema-muted text-sm mb-4">or click to browse files</p>
          <div className="flex flex-wrap justify-center gap-2">
            {["MP4", "MOV", "AVI", "MKV", "JPG", "PNG"].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 bg-cinema-border/30 text-cinema-muted text-xs font-mono rounded"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>
      )}

      {dragError && (
        <p className="mt-3 text-cinema-red text-sm font-mono">{dragError}</p>
      )}

      {/* Corner decorations (film frame aesthetic) */}
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cinema-border rounded-tl" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cinema-border rounded-tr" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cinema-border rounded-bl" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cinema-border rounded-br" />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function FilmIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.875v1.5m1.5-3.75C19.496 5.004 19 4.5 18.375 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-7 h-7 animate-spin text-cinema-accent" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
