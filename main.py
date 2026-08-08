#!/usr/bin/env python3
"""Launch the built Music Console app on Raspberry Pi OS."""

from __future__ import annotations

import argparse
import contextlib
import http.server
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
from urllib.parse import urlsplit


PROJECT_ROOT = Path(__file__).resolve().parent
DIST_ROOT = PROJECT_ROOT / "dist"
DEFAULT_PORT = 17324


class MusicConsoleServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class MusicConsoleHandler(http.server.SimpleHTTPRequestHandler):
    """Serve only the production build from dist/."""

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, directory=str(DIST_ROOT), **kwargs)

    def end_headers(self) -> None:
        request_path = urlsplit(self.path).path
        if request_path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        if request_path == "/sw.js":
            self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, message_format: str, *args: object) -> None:
        status = str(args[1]) if len(args) > 1 else ""
        if self.command not in {"GET", "HEAD"} or status >= "400":
            super().log_message(message_format, *args)


def default_profile_dir() -> Path:
    data_home = os.environ.get("XDG_DATA_HOME")
    if data_home:
        return Path(data_home).expanduser() / "music-console" / "chromium"
    return Path.home() / ".local" / "share" / "music-console" / "chromium"


def browser_candidates() -> tuple[str, ...]:
    if sys.platform == "darwin":
        return (
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        )
    if sys.platform == "win32":
        return ("chrome", "msedge", "chromium")
    return ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable")


def find_browser(requested: str | None) -> str | None:
    candidates = (requested,) if requested else browser_candidates()
    for candidate in candidates:
        if not candidate:
            continue
        expanded = str(Path(candidate).expanduser())
        if Path(expanded).is_file():
            return expanded
        discovered = shutil.which(candidate)
        if discovered:
            return discovered
    return None


def positive_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("端口必须是整数") from error
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("端口必须在 1 到 65535 之间")
    return port


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="在树莓派或桌面电脑上运行 Music Console 的 dist 构建。"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--fullscreen",
        action="store_const",
        const="fullscreen",
        dest="mode",
        help="全屏运行（默认）",
    )
    mode.add_argument(
        "--windowed",
        action="store_const",
        const="windowed",
        dest="mode",
        help="窗口模式，适合调试",
    )
    mode.add_argument(
        "--kiosk",
        action="store_const",
        const="kiosk",
        dest="mode",
        help="锁定式全屏，按 Alt+F4 退出",
    )
    parser.set_defaults(mode="fullscreen")
    parser.add_argument(
        "--port",
        type=positive_port,
        default=positive_port(os.environ.get("MUSIC_CONSOLE_PORT", str(DEFAULT_PORT))),
        help=f"本地服务端口（默认 {DEFAULT_PORT}）",
    )
    parser.add_argument("--browser", help="Chromium/Chrome 可执行文件路径")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="只启动本地网页服务，不打开浏览器",
    )
    parser.add_argument(
        "--profile-dir",
        type=Path,
        default=default_profile_dir(),
        help="独立浏览器数据目录",
    )
    return parser.parse_args()


def validate_build() -> bool:
    required_files = (DIST_ROOT / "index.html", DIST_ROOT / "sw.js")
    missing = [path.relative_to(PROJECT_ROOT) for path in required_files if not path.is_file()]
    if not missing:
        return True

    print("缺少可运行的前端构建：", file=sys.stderr)
    for path in missing:
        print(f"  - {path}", file=sys.stderr)
    print("请先在项目目录执行 npm install 和 npm run build。", file=sys.stderr)
    return False


def browser_command(browser: str, url: str, profile_dir: Path, mode: str) -> list[str]:
    command = [
        browser,
        f"--user-data-dir={profile_dir}",
        f"--app={url}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
    ]
    if mode == "fullscreen":
        command.append("--start-fullscreen")
    elif mode == "kiosk":
        command.append("--kiosk")
    return command


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def main() -> int:
    args = parse_args()
    if not validate_build():
        return 1

    browser = None
    if not args.no_browser:
        browser = find_browser(args.browser or os.environ.get("MUSIC_CONSOLE_BROWSER"))
        if browser is None:
            print(
                "没有找到 Chromium/Chrome。请先安装 Chromium，或使用 --browser 指定路径。",
                file=sys.stderr,
            )
            return 1

    try:
        server = MusicConsoleServer(("127.0.0.1", args.port), MusicConsoleHandler)
    except OSError as error:
        print(f"无法使用本地端口 {args.port}：{error}", file=sys.stderr)
        print("请先关闭另一个实例，或使用 --port 更换端口。", file=sys.stderr)
        return 1

    url = f"http://127.0.0.1:{args.port}/"
    print(f"Music Console 已启动：{url}")

    if args.no_browser:
        print("按 Ctrl+C 停止。")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return 0

    profile_dir = args.profile_dir.expanduser().resolve()
    profile_dir.mkdir(parents=True, exist_ok=True)
    server_thread = threading.Thread(
        target=server.serve_forever,
        name="music-console-http",
        daemon=True,
    )
    server_thread.start()
    process: subprocess.Popen[bytes] | None = None
    try:
        process = subprocess.Popen(browser_command(browser, url, profile_dir, args.mode))
        return process.wait()
    except KeyboardInterrupt:
        return 130
    except OSError as error:
        print(f"Chromium 启动失败：{error}", file=sys.stderr)
        return 1
    finally:
        if process is not None:
            stop_process(process)
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)


if __name__ == "__main__":
    with contextlib.suppress(BrokenPipeError):
        raise SystemExit(main())
