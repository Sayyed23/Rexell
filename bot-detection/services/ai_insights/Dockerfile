# Rexell AI Insights service
FROM python:3.12-slim

WORKDIR /app

# System deps for numpy/tensorflow wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Service code is copied under /app/ai_insights so relative imports work
COPY . /app/ai_insights

ENV PYTHONUNBUFFERED=1 \
    LOG_LEVEL=INFO

EXPOSE 8200

# Run as a package so the `ai_insights.app` relative imports resolve
CMD ["uvicorn", "ai_insights.app:app", "--host", "0.0.0.0", "--port", "8200"]
