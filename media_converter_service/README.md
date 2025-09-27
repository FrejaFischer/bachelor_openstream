Media Converter Service

This small FastAPI service exposes two endpoints:

- POST /convert/image - accepts an image file, re-encodes to WebP with reasonable quality, and returns the result.
- POST /convert/video - accepts a video file, re-encodes to H.264 MP4 with a compression-friendly CRF, and returns the result.

Run locally (requires Python 3.11+ and ffmpeg installed):

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

Docker (build & run):

docker build -t media-converter:local .
docker run -p 8000:8000 media-converter:local

Example curl (image):

curl -X POST -F "file=@input.jpg" http://localhost:8000/convert/image --output out.webp

Example curl (video):

curl -X POST -F "file=@input.mp4" http://localhost:8000/convert/video --output out.mp4
