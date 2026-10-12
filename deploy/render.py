#!/usr/bin/env python3
"""Render non-secret staging resources with an immutable image and release ID."""
import argparse
from pathlib import Path
import re
import yaml

parser = argparse.ArgumentParser()
parser.add_argument("--api-image", required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
if not re.fullmatch(r"[a-z0-9./_-]+@sha256:[0-9a-f]{64}", args.api_image):
    parser.error("The API image must be an immutable sha256 reference")
root = Path(__file__).resolve().parents[1]
release_id = args.api_image.rsplit(":", 1)[1][:12]
resources = list(yaml.safe_load_all((root / "deploy/resources.yaml").read_text()
    .replace("__API_IMAGE__", args.api_image).replace("__RELEASE_ID__", release_id)))
resources.insert(1, {
    "apiVersion": "v1", "kind": "ConfigMap",
    "metadata": {"name": "postgres-init", "namespace": "devsecops-staging"},
    "data": {"001-app-user.sh": (root / "scripts/init-app-user.sh").read_text()},
})
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(yaml.safe_dump_all(resources, sort_keys=False))
print(f"Rendered staging resources for release {release_id}.")
