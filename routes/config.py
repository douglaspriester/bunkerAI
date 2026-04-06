"""
Shared configuration and mutable state for all BunkerAI routers.

Import this module by reference so mutations are visible across modules:
    import routes.config as cfg
    cfg.BACKEND = "ollama"
"""

import os
import time
from collections import defaultdict
from pathlib import Path

# ── Server start time ────────────────────────────────────────────────────────
SERVER_START_TIME: float = time.time()

# ── LLM Backend ──────────────────────────────────────────────────────────────
BACKEND: str = "ollama"          # "ollama" | "llama.cpp" — mutated at startup
OLLAMA_BASE: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
LLAMA_CPP_URL: str = os.getenv("LLAMA_CPP_URL", "")
LLAMA_CPP_MODEL: str = os.getenv("LLAMA_CPP_MODEL", "built-in")
OFFLINE_MODE: bool = False       # mutated via /api/config/offline

# ── Smart model auto-selection ────────────────────────────────────────────────
MODEL_ROLES: dict = {
    "chat": {
        "prefer": [
            "dolphin3", "dolphin", "abliterated", "uncensored",
            "nous-hermes", "wizard-vicuna", "samantha", "neural-chat",
            "llama3", "gemma3", "mistral", "qwen2.5", "phi4", "deepseek",
        ],
    },
    "vision": {
        "prefer": [
            "llava-dolphin", "llava-uncensored",
            "gemma3", "llava", "bakllava", "moondream", "minicpm",
            "llama3.2-vision", "granite-vision",
        ],
    },
    "code": {
        "prefer": [
            "dolphin-coder", "dolphin3",
            "qwen2.5-coder", "coder", "codellama", "deepseek-coder", "starcoder",
            "dolphin", "abliterated",
        ],
    },
    "brain": {
        "prefer": [
            "dolphin3", "dolphin", "abliterated", "uncensored",
            "nous-hermes", "wizard-vicuna", "samantha",
            "llama3", "mistral", "gemma3", "qwen2.5",
        ],
    },
}

_auto_models: dict = {}  # { "chat": "modelname", "vision": "modelname", ... }


def _pick_best_model(available: list, role: str) -> str:
    """Pick the best available model for a given role."""
    prefs = MODEL_ROLES.get(role, MODEL_ROLES["chat"])["prefer"]
    for pref in prefs:
        for m in available:
            if pref in m.lower():
                return m
    return available[0] if available else ""


def _resolve_all_models(available: list):
    """Resolve best model for each role from available list."""
    global _auto_models
    for role in MODEL_ROLES:
        _auto_models[role] = _pick_best_model(available, role)
    print(
        f"[LLM] Auto-select: chat={_auto_models.get('chat')}, "
        f"vision={_auto_models.get('vision')}, "
        f"code={_auto_models.get('code')}, brain={_auto_models.get('brain')}"
    )


def get_model(role: str, requested: str = "") -> str:
    """Get model for a role: use requested if provided, else auto-selected."""
    if requested:
        return requested
    return _auto_models.get(role, "")


# ── Paths ────────────────────────────────────────────────────────────────────
GENERATED_DIR = Path("generated_apps")
TTS_DIR = Path("tts_cache")
MAPS_DIR = Path("static/maps")
VOICE_MODELS_DIR = Path("voice_models")
DATA_DIR = Path("data")
GUIDES_DIR = DATA_DIR / "guides"
PROTOCOLS_DIR = DATA_DIR / "protocols"
BOOKS_DIR = DATA_DIR / "books"
GAMES_DIR = DATA_DIR / "games"
DB_PATH = DATA_DIR / "db" / "bunker.db"
MODELS_DIR = Path("models")
KOKORO_MODELS_DIR = Path("kokoro_models")
GENERATED_IMAGES_DIR = Path("generated_images")
ROMS_DIR = Path("static") / "games"

# ── Create directories on import ─────────────────────────────────────────────
for _d in [
    GENERATED_DIR, TTS_DIR, MAPS_DIR, VOICE_MODELS_DIR, DATA_DIR,
    GUIDES_DIR, PROTOCOLS_DIR, BOOKS_DIR, GAMES_DIR,
    DATA_DIR / "db", DATA_DIR / "zim", DATA_DIR / "avatar",
    MODELS_DIR, KOKORO_MODELS_DIR, GENERATED_IMAGES_DIR,
]:
    _d.mkdir(parents=True, exist_ok=True)

# ── External service URLs ─────────────────────────────────────────────────────
SD_SERVER_URL: str = os.getenv("SD_SERVER_URL", "http://127.0.0.1:7860")

# ── TTS constants ─────────────────────────────────────────────────────────────
PIPER_HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"
PIPER_MODELS: dict = {
    "pt_BR-faber-medium": {
        "lang": "pt", "lang_code": "pt_BR", "speaker": "faber", "quality": "medium",
        "desc": "Português BR — Masculino (recomendado)", "size_mb": 63,
    },
    "pt_BR-edresson-low": {
        "lang": "pt", "lang_code": "pt_BR", "speaker": "edresson", "quality": "low",
        "desc": "Português BR — Masculino (rápido)", "size_mb": 28,
    },
    "en_US-lessac-medium": {
        "lang": "en", "lang_code": "en_US", "speaker": "lessac", "quality": "medium",
        "desc": "English US — Male", "size_mb": 63,
    },
    "en_US-amy-medium": {
        "lang": "en", "lang_code": "en_US", "speaker": "amy", "quality": "medium",
        "desc": "English US — Female", "size_mb": 63,
    },
    "es_ES-mls_9972-low": {
        "lang": "es", "lang_code": "es_ES", "speaker": "mls_9972", "quality": "low",
        "desc": "Español — Male", "size_mb": 28,
    },
}

KOKORO_ONNX_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
KOKORO_VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

KOKORO_VOICE_MAP: dict = {
    "pt-BR-AntonioNeural": ("pm_alex", "pt-br"),
    "pt-BR-FranciscaNeural": ("pf_dora", "pt-br"),
    "en-US-GuyNeural": ("am_adam", "en-us"),
    "en-US-JennyNeural": ("af_heart", "en-us"),
    "es-ES-AlvaroNeural": ("em_alex", "es"),
}

KOKORO_VOICES: dict = {
    "pt-br": [
        {"id": "pm_alex", "name": "Alex (Masculino)", "lang": "pt-br"},
        {"id": "pm_santa", "name": "Santa (Masculino)", "lang": "pt-br"},
        {"id": "pf_dora", "name": "Dora (Feminino)", "lang": "pt-br"},
    ],
    "en-us": [
        {"id": "af_heart", "name": "Heart (Female)", "lang": "en-us"},
        {"id": "af_sarah", "name": "Sarah (Female)", "lang": "en-us"},
        {"id": "af_nova", "name": "Nova (Female)", "lang": "en-us"},
        {"id": "am_adam", "name": "Adam (Male)", "lang": "en-us"},
        {"id": "am_michael", "name": "Michael (Male)", "lang": "en-us"},
    ],
    "es": [
        {"id": "ef_dora", "name": "Dora (Femenino)", "lang": "es"},
        {"id": "em_alex", "name": "Alex (Masculino)", "lang": "es"},
    ],
}

# ── Rate limiter ──────────────────────────────────────────────────────────────
_rate_buckets: dict = defaultdict(list)
RATE_LIMITS: dict = {
    "terminal": (10, 60),
    "chat": (30, 60),
    "build": (10, 60),
    "tts": (20, 60),
}


def _check_rate_limit(key: str, client_ip: str = "local") -> bool:
    """Returns True if rate limited (should block)."""
    import time as _t
    if key not in RATE_LIMITS:
        return False
    max_req, window = RATE_LIMITS[key]
    bucket_key = f"{key}:{client_ip}"
    now = _t.time()
    _rate_buckets[bucket_key] = [t for t in _rate_buckets[bucket_key] if t > now - window]
    if len(_rate_buckets[bucket_key]) >= max_req:
        return True
    _rate_buckets[bucket_key].append(now)
    return False


# ── GGUF model registry ───────────────────────────────────────────────────────
GGUF_REGISTRY: list = [
    {
        "id": "dolphin3-3b-uncensored",
        "name": "Dolphin 3.0 3B Uncensored (CPU/GPU)",
        "filename": "dolphin-3.0-llama3.2-3b-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/dolphin-3.0-llama3.2-3b-GGUF/resolve/main/dolphin-3.0-llama3.2-3b-Q4_K_M.gguf",
        "size_gb": 2.0,
        "type": "cpu",
        "desc": "Uncensored leve. Roda em CPU ou GPU 3GB+. Ideal para sobrevivencia.",
        "uncensored": True,
        "tags": ["chat", "uncensored", "cpu", "leve", "principal"],
    },
    {
        "id": "dolphin-8b-gpu",
        "name": "Dolphin 8B Uncensored (GPU)",
        "filename": "dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/dolphin-2.9.4-llama3.1-8b-GGUF/resolve/main/dolphin-2.9.4-llama3.1-8b-Q4_K_M.gguf",
        "size_gb": 4.9,
        "type": "gpu",
        "desc": "Uncensored completo. GPU 6GB+ VRAM. Melhor qualidade.",
        "uncensored": True,
        "tags": ["chat", "uncensored", "gpu", "completo"],
    },
    {
        "id": "gemma3-4b-vision",
        "name": "Gemma 3 4B (Vision)",
        "filename": "gemma-3-4b-it-Q4_K_M.gguf",
        "url": "https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf",
        "size_gb": 3.0,
        "type": "gpu",
        "desc": "Multimodal com visao (webcam/scanner). GPU 4GB+.",
        "uncensored": False,
        "tags": ["vision", "multimodal", "gpu"],
    },
    {
        "id": "qwen25-1.5b-cpu",
        "name": "Qwen 2.5 1.5B (CPU)",
        "filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "size_gb": 1.1,
        "type": "cpu",
        "desc": "Modelo leve. Roda em qualquer PC sem GPU.",
        "uncensored": False,
        "tags": ["chat", "cpu", "leve"],
    },
    {
        "id": "qwen25-0.5b-emergency",
        "name": "Qwen 2.5 0.5B (Emergencia)",
        "filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "size_gb": 0.4,
        "type": "cpu",
        "desc": "Modelo de emergencia (~400MB). Multilingual. Sempre incluso.",
        "uncensored": False,
        "tags": ["chat", "cpu", "emergencia", "sempre-incluso"],
    },
]

EMERGENCY_MODEL_ID = "qwen25-0.5b-emergency"

# Track active GGUF downloads (mutated by system router)
_active_downloads: dict = {}

# Auto-download status (mutated by system router)
_auto_download_status: dict = {}

# ── Map regions ───────────────────────────────────────────────────────────────
PROTOMAPS_BUILD = "https://build.protomaps.com/20260317.pmtiles"

MAP_REGIONS: dict = {
    "world_basic": {
        "name": "Mundo Basico (zoom 0-6)",
        "desc": "Mapa mundial com continentes, paises e cidades principais",
        "maxzoom": 6,
        "bbox": "-180,-85,180,85",
        "est_mb": 60,
    },
    "brazil": {
        "name": "Brasil (zoom 0-10)",
        "desc": "Brasil com estradas, cidades e detalhes regionais",
        "maxzoom": 10,
        "bbox": "-74.0,-34.0,-34.0,6.0",
        "est_mb": 250,
    },
    "south_america": {
        "name": "America do Sul (zoom 0-8)",
        "desc": "Continente sul-americano com cidades e estradas",
        "maxzoom": 8,
        "bbox": "-82.0,-56.0,-34.0,13.0",
        "est_mb": 200,
    },
    "north_america": {
        "name": "America do Norte (zoom 0-8)",
        "desc": "EUA, Canada e Mexico com detalhes",
        "maxzoom": 8,
        "bbox": "-170.0,15.0,-50.0,72.0",
        "est_mb": 300,
    },
    "europe": {
        "name": "Europa (zoom 0-8)",
        "desc": "Europa com cidades e estradas",
        "maxzoom": 8,
        "bbox": "-25.0,34.0,45.0,72.0",
        "est_mb": 350,
    },
}

# ── Terminal allowlist ────────────────────────────────────────────────────────
TERMINAL_ALLOWED_CMDS: set = {
    "ls", "dir", "cat", "type", "echo", "date", "whoami", "hostname",
    "pwd", "cd", "ping", "ipconfig", "ifconfig", "netstat", "nslookup",
    "df", "du", "free", "uptime", "uname", "env", "set", "tree",
    "head", "tail", "wc", "sort", "find", "grep", "which", "where",
    "python", "pip", "node", "npm", "git",
}

# ── Emulator constants ────────────────────────────────────────────────────────
EMU_CORES: dict = {
    "nes": "fceumm", "snes": "snes9x", "gb": "gambatte",
    "gba": "mgba", "genesis": "genesis_plus_gx",
}
EMU_EXTENSIONS: dict = {
    "nes": [".nes"], "snes": [".smc", ".sfc"], "gb": [".gb", ".gbc"],
    "gba": [".gba"], "genesis": [".md", ".gen"],
}

# ── Lazy voice engine state (mutated by tts_stt router) ──────────────────────
_whisper_model = None
_piper_available = None
_pyttsx3_available = None
_kokoro_instance = None
_kokoro_available = None
