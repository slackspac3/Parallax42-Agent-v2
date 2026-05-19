#!/usr/bin/env python3
"""Agentathon compatibility entry point.

This repository's production implementation is a Node/CommonJS app. The
hackathon evaluator expects `python run.py` to start an API on port 8000, so
this thin wrapper launches the existing Node server with PORT=8000 by default.
"""

from __future__ import annotations

import os
import signal
import socket
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def port_is_occupied(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.25)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def main() -> int:
    env = os.environ.copy()
    env.setdefault("PORT", "8000")
    port = int(env["PORT"])
    if os.environ.get("P42_SKIP_PORT_PREFLIGHT") != "1" and port_is_occupied(port):
        sys.stderr.write(
            f"Port {port} is already serving another local process on 127.0.0.1. "
            "Stop that process or run with a different PORT, for example: PORT=8010 python run.py\n"
        )
        return 98
    process = subprocess.Popen(["node", "server.js"], cwd=ROOT, env=env)

    def forward_signal(signum, _frame):
        if process.poll() is None:
            process.send_signal(signum)

    signal.signal(signal.SIGTERM, forward_signal)
    signal.signal(signal.SIGINT, forward_signal)
    return process.wait()


if __name__ == "__main__":
    sys.exit(main())
