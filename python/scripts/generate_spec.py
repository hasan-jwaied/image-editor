"""Export the operation registry to spec/operations.json (consumed by the web app)."""

from __future__ import annotations

import json
from pathlib import Path

from pixel_lab import registry

OUT = Path(__file__).resolve().parents[2] / "spec" / "operations.json"

if __name__ == "__main__":
    OUT.write_text(
        json.dumps(registry.spec(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"wrote {OUT.relative_to(OUT.parents[1])}")
