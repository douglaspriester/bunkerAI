/**
 * Bunker AI — Reusable Voice Input Module
 * Provides STT (Speech-to-Text) via Whisper (offline) or Web Speech API.
 * Used by: companion, journal, and any other app needing voice input.
 */

import { state } from './state.js';

let _activeRecorder = null;
let _activeChunks = [];
let _recordingTimeout = null;

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
  if (_recordingTimeout) {
    clearTimeout(_recordingTimeout);
    _recordingTimeout = null;
  }
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
    recorder.onerror = () => {
      stream.getTracks().forEach(t => t.stop());
      if (btn) btn.classList.remove('recording');
      _activeRecorder = null;
      resolvePromise(null);
    };
    recorder.start();
  }).catch((err) => {
    if (btn) btn.classList.remove('recording');
    if (err && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) {
      console.warn('Audio recording:', err.name, err.message);
    }
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

  // Pick a MIME type that this browser actually supports
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const recOpts = mimeType ? { mimeType } : {};
    _activeRecorder = new MediaRecorder(stream, recOpts);

    // 60-second recording timeout
    _recordingTimeout = setTimeout(() => stopRecording(), 60000);

    _activeRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) _activeChunks.push(e.data);
    };

    _activeRecorder.onstop = async () => {
      if (_recordingTimeout) { clearTimeout(_recordingTimeout); _recordingTimeout = null; }
      stream.getTracks().forEach(t => t.stop());
      _activeRecorder = null;

      if (_activeChunks.length === 0) {
        if (btn) btn.classList.remove('recording');
        resolve('');
        return;
      }

      // Show processing state while server transcribes
      if (btn) {
        btn.classList.remove('recording');
        btn.classList.add('processing');
      }

      const blobType = mimeType || 'audio/webm';
      const ext = blobType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(_activeChunks, { type: blobType });
      const formData = new FormData();
      formData.append('audio', blob, `recording.${ext}`);
      formData.append('language', lang);

      try {
        const r = await fetch('/api/stt', { method: 'POST', body: formData });
        const d = await r.json();
        if (!r.ok) {
          console.warn('[STT] server error:', d.error || r.status);
          if (d.use_browser) state.sttEngine = 'browser';
          resolve('');
        } else if (d.text && d.text.trim()) {
          resolve(d.text.trim());
        } else {
          // Empty transcription — silently return empty string (don't break engine)
          resolve('');
        }
      } catch (err) {
        console.warn('[STT] fetch error:', err);
        state.sttEngine = 'browser';
        resolve('');
      } finally {
        if (btn) btn.classList.remove('processing');
      }
    };

    _activeRecorder.start();
  }).catch((err) => {
    if (_recordingTimeout) { clearTimeout(_recordingTimeout); _recordingTimeout = null; }
    if (btn) btn.classList.remove('recording');
    if (err && err.name === 'NotAllowedError') {
      reject(new Error('Permissao de microfone negada. Permita o acesso ao microfone nas configuracoes do navegador.'));
    } else if (err && err.name === 'NotFoundError') {
      reject(new Error('Nenhum microfone encontrado. Conecte um microfone e tente novamente.'));
    } else {
      reject(new Error('Microfone negado'));
    }
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

  // 60-second recording timeout
  _recordingTimeout = setTimeout(() => stopRecording(), 60000);

  recognition.onend = () => {
    if (_recordingTimeout) { clearTimeout(_recordingTimeout); _recordingTimeout = null; }
    if (btn) btn.classList.remove('recording');
    state.isListening = false;
    state.recognition = null;
    resolve(finalTranscript.trim());
  };

  recognition.onerror = (event) => {
    if (_recordingTimeout) { clearTimeout(_recordingTimeout); _recordingTimeout = null; }
    if (btn) btn.classList.remove('recording');
    state.isListening = false;
    state.recognition = null;
    if (event.error === 'not-allowed') {
      reject(new Error('Permissao de microfone negada. Permita o acesso ao microfone nas configuracoes do navegador.'));
    } else if (event.error === 'no-speech' || event.error === 'audio-capture') {
      resolve('');
    } else {
      resolve('');
    }
  };

  recognition.start();
}
