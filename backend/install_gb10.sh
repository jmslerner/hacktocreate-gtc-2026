#!/usr/bin/env bash
# GB10 (Blackwell B10 + Grace ARM) — one-time setup
set -e

echo "[GB10] Setting up Python environment for Dell GB10 / Blackwell…"

cd "$(dirname "$0")"

python3 -m venv .venv
source .venv/bin/activate

echo "[GB10] Installing PyTorch with CUDA 12.8 (Blackwell)…"
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

echo "[GB10] Installing app dependencies…"
pip install -r requirements.txt --no-deps torch torchvision  # skip torch re-install

echo "[GB10] Verifying GPU…"
python3 -c "
import torch
print(f'  PyTorch:  {torch.__version__}')
print(f'  CUDA:     {torch.version.cuda}')
print(f'  GPU:      {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"NOT FOUND\"}')
props = torch.cuda.get_device_properties(0)
print(f'  VRAM:     {props.total_memory / 1e9:.1f} GB')
print(f'  bfloat16: {torch.cuda.is_bf16_supported()}')
"

echo ""
echo "[GB10] Done. Run: source .venv/bin/activate && uvicorn main:app --reload --port 8000"
