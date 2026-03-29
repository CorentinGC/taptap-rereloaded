FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir yt-dlp flask gunicorn

COPY server.py /app/server.py
WORKDIR /app

EXPOSE 8080
CMD ["gunicorn", "-b", "0.0.0.0:8080", "-w", "2", "--timeout", "300", "server:app"]
