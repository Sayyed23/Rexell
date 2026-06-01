"""
Daily summary report job (Task 21.4).

Pulls the last-24h Prometheus counters via the remote HTTP API and writes
a JSON summary to MinIO (or stdout if no bucket is configured).
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone

import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)


QUERIES = {
    "requests_total": "sum(increase(bot_detection_requests_total[24h]))",
    "blocked_total": "sum(increase(bot_detection_requests_total{decision='block'}[24h]))",
    "challenged_total": "sum(increase(bot_detection_requests_total{decision='challenge'}[24h]))",
    "errors_total": "sum(increase(bot_detection_errors_total[24h]))",
    "model_accuracy": "max(bot_detection_model_accuracy)",
}


def _prom_query(base_url: str, expr: str) -> float:
    url = f"{base_url.rstrip('/')}/api/v1/query?{urllib.parse.urlencode({'query': expr})}"
    with urllib.request.urlopen(url, timeout=10) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if payload.get("status") != "success":
        raise RuntimeError(f"Prometheus query failed: {payload}")
    data = payload["data"]["result"]
    if not data:
        return 0.0
    return float(data[0]["value"][1])


def build_report(prometheus_url: str) -> dict:
    report = {"generated_at": datetime.now(timezone.utc).isoformat()}
    for name, expr in QUERIES.items():
        try:
            report[name] = _prom_query(prometheus_url, expr)
        except Exception:  # noqa: BLE001
            report[name] = None
            logger.exception("Prometheus query failed for %s", name)
    return report


def write_report(report: dict) -> None:
    bucket = os.getenv("MINIO_REPORT_BUCKET")
    endpoint = os.getenv("MINIO_ENDPOINT")
    if not bucket or not endpoint:
        json.dump(report, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return
    try:
        from minio import Minio  # type: ignore

        client = Minio(
            endpoint,
            access_key=os.getenv("MINIO_ACCESS_KEY", ""),
            secret_key=os.getenv("MINIO_SECRET_KEY", ""),
            secure=os.getenv("MINIO_SECURE", "true").lower() == "true",
        )
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        today = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        payload = json.dumps(report, indent=2).encode("utf-8")
        import io as _io

        client.put_object(
            bucket_name=bucket,
            object_name=f"{today}/summary.json",
            data=_io.BytesIO(payload),
            length=len(payload),
            content_type="application/json",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to upload daily report to MinIO")
        json.dump(report, sys.stdout, indent=2)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
    report = build_report(prometheus_url)
    write_report(report)


if __name__ == "__main__":
    main()
