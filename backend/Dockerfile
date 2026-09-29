# Production Dockerfile for Kotson FastAPI Backend
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

# Copy application source code
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

# Health check using python urllib against /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request, os, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:' + str(os.environ.get('PORT', 8000)) + '/health').getcode() == 200 else 1)" || exit 1

# Start Uvicorn ASGI server (defaults to 1 worker for single-instance sweeper safety)
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-1}"]
