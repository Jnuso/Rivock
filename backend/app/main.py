import logging
from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from .config import settings
from .db import engine
from .routes import router
from .admin import router as admin_router
from .static_site import install_static_site

logger = logging.getLogger("rivock")


@asynccontextmanager
async def lifespan(app):
    settings().validate_production()
    if settings().environment == "migration":
        raise RuntimeError("Migration configuration cannot start a web server")
    yield
    engine.dispose()


app = FastAPI(
    title="Rivock API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings().environment not in {"preview", "production"} else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings().environment not in {"preview", "production"} else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings().cors_origins.split(",") if x.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    expose_headers=["X-Request-ID", "Retry-After"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    request.state.request_id = str(uuid4())
    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 131072:
                return error(request, 413, "body_too_large", "This request is too large.")
            chunks.append(chunk)
        request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers.setdefault("Cache-Control", "no-store")
    return response


def error(request, status, code, message, headers=None, **extra):
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "request_id": getattr(request.state, "request_id", ""),
                **extra,
            }
        },
        headers=headers,
    )


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc):
    detail = (
        exc.detail if isinstance(exc.detail, dict) else {"code": "request_failed", "message": str(exc.detail)}
    )
    return error(request, exc.status_code, headers=exc.headers, **detail)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc):
    # Never echo raw input (tokens/content) through a validation exception.
    fields = {".".join(str(x) for x in e["loc"]): e["msg"] for e in exc.errors()}
    return error(request, 422, "validation_error", "Check the supplied fields.", fields=fields)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc):
    return error(
        request, 409, "conflict", "This change conflicts with the current state. Reload and try again."
    )


@app.exception_handler(OperationalError)
async def database_error(request: Request, exc):
    return error(
        request, 503, "temporarily_unavailable", "Please try again shortly.", headers={"Retry-After": "5"}
    )


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc):
    logger.error("Request %s failed: %s", getattr(request.state, "request_id", ""), type(exc).__name__)
    return error(request, 500, "internal_error", "Something went wrong. Please try again.")


@app.get("/health/live")
def live():
    return {"status": "ok"}


@app.get("/health/ready")
def ready():
    try:
        with engine.connect() as db:
            db.execute(text("SET LOCAL statement_timeout = '2s'"))
            db.execute(text("SELECT 1 FROM topics LIMIT 1"))
        return {"status": "ready"}
    except Exception:
        raise HTTPException(
            503, {"code": "not_ready", "message": "Service is starting or temporarily unavailable."}
        )


app.include_router(router)
app.include_router(admin_router)

if settings().static_files_directory:
    install_static_site(app, settings().static_files_directory)
