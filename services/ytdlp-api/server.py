import os
import tempfile
import subprocess
from flask import Flask, request, send_file, jsonify

app = Flask(__name__)

API_SECRET = os.environ.get("API_SECRET", "")


@app.before_request
def check_auth():
    if not API_SECRET:
        return
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token != API_SECRET:
        return jsonify({"error": "Unauthorized"}), 401


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/download", methods=["POST"])
def download():
    data = request.get_json()
    url = data.get("url")
    cookies_b64 = data.get("cookies_b64")
    fmt = data.get("format", "ogg")  # ogg or mp3

    if not url:
        return jsonify({"error": "Missing url"}), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        cookie_path = None
        if cookies_b64:
            import base64
            cookie_path = os.path.join(tmpdir, "cookies.txt")
            with open(cookie_path, "wb") as f:
                f.write(base64.b64decode(cookies_b64))

        output_path = os.path.join(tmpdir, f"audio.{fmt}")

        cmd = [
            "yt-dlp",
            "-x",
            "--audio-format", fmt,
            "--audio-quality", "128K",
            "-o", output_path,
            "--no-playlist",
            "--no-warnings",
        ]

        if cookie_path:
            cmd.extend(["--cookies", cookie_path])

        cmd.append(url)

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=240
            )
            if result.returncode != 0:
                return jsonify({
                    "error": "yt-dlp failed",
                    "stderr": result.stderr[-500:] if result.stderr else "",
                }), 500
        except subprocess.TimeoutExpired:
            return jsonify({"error": "Download timeout"}), 504

        # yt-dlp may change the extension
        import glob
        files = glob.glob(os.path.join(tmpdir, "audio.*"))
        if not files:
            return jsonify({"error": "No output file"}), 500

        actual_file = files[0]
        actual_ext = os.path.splitext(actual_file)[1].lstrip(".")
        mime = {
            "ogg": "audio/ogg",
            "mp3": "audio/mpeg",
            "webm": "audio/webm",
            "m4a": "audio/mp4",
            "opus": "audio/ogg",
        }.get(actual_ext, "audio/ogg")

        return send_file(actual_file, mimetype=mime, download_name=f"audio.{actual_ext}")


@app.route("/info", methods=["POST"])
def info():
    data = request.get_json()
    url = data.get("url")
    cookies_b64 = data.get("cookies_b64")

    if not url:
        return jsonify({"error": "Missing url"}), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        cookie_path = None
        if cookies_b64:
            import base64
            cookie_path = os.path.join(tmpdir, "cookies.txt")
            with open(cookie_path, "wb") as f:
                f.write(base64.b64decode(cookies_b64))

        cmd = [
            "yt-dlp",
            "--print", "%(title)s\n%(duration)s\n%(id)s",
            "--no-playlist",
            "--no-warnings",
        ]

        if cookie_path:
            cmd.extend(["--cookies", cookie_path])

        cmd.append(url)

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                return jsonify({"error": "yt-dlp failed", "stderr": result.stderr[-500:]}), 500
        except subprocess.TimeoutExpired:
            return jsonify({"error": "Timeout"}), 504

        lines = result.stdout.strip().split("\n")
        if len(lines) < 3:
            return jsonify({"error": "Unexpected output"}), 500

        return jsonify({
            "title": lines[0],
            "duration": int(lines[1]),
            "videoId": lines[2],
            "thumbnailUrl": f"https://img.youtube.com/vi/{lines[2]}/hqdefault.jpg",
        })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
