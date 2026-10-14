# Benchmarks

`python.json` and `typescript.json` are the measured results shown in the main README and on the "How it's built" page.

```bash
# 1. Python engine (and the original v1 blur, kept verbatim as the baseline).
#    Also writes input.bin / input_rgb.bin: the exact pixels used.
cd python && .venv/bin/python scripts/benchmark.py path/to/photo.jpg

# 2. TypeScript engine on the identical pixels.
cd web && npm run bench
```

The published numbers used the Broadway Tower sample, scaled to 1000 px wide (blur race) and 640 px (per-operation table).
Timings are the best of several runs, so they reflect algorithmic cost rather than scheduling noise.
