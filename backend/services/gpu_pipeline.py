"""
GPU Pipeline — Dell GB10 (Blackwell B10 + Grace ARM, 128 GB unified memory)

Models:
  Image → Visual : FLUX.1-dev   (black-forest-labs/FLUX.1-dev)
  Visual → Video : LTX-Video    (Lightricks/LTX-Video)
  Remix  → Video : LTX-2        (Lightricks/LTX-2)  ← upgraded model for remix

All models are fully open-source.

GB10 tuning:
  - bfloat16 throughout (Blackwell native precision)
  - Full models on-device — no CPU offloading (128 GB unified pool)
  - TF32 matmuls enabled for extra throughput
"""

import asyncio
import os
import subprocess
from pathlib import Path

import torch
from PIL import Image

# ---------------------------------------------------------------------------
# Model IDs — point to local paths via env vars if pre-downloaded
# ---------------------------------------------------------------------------
FLUX_MODEL_ID  = os.getenv("FLUX_MODEL_ID",  "black-forest-labs/FLUX.1-dev")
LTX_MODEL_ID   = os.getenv("LTX_MODEL_ID",   "Lightricks/LTX-Video")
LTX2_MODEL_ID  = os.getenv("LTX2_MODEL_ID",  "Lightricks/LTX-2")

# Generation dimensions
FLUX_WIDTH   = 1024
FLUX_HEIGHT  = 576
LTX_WIDTH    = 768
LTX_HEIGHT   = 512
LTX2_WIDTH   = 768   # LTX-2 recommended minimum
LTX2_HEIGHT  = 512

# Blackwell native dtype
_DTYPE = torch.bfloat16


def _get_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _setup_gb10():
    if not torch.cuda.is_available():
        return
    props = torch.cuda.get_device_properties(0)
    print(f"[GPUPipeline] GPU:   {torch.cuda.get_device_name(0)}")
    print(f"[GPUPipeline] VRAM:  {props.total_memory / 1e9:.1f} GB unified")
    print(f"[GPUPipeline] dtype: bfloat16 (Blackwell native)")
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True


class GPUPipeline:
    """
    Lazy-loads models on first use.
    Image → Visual : FLUX.1-dev (img2img via encode→perturb→decode)
    Visual → Video : LTX-Video
    """

    def __init__(self):
        self.device = _get_device()
        self._flux    = None
        self._ltx     = None
        self._ltx2    = None
        _setup_gb10()

    # ------------------------------------------------------------------
    # Image → Visual  (FLUX.1-dev img2img)
    # ------------------------------------------------------------------

    def _load_flux(self):
        if self._flux is not None:
            return self._flux

        from diffusers import FluxImg2ImgPipeline

        dtype = _DTYPE if self.device == "cuda" else torch.float32
        print(f"[GPUPipeline] Loading FLUX.1-dev img2img from {FLUX_MODEL_ID} …")

        pipe = FluxImg2ImgPipeline.from_pretrained(
            FLUX_MODEL_ID,
            torch_dtype=dtype,
        )
        pipe = pipe.to(self.device)
        # 128 GB unified — no offloading needed

        self._flux = pipe
        print("[GPUPipeline] FLUX.1-dev loaded.")
        return pipe

    async def image_to_visual(
        self,
        input_path: str,
        output_path: str,
        prompt: str = "",
        strength: float = 0.80,
        steps: int = 28,
    ) -> str:
        """Generate a cinematic concept-art visual using FLUX.1-dev img2img."""

        def _run():
            pipe = self._load_flux()

            img = Image.open(input_path).convert("RGB")
            img = img.resize((FLUX_WIDTH, FLUX_HEIGHT))

            cinematic_suffix = (
                "cinematic production still, ultra-detailed, professional color grade, "
                "anamorphic lens bokeh, film grain, 4K"
            )
            full_prompt = f"{prompt.strip()}, {cinematic_suffix}" if prompt.strip() else cinematic_suffix

            result = pipe(
                prompt=full_prompt,
                image=img,
                strength=strength,
                num_inference_steps=steps,
                guidance_scale=3.5,   # FLUX guidance range
            )

            result.images[0].save(output_path)
            return output_path

        return await asyncio.get_event_loop().run_in_executor(None, _run)

    # ------------------------------------------------------------------
    # Visual → Video  (LTX-Video)
    # ------------------------------------------------------------------

    def _load_ltx(self):
        if self._ltx is not None:
            return self._ltx

        from diffusers import LTXImageToVideoPipeline

        dtype = _DTYPE if self.device == "cuda" else torch.float32
        print(f"[GPUPipeline] Loading LTX-Video from {LTX_MODEL_ID} …")

        pipe = LTXImageToVideoPipeline.from_pretrained(
            LTX_MODEL_ID,
            torch_dtype=dtype,
        )
        pipe = pipe.to(self.device)

        self._ltx = pipe
        print("[GPUPipeline] LTX-Video loaded.")
        return pipe

    async def visual_to_video(
        self,
        input_path: str,
        output_path: str,
        steps: int = 50,
        fps: int = 24,
        num_frames: int = 97,   # LTX-Video sweet spot (must be 8n+1)
        prompt: str = "",
    ) -> str:
        """Animate a still image into a video clip using LTX-Video."""

        def _run():
            pipe = self._load_ltx()

            img = Image.open(input_path).convert("RGB")
            img = img.resize((LTX_WIDTH, LTX_HEIGHT))

            cinematic_prompt = (
                f"{prompt.strip()}, " if prompt.strip() else ""
            ) + (
                "cinematic camera movement, smooth motion, professional film production, "
                "consistent lighting, high quality"
            )
            negative_prompt = (
                "worst quality, inconsistent motion, blurry, jittery, distorted"
            )

            generator = torch.Generator(device=self.device).manual_seed(42)

            video = pipe(
                image=img,
                prompt=cinematic_prompt,
                negative_prompt=negative_prompt,
                width=LTX_WIDTH,
                height=LTX_HEIGHT,
                num_frames=num_frames,
                num_inference_steps=steps,
                guidance_scale=3.0,
                generator=generator,
            ).frames[0]

            # Export frames → MP4
            frames_dir = Path(output_path).parent / f"{Path(output_path).stem}_frames"
            frames_dir.mkdir(exist_ok=True)

            for i, frame in enumerate(video):
                if not isinstance(frame, Image.Image):
                    from PIL import Image as PILImage
                    import numpy as np
                    frame = PILImage.fromarray((frame * 255).astype("uint8"))
                frame.save(frames_dir / f"frame_{i:04d}.png")

            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-framerate", str(fps),
                    "-i", str(frames_dir / "frame_%04d.png"),
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-crf", "18",
                    "-preset", "fast",
                    output_path,
                ],
                check=True,
                capture_output=True,
            )

            import shutil
            shutil.rmtree(frames_dir, ignore_errors=True)
            return output_path

        return await asyncio.get_event_loop().run_in_executor(None, _run)

    # ------------------------------------------------------------------
    # Remix → Video  (LTX-2  — Lightricks/LTX-2)
    # ------------------------------------------------------------------

    def _load_ltx2(self):
        if self._ltx2 is not None:
            return self._ltx2

        from diffusers import LTXImageToVideoPipeline

        dtype = _DTYPE if self.device == "cuda" else torch.float32
        print(f"[GPUPipeline] Loading LTX-2 from {LTX2_MODEL_ID} …")

        pipe = LTXImageToVideoPipeline.from_pretrained(
            LTX2_MODEL_ID,
            torch_dtype=dtype,
        )
        pipe = pipe.to(self.device)

        self._ltx2 = pipe
        print("[GPUPipeline] LTX-2 loaded.")
        return pipe

    async def remix_video(
        self,
        input_path: str,
        output_path: str,
        prompt: str = "",
        steps: int = 50,
        fps: int = 24,
        num_frames: int = 97,   # must be 8n+1
    ) -> str:
        """Remix a still image into video using LTX-2 (Lightricks/LTX-2)."""

        def _run():
            pipe = self._load_ltx2()

            img = Image.open(input_path).convert("RGB")
            img = img.resize((LTX2_WIDTH, LTX2_HEIGHT))

            full_prompt = (
                f"{prompt.strip()}, " if prompt.strip() else ""
            ) + (
                "cinematic motion, smooth camera, professional film quality, "
                "consistent lighting, high fidelity"
            )
            negative_prompt = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark"

            generator = torch.Generator(device=self.device).manual_seed(42)

            video = pipe(
                image=img,
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                width=LTX2_WIDTH,
                height=LTX2_HEIGHT,
                num_frames=num_frames,
                num_inference_steps=steps,
                guidance_scale=3.0,
                generator=generator,
            ).frames[0]

            # Export frames → MP4
            frames_dir = Path(output_path).parent / f"{Path(output_path).stem}_frames"
            frames_dir.mkdir(exist_ok=True)

            for i, frame in enumerate(video):
                if not isinstance(frame, Image.Image):
                    from PIL import Image as PILImage
                    frame = PILImage.fromarray((frame * 255).astype("uint8"))
                frame.save(frames_dir / f"frame_{i:04d}.png")

            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-framerate", str(fps),
                    "-i", str(frames_dir / "frame_%04d.png"),
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-crf", "18",
                    "-preset", "fast",
                    output_path,
                ],
                check=True,
                capture_output=True,
            )

            import shutil
            shutil.rmtree(frames_dir, ignore_errors=True)
            return output_path

        return await asyncio.get_event_loop().run_in_executor(None, _run)
