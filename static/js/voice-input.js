/**
 * Bunker AI — Reusable Voice Input Module
 * Provides STT (Speech-to-Text) via Whisper (offline) or Web Speech API.
 * Used by: companion, journal, and any other app needing voice input.
 */

import { state } from './state.js';

let _activeRecorder = null;
let _activeChunks = [];

/**
 * Start recording voice. Returns a promise that resolves with the transcribed text.
 * @param {HTMLElement} btn - The mic button element (for visual feedback)
 * @param {Object} opts - Options: { lang: 'pt', onInterim: fn }
 * @returns {Promise<string>} Transcribed text
 */
export function recordVoice(btn, opts = {}) {
  const lang = opts.lang || 'pt';

  return new Promise((resolve, reject) => {
    if (state.sttEngine === 'whisper') {
      _recordWhisper(btn, lang, resolve, reject);
    } else {
      _recordBrowser(btn, lang, opts.onInterim, resolve, reject);
    }
  });
}

/**
 * Stop active recording (if any).
 */
export function stopRecording() {
  if (_activeRecorder && _activeRecorder.state === 'recording') {
    _activeRecorder.stop();
  }
  if (state.recognition) {
    state.recognition.stop();
  }
}

/**
 * Check if currently recording.
 */
export function isRecording() {
  return (_activeRecorder && _activeRecorder.state === 'recording') ||
         !!state.isListening;
}

/**
 * Record raw audio and return as Blob (for journal audio diary).
 * @param {HTMLElement} btn - Button for visual feedback
 * @returns {{ stop: () => Promise<Blob>, cancel: () => void }}
 */
export function recordAudio(btn) {
  let resolvePromise;
  const chunks = [];

  const promise = new Promise((resolve) => { resolvePromise = resolve; });

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    });
    _activeRecorder = recorder;
    if (btn) btn.classList.add('recording');

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (btn) btn.classList.remove('recording');
      _activeRecorder = null;
      const blob = new Blob(chunks, { type: recorder.mimeType });
      resolvePromise(blob);
    };
    recorder.start();
  }).catch(() => {
    if (btn) btn.classList.remove('recording');
    resolvePromise(null);
  });

  return {
    stop: () => {
      if (_activeRecorder && _activeRecorder.state === 'recording') {
        _activeRecorder.stop();
      }
      return promise;
    },
    cancel: () => {
      if (_activeRecorder && _activeRecorder.state === 'recording') {
        _activeRecorder.stop();
      }
    },
  };
}

// ─── Whisper (offline via backend) ───────────────────────────────────────────

function _recordWhisper(btn, lang, resolve, reject) {
  if (btn) btn.classList.add('recording');
  _activeChunks = [];

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _activeRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

    _activeRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _activeChunks.push(e.data);
    };

    _activeRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (btn) btn.classList.remove('recording');
      _activeRecorder = null;

      if (_activeChunks.length === 0) { resolve(''); return; }

      const blob = new Blob(_activeChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', lang);

      try {
        const r = await fetch('/api/stt', { method: 'POST', body: formData });
        const d = await r.json();
        if (d.text && d.text.trim()) {
          resolve(d.text.trim());
        } else {
          // Fallback to browser
          state.sttEngine = 'browser';
          resolve('');
        }
      } catch {
        state.sttEngine = 'browser';
        resolve('');
      }
    };

    _activeRecorder.start();
  }).catch(() => {
    if (btn) btn.classList.remove('recording');
    reject(new Error('Microfone negado'));
  });
}

// ─── Browser Web Speech API ─────────────────────────────────────────────────

function _recordBrowser(btn, lang, onInterim, resolve, reject) {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    reject(new Error('Speech Recognition nao suportado'));
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = lang === 'pt' ? 'pt-BR' : lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  state.recognition = recognition;

  if (btn) btn.classList.add('recording');
  state.isListening = true;
  let finalTranscript = '';

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    if (onInterim) onInterim(finalTranscript + interim);
  };

  recognition.onend = () => {
    if (btn) btn.classList.remove('recording');
    state.isListening = false;
    state.recognition = null;
    resolve(finalTranscript.trim());
  };

  recognition.onerror = () => {
    if (btn) btn.classList.remove('recording');
    state.isListening = false;
    state.recognition = null;
    resolve('');
  };

  recognition.start();
}
