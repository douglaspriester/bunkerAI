"""AirLLM-based inference engine for running large models on low-VRAM GPUs."""

from airllm import AutoModel


class BunkerModel:
    """Wrapper around AirLLM for layer-wise inference on consumer GPUs.

    Supports models up to 405B parameters on GPUs with as little as 4GB VRAM.
    Uses layer-wise inference: loads, computes, and flushes one layer at a time.
    """

    def __init__(
        self,
        model_name: str,
        compression: str | None = None,
        hf_token: str | None = None,
        max_length: int = 512,
    ):
        """Initialize BunkerModel.

        Args:
            model_name: HuggingFace model ID (e.g. "meta-llama/Llama-2-70b-chat-hf").
            compression: Optional quantization - "4bit", "8bit", or None for full precision.
            hf_token: HuggingFace token for gated models (e.g. Llama).
            max_length: Maximum input token length.
        """
        self.model_name = model_name
        self.max_length = max_length
        self.compression = compression

        model_kwargs = {}
        if compression:
            model_kwargs["compression"] = compression
        if hf_token:
            model_kwargs["hf_token"] = hf_token

        self.model = AutoModel.from_pretrained(model_name, **model_kwargs)
        self.tokenizer = self.model.tokenizer

    def generate(self, prompt: str, max_new_tokens: int = 128) -> str:
        """Generate text from a prompt.

        Args:
            prompt: The input text prompt.
            max_new_tokens: Maximum number of tokens to generate.

        Returns:
            The generated text response.
        """
        input_tokens = self.tokenizer(
            [prompt],
            return_tensors="pt",
            truncation=True,
            max_length=self.max_length,
        )

        output = self.model.generate(
            input_tokens["input_ids"].cuda(),
            max_new_tokens=max_new_tokens,
            use_cache=True,
            return_dict_in_generate=True,
        )

        full_text = self.tokenizer.decode(output.sequences[0], skip_special_tokens=True)

        # Remove the original prompt from the output
        if full_text.startswith(prompt):
            return full_text[len(prompt):].strip()
        return full_text

    def chat(self, messages: list[dict[str, str]], max_new_tokens: int = 256) -> str:
        """Chat-style generation using a list of messages.

        Args:
            messages: List of {"role": "user"|"assistant"|"system", "content": "..."}.
            max_new_tokens: Maximum number of tokens to generate.

        Returns:
            The assistant's response text.
        """
        prompt = self._format_chat(messages)
        return self.generate(prompt, max_new_tokens=max_new_tokens)

    def _format_chat(self, messages: list[dict[str, str]]) -> str:
        """Format messages into a chat prompt string."""
        parts = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                parts.append(f"[INST] <<SYS>>\n{content}\n<</SYS>>\n[/INST]")
            elif role == "user":
                parts.append(f"[INST] {content} [/INST]")
            elif role == "assistant":
                parts.append(content)
        return "\n".join(parts)
