import asyncio
import json
import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agents.art_direction import ArtDirectionAgent
from agents.cinematography import CinematographyAgent
from agents.sound import SoundAgent
from agents.writing import WritingAgent
from services.gpu_pipeline import GPUPipeline
from services.video_processor import VideoProcessor

app = FastAPI(title="HackToCreate API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# In-memory session store (use Redis for production)
sessions: dict = {}

# Singleton pipeline (loads model once)
_gpu_pipeline: GPUPipeline | None = None


def get_gpu_pipeline() -> GPUPipeline:
    global _gpu_pipeline
    if _gpu_pipeline is None:
        _gpu_pipeline = GPUPipeline()
    return _gpu_pipeline


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload.mp4").suffix.lower()
    file_path = UPLOAD_DIR / f"{session_id}{suffix}"

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    processor = VideoProcessor()
    metadata = await processor.extract_metadata(str(file_path))

    sessions[session_id] = {
        "file_path": str(file_path),
        "filename": file.filename,
        "metadata": metadata,
        "suffix": suffix,
    }

    return {"session_id": session_id, "filename": file.filename, "metadata": metadata}


# ---------------------------------------------------------------------------
# Session info
# ---------------------------------------------------------------------------

@app.get("/session/{session_id}")
async def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    s = sessions[session_id]
    return {"filename": s["filename"], "metadata": s["metadata"]}


# ---------------------------------------------------------------------------
# Streaming review — all 4 agents run concurrently, merged into SSE
# ---------------------------------------------------------------------------

@app.get("/review/{session_id}/stream")
async def stream_review(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    async def event_generator():
        agents_list = [
            ("writing", WritingAgent()),
            ("sound", SoundAgent()),
            ("cinematography", CinematographyAgent()),
            ("art_direction", ArtDirectionAgent()),
        ]

        queue: asyncio.Queue = asyncio.Queue()

        async def run_agent(name: str, agent):
            try:
                async for chunk in agent.analyze_stream(session):
                    await queue.put({"agent": name, "content": chunk, "done": False})
            except Exception as exc:
                await queue.put({"agent": name, "error": str(exc), "done": True})
                return
            await queue.put({"agent": name, "done": True})

        tasks = [
            asyncio.create_task(run_agent(name, agent))
            for name, agent in agents_list
        ]

        done_count = 0
        total = len(agents_list)

        while done_count < total:
            item = await queue.get()
            yield f"data: {json.dumps(item)}\n\n"
            if item.get("done"):
                done_count += 1

        await asyncio.gather(*tasks, return_exceptions=True)
        yield f"data: {json.dumps({'all_done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# GPU Generation
# ---------------------------------------------------------------------------

class GenerateVisualRequest(BaseModel):
    session_id: str
    prompt: str = ""
    strength: float = 0.75
    steps: int = 25


class GenerateVideoRequest(BaseModel):
    session_id: str
    steps: int = 25


VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


async def _resolve_image_path(session: dict) -> str:
    """Return a path to an image file — extracts a key frame if the upload is a video."""
    file_path = session["file_path"]
    suffix = Path(file_path).suffix.lower()
    if suffix in VIDEO_EXTS:
        frame_path = str(OUTPUT_DIR / f"{Path(file_path).stem}_keyframe.jpg")
        processor = VideoProcessor()
        # Extract frame at 10% into the video (avoids black intros)
        duration = session.get("metadata", {}).get("duration") or 0
        timestamp = max(0.0, duration * 0.1)
        await processor.extract_key_frame(file_path, frame_path, timestamp)
        return frame_path
    return file_path


@app.post("/generate/visual")
async def generate_visual(req: GenerateVisualRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[req.session_id]
    pipeline = get_gpu_pipeline()

    try:
        image_path = await _resolve_image_path(session)
        output_filename = f"{req.session_id}_visual.png"
        output_path = str(OUTPUT_DIR / output_filename)

        await pipeline.image_to_visual(
            input_path=image_path,
            output_path=output_path,
            prompt=req.prompt,
            strength=req.strength,
            steps=req.steps,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"filename": output_filename, "path": f"/outputs/{output_filename}"}


@app.post("/generate/video")
async def generate_video(req: GenerateVideoRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[req.session_id]
    pipeline = get_gpu_pipeline()

    try:
        image_path = await _resolve_image_path(session)
        output_filename = f"{req.session_id}_video.mp4"
        output_path = str(OUTPUT_DIR / output_filename)

        await pipeline.visual_to_video(
            input_path=image_path,
            output_path=output_path,
            steps=req.steps,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"filename": output_filename, "path": f"/outputs/{output_filename}"}


# ---------------------------------------------------------------------------
# Remix — regenerate image/video incorporating agreed notes
# ---------------------------------------------------------------------------

class RemixRequest(BaseModel):
    session_id: str
    agreed_notes: list[str] = []
    has_audio: bool = False
    steps: int = 30


def _build_remix_prompt(agreed_notes: list[str]) -> str:
    """Convert agreed production notes into a FLUX/LTX prompt."""
    if not agreed_notes:
        return ""

    # Map common note keywords to visual prompt tokens
    keyword_map = {
        "lighting": "dramatic motivated lighting, strong key light, deep shadows",
        "colour": "rich cohesive color palette, intentional color grading",
        "color": "rich cohesive color palette, intentional color grading",
        "composition": "rule of thirds, depth of field, foreground interest",
        "framing": "cinematic framing, negative space, balanced composition",
        "costume": "character-defining wardrobe, period-accurate costume",
        "prop": "detailed set dressing, story-telling props",
        "palette": "unified color palette, complementary tones",
        "movement": "motivated camera movement, fluid cinematic motion",
        "contrast": "high contrast lighting, deep blacks, luminous highlights",
        "depth": "layered depth, foreground mid-ground background separation",
        "structure": "clear narrative visual flow, strong opening frame",
    }

    prompt_tokens = set()
    for note in agreed_notes:
        note_lower = note.lower()
        for keyword, token in keyword_map.items():
            if keyword in note_lower:
                prompt_tokens.add(token)

    if not prompt_tokens:
        prompt_tokens.add("cinematic, professional production quality")

    return ", ".join(prompt_tokens)


@app.post("/remix/visual")
async def remix_visual(req: RemixRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[req.session_id]
    pipeline = get_gpu_pipeline()
    remix_prompt = _build_remix_prompt(req.agreed_notes)

    try:
        image_path = await _resolve_image_path(session)
        output_filename = f"{req.session_id}_remix_visual.png"
        output_path = str(OUTPUT_DIR / output_filename)

        await pipeline.image_to_visual(
            input_path=image_path,
            output_path=output_path,
            prompt=remix_prompt,
            strength=0.80,
            steps=req.steps,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"filename": output_filename, "agreed_notes": req.agreed_notes, "prompt_used": remix_prompt}


@app.post("/remix/video")
async def remix_video(req: RemixRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[req.session_id]
    pipeline = get_gpu_pipeline()
    remix_prompt = _build_remix_prompt(req.agreed_notes)

    try:
        image_path = await _resolve_image_path(session)
        output_filename = f"{req.session_id}_remix_video.mp4"
        output_path = str(OUTPUT_DIR / output_filename)

        # Uses LTX-2 (Lightricks/LTX-2) specifically for remix
        await pipeline.remix_video(
            input_path=image_path,
            output_path=output_path,
            prompt=remix_prompt,
            steps=req.steps,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"filename": output_filename, "agreed_notes": req.agreed_notes, "prompt_used": remix_prompt}


@app.get("/output/{filename}")
async def get_output(filename: str):
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    import torch
    return {
        "status": "ok",
        "cuda_available": torch.cuda.is_available(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none",
    }
