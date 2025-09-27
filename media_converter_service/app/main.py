from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from starlette.background import BackgroundTask
from fastapi.middleware.cors import CORSMiddleware
import shutil
import tempfile
import subprocess
import os
from typing import Tuple

app = FastAPI(title="Media Converter Service")

# Allow requests from the frontend (adjust origin as needed). Also expose
# Content-Disposition so the browser can see filename headers when downloading.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def run_ffmpeg(args: list) -> Tuple[int, str]:
    """Run ffmpeg with arguments and return (returncode, stderr)."""
    proc = subprocess.Popen(["ffmpeg", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, stderr = proc.communicate()
    return proc.returncode, stderr.decode("utf-8", errors="ignore")


@app.post("/convert/image")
async def convert_image(file: UploadFile = File(...)):
    """Compress image using ffmpeg (re-encode to webp or jpeg) and return compressed file.

    This endpoint accepts a single uploaded file and returns the processed binary file.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not an image")

    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    tmpdir = tempfile.TemporaryDirectory()
    in_path = os.path.join(tmpdir.name, "input" + suffix)
    out_path = os.path.join(tmpdir.name, "output.webp")

    with open(in_path, "wb") as f:
        contents = await file.read()
        f.write(contents)

    # Convert image to webp with quality 75
    args = ["-y", "-i", in_path, "-quality", "75", out_path]
    code, stderr = run_ffmpeg(args)
    if code != 0:
        tmpdir.cleanup()
        raise HTTPException(status_code=500, detail=f"ffmpeg failed: {stderr[:200]}")

    # Return file and cleanup tempdir after response is sent
    return FileResponse(out_path, media_type="image/webp", filename=os.path.basename(file.filename) or "output.webp", background=BackgroundTask(tmpdir.cleanup))


@app.post("/convert/video")
async def convert_video(file: UploadFile = File(...)):
    """Compress video using ffmpeg and return compressed file.

    This endpoint accepts a single uploaded video file and returns an mp4 H.264 re-encoded file.
    """
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a video")

    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    tmpdir = tempfile.TemporaryDirectory()
    in_path = os.path.join(tmpdir.name, "input" + suffix)
    out_path = os.path.join(tmpdir.name, "output.mp4")

    with open(in_path, "wb") as f:
        while True:
            chunk = await file.read(1024*1024)
            if not chunk:
                break
            f.write(chunk)

    # Re-encode video to H.264 baseline profile, crf 28 for compression
    args = ["-y", "-i", in_path, "-c:v", "libx264", "-preset", "fast", "-crf", "28", "-c:a", "aac", "-b:a", "96k", out_path]
    code, stderr = run_ffmpeg(args)
    if code != 0:
        tmpdir.cleanup()
        raise HTTPException(status_code=500, detail=f"ffmpeg failed: {stderr[:200]}")

    return FileResponse(out_path, media_type="video/mp4", filename=os.path.basename(file.filename) or "output.mp4", background=BackgroundTask(tmpdir.cleanup))
