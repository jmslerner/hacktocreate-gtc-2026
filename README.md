# HackToCreate — GTC 2026

> AI Production Company Panel for video creators and short film makers.
> Powered by Dell GB10 GPU + RAG Agent @ `http://10.1.96.117`

---

## What it does

Upload a video or image and get real-time feedback from 4 specialist AI judge agents:

| Judge | Covers |
|-------|--------|
| **Writing** | Script, story structure, dialogue, theme |
| **Sound** | Audio clarity, sound design, music, mix |
| **Cinematography** | Framing, lighting, color, camera movement |
| **Art Direction** | Production design, palette, costumes, world-building |

Plus a **GPU Generation Studio**:
- **Image → Visual** — Generate cinematic concept art from key frames (SDXL)
- **Visual → Video** — Animate a still into a video clip (Stable Video Diffusion)

---

## Quick Start

```bash
./start.sh
```

Then open **http://localhost:3000**

---

## Stack

```
frontend/     Next.js 14 + Tailwind CSS + TypeScript
backend/      FastAPI (Python) + uvicorn
  agents/     Writing, Sound, Cinematography, Art Direction
  services/   RAG client, Video processor, GPU pipeline
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_BASE_URL` | `http://10.1.96.117` | RAG agent endpoint |
| `RAG_TIMEOUT` | `120` | Request timeout in seconds |
| `SDXL_MODEL_ID` | `stabilityai/stable-diffusion-xl-base-1.0` | SDXL model |
| `SVD_MODEL_ID` | `stabilityai/stable-video-diffusion-img2vid-xt` | SVD model |

Set in shell or create `backend/.env`.

---

## RAG Agent API

The client at [backend/services/rag_client.py](backend/services/rag_client.py) auto-detects the API shape:

1. **OpenAI-compatible** — `POST /v1/chat/completions` (preferred, streaming)
2. **Simple chat** — `POST /chat`
3. **Query** — `POST /query` (non-streaming, simulated)

Check `http://10.1.96.117/docs` to see which endpoints are available and adjust `rag_client.py` if needed.

---

## Manual Start

**Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
RAG_BASE_URL=http://10.1.96.117 uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## GPU Models

Models download automatically from HuggingFace on first use (~7–12 GB total).
To use local copies, set `SDXL_MODEL_ID` / `SVD_MODEL_ID` to local paths.

```bash
# Pre-download (recommended before demo)
python3 -c "
from diffusers import StableDiffusionXLImg2ImgPipeline, StableVideoDiffusionPipeline
import torch
StableDiffusionXLImg2ImgPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16)
StableVideoDiffusionPipeline.from_pretrained('stabilityai/stable-video-diffusion-img2vid-xt', torch_dtype=torch.float16)
print('Models ready.')
"
```

---

## API Docs

FastAPI auto-docs: **http://localhost:8000/docs**

Key endpoints:
- `POST /upload` — Upload video/image, returns `session_id`
- `GET /session/{id}` — Get session metadata
- `GET /review/{id}/stream` — SSE stream of all 4 judge responses
- `POST /generate/visual` — Image→Visual generation
- `POST /generate/video` — Visual→Video generation
- `GET /health` — GPU status check
