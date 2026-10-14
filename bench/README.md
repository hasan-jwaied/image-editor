# Benchmarks

Results shown in the main README and on the "How it's built" page.

```bash
cd python && .venv/bin/python scripts/benchmark.py path/to/photo.jpg   # also writes input.bin, input_rgb.bin
cd web && npm run bench                                               # same pixels, TypeScript engine
```

The published numbers use the Broadway Tower sample at 1000 px wide (blur race) and 640 px (per-operation table), best of several runs.
