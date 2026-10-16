"""Serve the trusted frontend build without turning API errors into SPA pages."""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse


def install_static_site(app: FastAPI, directory: str) -> None:
    root = Path(directory).resolve(strict=True)
    if not (root / "index.html").is_file():
        raise RuntimeError("The frontend build is missing index.html")
    config = json.loads((root / "staticwebapp.config.json").read_text(encoding="utf-8"))
    # The build generates this policy from public settings. Never accept response
    # headers or filesystem paths from the request or runtime user content.
    headers = {
        name: config["globalHeaders"][name]
        for name in ("Content-Security-Policy", "Permissions-Policy")
    }
    if any(not isinstance(value, str) or "\r" in value or "\n" in value for value in headers.values()):
        raise RuntimeError("Invalid frontend security headers")

    @app.api_route("/{site_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def frontend(request: Request, site_path: str):
        parts = site_path.split("/")
        reserved = {"api", "health", "docs", "redoc", "openapi.json", "staticwebapp.config.json"}
        if (
            parts[0] in reserved
            or "\\" in site_path
            or any(part.startswith(".") for part in parts)
        ):
            raise HTTPException(404)
        try:
            target = (root / (site_path or "index.html")).resolve()
            exists = target.is_file()
        except (OSError, ValueError):
            raise HTTPException(404)
        if not target.is_relative_to(root):
            raise HTTPException(404)
        if not exists:
            # Only document navigation gets the SPA fallback. Missing assets and
            # unknown API routes must keep a real 404 (including HTML Accept).
            if parts[0] in {"assets", "fonts"} or Path(site_path).suffix:
                raise HTTPException(404)
            if "text/html" not in request.headers.get("accept", ""):
                raise HTTPException(404)
            target = root / "index.html"
        cache = "public, max-age=31536000, immutable" if parts[0] == "assets" else "no-cache"
        return FileResponse(target, headers={**headers, "Cache-Control": cache})
