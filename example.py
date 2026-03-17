"""Example: Run a 70B model on a consumer GPU with BunkerAI."""

from bunker_ai import BunkerModel

# --- Option 1: Full precision (no quantization) ---
# Requires ~4GB VRAM for 70B models
model = BunkerModel("garage-bAInd/Platypus2-70B-instruct")

# --- Option 2: 4-bit compression (3x faster inference) ---
# model = BunkerModel(
#     "garage-bAInd/Platypus2-70B-instruct",
#     compression="4bit",
# )

# --- Option 3: Llama 3.1 405B (requires ~8GB VRAM) ---
# model = BunkerModel(
#     "meta-llama/Meta-Llama-3.1-405B-Instruct",
#     compression="4bit",
#     hf_token="your_hf_token_here",
# )

# Simple text generation
response = model.generate("What are the benefits of open-source AI?", max_new_tokens=100)
print("Response:", response)

# Chat-style interaction
messages = [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": "Explain quantum computing in simple terms."},
]
chat_response = model.chat(messages, max_new_tokens=200)
print("Chat response:", chat_response)
