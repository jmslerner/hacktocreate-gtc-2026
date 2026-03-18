"""
Video/image processor — extracts metadata and key frames using ffmpeg.
"""

import asyncio
import json
import os
from pathlib import Path


VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


class VideoProcessor:

    async def extract_metadata(self, file_path: str) -> dict:
        """Return duration, resolution, fps, codec info, and size."""
        suffix = Path(file_path).suffix.lower()
        size_mb = os.path.getsize(file_path) / (1024 * 1024)

        if suffix in IMAGE_EXTS:
            return await self._image_metadata(file_path, size_mb)
        elif suffix in VIDEO_EXTS:
            return await self._video_metadata(file_path, size_mb)
        else:
            return {"file_type": suffix.lstrip("."), "size_mb": round(size_mb, 2)}

    async def _image_metadata(self, file_path: str, size_mb: float) -> dict:
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_streams", file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            info = json.loads(stdout)
            stream = info.get("streams", [{}])[0]
            return {
                "file_type": Path(file_path).suffix.lstrip(".").lower(),
                "width": stream.get("width"),
                "height": stream.get("height"),
                "size_mb": round(size_mb, 2),
                "has_audio": False,
            }
        except Exception:
            return {"file_type": "image", "size_mb": round(size_mb, 2)}

    async def _video_metadata(self, file_path: str, size_mb: float) -> dict:
        try:
            proc = await asyncio.create_subprocess_exec(
                "ffprobe", "-v", "quiet", "-print_format", "json",
                "-show_streams", "-show_format", file_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            info = json.loads(stdout)

            video_stream = next(
                (s for s in info.get("streams", []) if s.get("codec_type") == "video"), {}
            )
            audio_stream = next(
                (s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None
            )
            fmt = info.get("format", {})

            # Parse fps fraction e.g. "24000/1001"
            fps = None
            raw_fps = video_stream.get("r_frame_rate", "")
            if "/" in raw_fps:
                num, den = raw_fps.split("/")
                try:
                    fps = round(int(num) / int(den), 2)
                except ZeroDivisionError:
                    pass

            duration = None
            try:
                duration = float(fmt.get("duration") or video_stream.get("duration", 0))
            except (ValueError, TypeError):
                pass

            return {
                "file_type": Path(file_path).suffix.lstrip(".").lower(),
                "width": video_stream.get("width"),
                "height": video_stream.get("height"),
                "fps": fps,
                "duration": round(duration, 2) if duration else None,
                "video_codec": video_stream.get("codec_name"),
                "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
                "has_audio": audio_stream is not None,
                "size_mb": round(size_mb, 2),
            }
        except Exception as e:
            return {
                "file_type": Path(file_path).suffix.lstrip(".").lower(),
                "size_mb": round(size_mb, 2),
                "error": str(e),
            }

    async def extract_key_frame(self, file_path: str, output_path: str, timestamp: float = 0.0) -> str:
        """Extract a single frame from a video at a given timestamp."""
        # Try ffmpeg first; fall back to torchvision if unavailable
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-ss", str(timestamp), "-i", file_path,
            "-vframes", "1", "-q:v", "2", output_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.communicate()

        # If ffmpeg didn't produce the file, use PyAV
        if not os.path.exists(output_path):
            await asyncio.get_event_loop().run_in_executor(
                None, self._extract_frame_av, file_path, output_path, timestamp
            )
        return output_path

    def _extract_frame_av(self, file_path: str, output_path: str, timestamp: float) -> None:
        import av
        container = av.open(file_path)
        stream = container.streams.video[0]
        stream.codec_context.skip_frame = "NONKEY"
        target_pts = int(timestamp / stream.time_base)
        container.seek(max(target_pts, 0), stream=stream)
        for frame in container.decode(stream):
            frame.to_image().save(output_path)
            break
        container.close()
