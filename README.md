# BunkerAI

Run large language models (70B+) on consumer GPUs with as little as **4GB VRAM**.

Powered by [AirLLM](https://github.com/lyogavin/airllm) — uses **layer-wise inference** to load, compute, and flush one layer at a time instead of loading the entire model into memory.

## Features

- **70B models on 4GB VRAM** — no quantization needed by default
- **405B Llama 3.1 on 8GB VRAM** — with 4-bit/8-bit compression
- **Optional compression** — 4-bit or 8-bit quantization for ~3x faster inference
- **Simple API** — text generation and chat in a few lines of code
- Supports **Llama, Qwen, Mistral**, and more

## Quick Start

### Install

```bash
pip install -r requirements.txt
```

### Usage

```python
from bunker_ai import BunkerModel

# Load a 70B model (downloads and splits into layers on first run)
model = BunkerModel("garage-bAInd/Platypus2-70B-instruct")

# Generate text
response = model.generate("What is quantum computing?")
print(response)

# Chat
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain AI in simple terms."},
]
print(model.chat(messages))
```

### With 4-bit compression (faster)

```python
model = BunkerModel(
    "meta-llama/Meta-Llama-3.1-405B-Instruct",
    compression="4bit",
    hf_token="your_token",
)
```

## Important Notes

- **First run is slow** — the model is downloaded and split into layer shards (requires disk space)
- **Inference is slow** (~0.7 tokens/sec) — this is the trade-off for low VRAM usage
- **Disk space** — ensure enough space in the HuggingFace cache directory for layer shards
- Best suited for **experimentation and testing**, not production serving

## Requirements

- Python 3.10+
- PyTorch 2.0+
- A CUDA-capable GPU (4GB+ VRAM) or CPU
- Sufficient disk space for model layer shards
