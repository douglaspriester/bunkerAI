/**
 * Bunker AI — 3D Companion (three-vrm)
 * A friendly AI avatar that connects to the existing chat + TTS system.
 * Runs 100% offline with three.js + @pixiv/three-vrm.
 *
 * Features:
 * - VRM avatar with expressions (happy, sad, angry, surprised, relaxed)
 * - VRMA idle animation (idle_loop.vrma from ChatVRM)
 * - Lip sync via Web Audio API AnalyserNode (real audio-driven mouth)
 * - Speaking body animations (head nod, arm gestures)
 * - Blinking, breathing
 */

import { state } from './state.js';
import { streamFromAPI } from './chat.js';
import { markdownToHtml } from './markdown.js';

let _scene, _camera, _renderer, _vrm, _clock;
let _mixer; // THREE.AnimationMixer for VRMA
let _idleAction; // idle loop animation action
let _canvas;
let _isInitialized = false;
let _isSpeaking = false;
let _blinkTimer = 0;
let _breathTimer = 0;
let _mouthValue = 0;
let _animationFrame;

// Lip sync via Web Audio API
let _audioContext;
let _analyser;
let _audioDataArray;
let _lipSyncVolume = 0;

// Morph target names (VRM standard)
const BLEND_SHAPES = {
  blink: 'blink',
  blinkLeft: 'blinkLeft',
  blinkRight: 'blinkRight',
  aa: 'aa',       // mouth open (ah)
  ih: 'ih',       // mouth spread (ee)
  ou: 'ou',       // mouth round (oo)
  ee: 'ee',       // mouth narrow
  oh: 'oh',       // mouth round small
  happy: 'happy',
  angry: 'angry',
  sad: 'sad',
  relaxed: 'relaxed',
  surprised: 'surprised',
};

// Chat history for the companion
let _companionMessages = [];
const COMPANION_SYSTEM = `Voce e um companheiro de bunker amigavel e empático. Seu nome e Atlas.
Voce esta aqui para ajudar, conversar, dar apoio emocional e manter a pessoa calma.
Seja breve nas respostas (2-3 frases max). Use tom casual e acolhedor.
Voce tem um corpo 3D e pode expressar emocoes. Quando apropriado, inclua uma tag de emocao no INICIO da resposta:
[happy] [sad] [angry] [surprised] [relaxed]
Exemplo: [happy] Que bom te ver! Como posso ajudar?`;

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initCompanion() {
  if (_isInitialized) return;

  _canvas = document.getElementById('companionCanvas');
  if (!_canvas) return;

  try {
    // Dynamic imports for three.js, GLTFLoader, and three-vrm
    const THREE = await import('three');
    const { GLTFLoader } = await import('../lib/GLTFLoader.js');
    let VRMLoaderPlugin = null;
    let VRMAnimationLoaderPlugin = null;
    let createVRMAnimationClip = null;

    try {
      const vrm = await import('../lib/three-vrm.module.js');
      VRMLoaderPlugin = vrm.VRMLoaderPlugin;
    } catch (e) {
      console.warn('[Companion] three-vrm not available:', e.message);
    }

    try {
      const vrmAnim = await import('../lib/three-vrm-animation.module.js');
      VRMAnimationLoaderPlugin = vrmAnim.VRMAnimationLoaderPlugin;
      createVRMAnimationClip = vrmAnim.createVRMAnimationClip;
    } catch (e) {
      console.warn('[Companion] three-vrm-animation not available:', e.message);
    }

    _clock = new THREE.Clock();

    // Scene
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x1a1a2e);

    // Camera — upper body framing
    _camera = new THREE.PerspectiveCamera(25, _canvas.clientWidth / _canvas.clientHeight, 0.1, 20);
    _camera.position.set(0, 1.4, 1.8);
    _camera.lookAt(0, 1.25, 0);

    // Renderer
    _renderer = new THREE.WebGLRenderer({ canvas: _canvas, antialias: true, alpha: true });
    _renderer.setSize(_canvas.clientWidth, _canvas.clientHeight);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    _scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(1, 2, 3);
    _scene.add(dir);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-1, 1, -1);
    _scene.add(fill);

    // Setup GLTFLoader with plugins
    const loader = new GLTFLoader();
    if (VRMLoaderPlugin) {
      loader.register((parser) => new VRMLoaderPlugin(parser));
    }
    if (VRMAnimationLoaderPlugin) {
      loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    }

    // Load VRM avatar
    const vrmPath = '../avatars/companion.vrm';
    try {
      const gltf = await loader.loadAsync(vrmPath);
      _vrm = gltf.userData.vrm;
      if (_vrm) {
        _scene.add(_vrm.scene);
        _vrm.scene.rotation.y = Math.PI; // Face camera
        setNaturalPose(_vrm);

        // Setup AnimationMixer
        _mixer = new THREE.AnimationMixer(_vrm.scene);

        // Load idle_loop.vrma
        if (createVRMAnimationClip) {
          try {
            const vrmaGltf = await loader.loadAsync('../avatars/idle_loop.vrma');
            const vrmAnimations = vrmaGltf.userData.vrmAnimations;
            if (vrmAnimations && vrmAnimations.length > 0) {
              const clip = createVRMAnimationClip(vrmAnimations[0], _vrm);
              _idleAction = _mixer.clipAction(clip);
              _idleAction.play();
              console.log('[Companion] VRMA idle animation loaded');
            }
          } catch (e) {
            console.warn('[Companion] VRMA idle not loaded:', e.message);
          }
        }

        console.log('[Companion] VRM avatar loaded');
      }
    } catch (e) {
      console.warn('[Companion] VRM not found, using placeholder:', e.message);
      createPlaceholderAvatar(THREE);
    }

    _isInitialized = true;
    animate();
    console.log('[Companion] Initialized');

  } catch (e) {
    console.error('[Companion] Failed to initialize:', e);
    showFallbackUI();
  }
}

// ─── Placeholder avatar (no VRM file) ────────────────────────────────────────

function createPlaceholderAvatar(THREE) {
  const group = new THREE.Group();
  const headGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x66bbff });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.55;
  group.add(head);
  const bodyGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4488cc });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.15;
  group.add(body);
  const eyeGeo = new THREE.SphereGeometry(0.025, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.05, 1.58, 0.13);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.05, 1.58, 0.13);
  group.add(rightEye);
  const pupilGeo = new THREE.SphereGeometry(0.012, 8, 8);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-0.05, 1.58, 0.15);
  group.add(leftPupil);
  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(0.05, 1.58, 0.15);
  group.add(rightPupil);
  const mouthGeo = new THREE.BoxGeometry(0.06, 0.008, 0.01);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, 1.49, 0.14);
  mouth.name = 'mouth';
  group.add(mouth);
  _scene.add(group);
  _vrm = null;
  group.name = 'placeholderAvatar';
}

// ─── Fallback UI (no WebGL) ──────────────────────────────────────────────────

function showFallbackUI() {
  const container = document.getElementById('companionCanvas')?.parentElement;
  if (!container) return;
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;color:var(--text-muted)">
      <div style="font-size:64px">🤖</div>
      <p style="margin-top:12px">Atlas — Seu Companheiro</p>
      <p style="font-size:11px;opacity:0.6">WebGL nao disponivel. Chat por texto abaixo.</p>
    </div>`;
}

// ─── Natural Pose (fix T-pose) ──────────────────────────────────────────────

function setNaturalPose(vrm) {
  if (!vrm || !vrm.humanoid) return;
  const h = vrm.humanoid;
  const setRot = (boneName, x, y, z) => {
    const node = h.getNormalizedBoneNode(boneName);
    if (node) node.rotation.set(x, y, z);
  };
  setRot('leftShoulder', 0, 0, 0.1);
  setRot('rightShoulder', 0, 0, -0.1);
  setRot('leftUpperArm', 0.2, 0, 1.2);
  setRot('rightUpperArm', 0.2, 0, -1.2);
  setRot('leftLowerArm', 0, 0, 0.3);
  setRot('rightLowerArm', 0, 0, -0.3);
  setRot('leftHand', 0, 0, 0.05);
  setRot('rightHand', 0, 0, -0.05);
  setRot('head', 0.05, 0, 0);
  setRot('neck', 0.03, 0, 0);
  if (vrm.expressionManager) {
    vrm.expressionManager.setValue('relaxed', 0.3);
  }
  vrm.update(0);
}

// ─── Lip Sync (Web Audio API) ───────────────────────────────────────────────

function getLipSyncVolume() {
  if (!_analyser || !_audioDataArray) return 0;
  _analyser.getByteFrequencyData(_audioDataArray);
  // Average volume from voice frequency range (80Hz-3000Hz)
  // With 2048 FFT and 24000 sample rate, bin = sampleRate/fftSize ≈ 11.7Hz
  // 80Hz ≈ bin 7, 3000Hz ≈ bin 256
  const start = 7;
  const end = Math.min(256, _audioDataArray.length);
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += _audioDataArray[i];
  }
  const avg = sum / (end - start);
  return avg / 255; // normalize 0-1
}

// ─── Organic Motion Helpers ──────────────────────────────────────────────────

// Perlin-like noise from multiple sine waves (more organic than single sine)
function noise(t, seed = 0) {
  return Math.sin(t * 1.1 + seed) * 0.5
       + Math.sin(t * 2.3 + seed * 1.7) * 0.3
       + Math.sin(t * 4.7 + seed * 0.3) * 0.2;
}

// Smooth lerp for bone rotations (inertia)
const _boneTargets = {};
function smoothBone(h, boneName, tx, ty, tz, speed = 0.08) {
  const node = h.getNormalizedBoneNode(boneName);
  if (!node) return;
  if (!_boneTargets[boneName]) _boneTargets[boneName] = { x: tx, y: ty, z: tz };
  const b = _boneTargets[boneName];
  b.x += (tx - b.x) * speed;
  b.y += (ty - b.y) * speed;
  b.z += (tz - b.z) * speed;
  node.rotation.set(b.x, b.y, b.z);
}

// Gesture system — random gesture changes during speech
let _gesturePhase = 0;
let _gestureTimer = 0;
let _gestureStyle = 0; // 0-3 different gesture patterns

// ─── Animation Loop ──────────────────────────────────────────────────────────

function animate() {
  _animationFrame = requestAnimationFrame(animate);
  if (!_isInitialized) return;

  const delta = _clock.getDelta();
  const t = Date.now() * 0.001;

  _breathTimer += delta;
  _blinkTimer += delta;

  // Update VRMA animation mixer (idle_loop)
  if (_mixer) _mixer.update(delta);

  // ── Fix head rotation after VRMA update ──
  // The VRMA idle animation can rotate head/neck bones in ways that conflict
  // with the scene's Math.PI rotation, causing the head to face backwards.
  // Clamp head and neck Y rotation to a sane range after animation update.
  if (_vrm && _vrm.humanoid) {
    const clampBoneY = (boneName, minY, maxY) => {
      const node = _vrm.humanoid.getNormalizedBoneNode(boneName);
      if (node) {
        if (Math.abs(node.rotation.y) > Math.PI * 0.5) {
          // Head is more than 90° turned — likely animation conflict, reset
          node.rotation.y = 0;
        }
        node.rotation.y = Math.max(minY, Math.min(maxY, node.rotation.y));
      }
    };
    clampBoneY('head', -0.5, 0.5);
    clampBoneY('neck', -0.3, 0.3);
  }

  // Breathing (subtle Y oscillation + slight forward lean)
  const breathOffset = Math.sin(_breathTimer * 1.5) * 0.003;

  if (_vrm && _vrm.humanoid) {
    _vrm.scene.position.y = breathOffset;
    const h = _vrm.humanoid;

    if (_isSpeaking) {
      // ── Speaking: organic body language ──
      if (_idleAction) _idleAction.weight = 0.2;

      // Change gesture style every 2-4 seconds
      _gestureTimer += delta;
      if (_gestureTimer > 2 + Math.random() * 2) {
        _gestureTimer = 0;
        _gestureStyle = Math.floor(Math.random() * 4);
        _gesturePhase = t;
      }
      const gt = t - _gesturePhase; // time since gesture change

      // Head — gentle nodding (reduced to avoid exorcist effect)
      const headNod = noise(t * 1.5, 1) * 0.03;
      const headTurn = noise(t * 0.8, 5) * 0.04;
      const headTilt = noise(t * 0.6, 9) * 0.02;
      smoothBone(h, 'head', 0.05 + headNod, headTurn, headTilt, 0.06);

      // Neck — very subtle, follows head direction
      smoothBone(h, 'neck', 0.03 + noise(t * 1.0, 2) * 0.015, noise(t * 0.5, 6) * 0.02, 0, 0.05);

      // Spine — minimal lean
      smoothBone(h, 'spine', noise(t * 0.4, 3) * 0.015, 0, noise(t * 0.3, 7) * 0.008, 0.04);

      // Arms — different gesture patterns
      const baseArmL = 1.15;
      const baseArmR = -1.15;
      if (_gestureStyle === 0) {
        // Gentle emphasis — small movements
        smoothBone(h, 'leftUpperArm', 0.2 + noise(t * 1.8, 10) * 0.06, 0, baseArmL + noise(t * 1.3, 11) * 0.1, 0.1);
        smoothBone(h, 'rightUpperArm', 0.2 + noise(t * 1.5, 12) * 0.06, 0, baseArmR + noise(t * 1.1, 13) * 0.1, 0.1);
      } else if (_gestureStyle === 1) {
        // Right hand gesture — one arm moves more
        smoothBone(h, 'leftUpperArm', 0.2, 0, baseArmL, 0.08);
        smoothBone(h, 'rightUpperArm', 0.15 + noise(t * 2.0, 14) * 0.12, 0.1, baseArmR + noise(t * 1.8, 15) * 0.18, 0.12);
        smoothBone(h, 'rightLowerArm', 0, 0, -0.3 + noise(t * 2.2, 16) * 0.15, 0.1);
      } else if (_gestureStyle === 2) {
        // Both hands — animated talking
        smoothBone(h, 'leftUpperArm', 0.15 + noise(t * 1.6, 17) * 0.1, 0, baseArmL + noise(t * 2.0, 18) * 0.15, 0.1);
        smoothBone(h, 'rightUpperArm', 0.15 + noise(t * 1.9, 19) * 0.1, 0, baseArmR + noise(t * 1.7, 20) * 0.15, 0.1);
      } else {
        // Calm — minimal arm movement, more head
        smoothBone(h, 'leftUpperArm', 0.2, 0, baseArmL, 0.05);
        smoothBone(h, 'rightUpperArm', 0.2, 0, baseArmR, 0.05);
      }

      // Hands — subtle wrist movement
      smoothBone(h, 'leftHand', noise(t * 2.5, 21) * 0.08, 0, 0.05 + noise(t * 3.0, 22) * 0.08, 0.1);
      smoothBone(h, 'rightHand', noise(t * 2.8, 23) * 0.08, 0, -0.05 + noise(t * 3.2, 24) * 0.08, 0.1);

      // Shoulders — subtle rise on emphasis
      smoothBone(h, 'leftShoulder', 0, 0, 0.1 + noise(t * 1.0, 25) * 0.03, 0.06);
      smoothBone(h, 'rightShoulder', 0, 0, -0.1 + noise(t * 1.1, 26) * 0.03, 0.06);

    } else {
      // ── Idle: VRMA handles base, we add organic overlay ──
      if (_idleAction) {
        _idleAction.weight = 1.0;
        // Override head/neck to safe values with micro-movements
        // (don't use += to avoid accumulation on VRMA-animated values)
        smoothBone(h, 'head',
          0.05 + noise(_breathTimer * 0.3, 30) * 0.01,
          noise(_breathTimer * 0.2, 31) * 0.015,
          noise(_breathTimer * 0.25, 32) * 0.008,
          0.06
        );
        smoothBone(h, 'neck',
          0.03 + noise(_breathTimer * 0.25, 33) * 0.005,
          noise(_breathTimer * 0.15, 34) * 0.01,
          0,
          0.05
        );
      } else {
        // No VRMA — full manual idle with organic noise
        smoothBone(h, 'head',
          0.05 + noise(_breathTimer * 0.5, 30) * 0.02,
          noise(_breathTimer * 0.3, 31) * 0.04,
          noise(_breathTimer * 0.2, 32) * 0.015,
          0.05
        );
        smoothBone(h, 'neck', 0.03 + noise(_breathTimer * 0.4, 33) * 0.01, 0, 0, 0.04);
        // Subtle weight shift
        smoothBone(h, 'spine', noise(_breathTimer * 0.15, 34) * 0.01, 0, noise(_breathTimer * 0.1, 35) * 0.008, 0.03);
        // Arms sway slightly
        smoothBone(h, 'leftUpperArm', 0.2 + noise(_breathTimer * 0.2, 36) * 0.02, 0, 1.2 + noise(_breathTimer * 0.15, 37) * 0.03, 0.03);
        smoothBone(h, 'rightUpperArm', 0.2 + noise(_breathTimer * 0.25, 38) * 0.02, 0, -1.2 + noise(_breathTimer * 0.18, 39) * 0.03, 0.03);
      }
    }
  } else {
    const ph = _scene.getObjectByName('placeholderAvatar');
    if (ph) ph.position.y = breathOffset;
  }

  // Blinking — more natural with occasional double-blink
  if (_vrm && _vrm.expressionManager) {
    const blinkInterval = _isSpeaking ? 2 + Math.random() * 2 : 3 + Math.random() * 4;
    if (_blinkTimer > blinkInterval) {
      _blinkTimer = 0;
      blinkAnimation();
      // 20% chance of double blink
      if (Math.random() < 0.2) {
        setTimeout(() => blinkAnimation(), 250);
      }
    }
  }

  // ── Lip sync — audio-driven mouth ──
  if (_vrm && _vrm.expressionManager) {
    if (_isSpeaking && _analyser) {
      // Real lip sync from audio volume
      const vol = getLipSyncVolume();
      _lipSyncVolume += (vol - _lipSyncVolume) * 0.35;

      // Map volume to varied mouth shapes
      const aa = Math.min(1, _lipSyncVolume * 2.5);
      const oh = Math.min(1, _lipSyncVolume * 1.5) * (0.2 + noise(t * 5, 40) * 0.15);
      const ih = _lipSyncVolume > 0.15 && noise(t * 6, 41) > 0.2 ? _lipSyncVolume * 0.4 : 0;

      _vrm.expressionManager.setValue('aa', aa);
      _vrm.expressionManager.setValue('oh', oh);
      _vrm.expressionManager.setValue('ih', ih);
    } else if (_isSpeaking) {
      // Fallback: noise-based mouth (more organic than sine)
      const base = 0.3 + noise(t * 8, 42) * 0.35;
      const aa = Math.max(0, Math.min(1, base));
      const oh = Math.max(0, noise(t * 6, 43) * 0.3);
      _vrm.expressionManager.setValue('aa', aa);
      _vrm.expressionManager.setValue('oh', oh);
    } else {
      // Smoothly close mouth
      _mouthValue *= 0.85;
      _lipSyncVolume *= 0.85;
      _vrm.expressionManager.setValue('aa', _mouthValue);
      _vrm.expressionManager.setValue('oh', 0);
      _vrm.expressionManager.setValue('ih', 0);
    }
  } else {
    const mouth = _scene.getObjectByName('mouth');
    if (mouth) {
      const openness = _isSpeaking ? 0.015 + noise(t * 8, 44) * 0.008 : 0.008;
      mouth.scale.y = openness / 0.008;
    }
  }

  // Update VRM
  if (_vrm) _vrm.update(delta);

  _renderer.render(_scene, _camera);
}

function blinkAnimation() {
  if (!_vrm || !_vrm.expressionManager) return;
  _vrm.expressionManager.setValue('blink', 1);
  setTimeout(() => {
    if (_vrm && _vrm.expressionManager) {
      _vrm.expressionManager.setValue('blink', 0);
    }
  }, 150);
}

// ─── Expression ──────────────────────────────────────────────────────────────

function setExpression(name, value = 1, duration = 2000) {
  if (!_vrm || !_vrm.expressionManager) return;
  for (const key of Object.values(BLEND_SHAPES)) {
    if (key !== 'blink' && key !== 'aa' && key !== 'oh' && key !== 'ih') {
      _vrm.expressionManager.setValue(key, 0);
    }
  }
  _vrm.expressionManager.setValue(name, value);
  if (duration > 0) {
    setTimeout(() => {
      if (_vrm && _vrm.expressionManager) {
        _vrm.expressionManager.setValue(name, 0);
      }
    }, duration);
  }
}

// ─── Chat Integration ────────────────────────────────────────────────────────

export async function companionSend(text) {
  if (!text.trim()) return;

  const chatBox = document.getElementById('companionChat');
  const input = document.getElementById('companionInput');

  appendCompanionMsg('user', text);
  if (input) input.value = '';

  _companionMessages.push({ role: 'user', content: text });

  const model = document.getElementById('chatModel')?.value ||
                (state.autoModels || {}).chat || '';

  const msgEl = appendCompanionMsg('assistant', '...');
  const response = await streamCompanionResponse(model, msgEl);

  if (response) {
    const EMOTION_MAP = {
      happy: 'happy', joy: 'happy', excited: 'happy', cheerful: 'happy',
      sad: 'sad', compassionate: 'sad', worried: 'sad', concerned: 'sad',
      angry: 'angry', frustrated: 'angry',
      surprised: 'surprised', curious: 'surprised', amazed: 'surprised',
      relaxed: 'relaxed', calm: 'relaxed', thoughtful: 'relaxed', gentle: 'relaxed',
    };
    const emotionMatch = response.match(/^\[(\w+)\]\s*/i);
    let cleanResponse = response;
    if (emotionMatch && EMOTION_MAP[emotionMatch[1].toLowerCase()]) {
      setExpression(EMOTION_MAP[emotionMatch[1].toLowerCase()], 1, 3000);
      cleanResponse = response.slice(emotionMatch[0].length);
    } else if (emotionMatch) {
      cleanResponse = response.slice(emotionMatch[0].length);
      setExpression('relaxed', 0.5, 2000);
    } else {
      setExpression('relaxed', 0.5, 2000);
    }

    _companionMessages.push({ role: 'assistant', content: cleanResponse });
    speakResponse(cleanResponse);
  }
}

async function streamCompanionResponse(model, msgEl) {
  let full = '';
  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: COMPANION_SYSTEM },
          ..._companionMessages,
        ],
        stream: true,
      }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              full += data.token;
              msgEl.textContent = full;
              const chatBox = document.getElementById('companionChat');
              if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    msgEl.textContent = `Erro: ${e.message}`;
    return null;
  }

  const emotionClean = full.match(/^\[\w+\]\s*/i);
  if (emotionClean) {
    full = full.slice(emotionClean[0].length);
  }
  if (full) {
    msgEl.innerHTML = markdownToHtml(full);
  }

  return full;
}

function appendCompanionMsg(role, text) {
  const chatBox = document.getElementById('companionChat');
  if (!chatBox) return null;

  const div = document.createElement('div');
  div.className = `companion-msg companion-msg-${role}`;
  const contentEl = document.createElement('span');
  contentEl.textContent = text;
  div.appendChild(contentEl);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return contentEl;
}

// ─── TTS + Lip Sync Integration ─────────────────────────────────────────────

async function speakResponse(text) {
  if (!text) return;
  _isSpeaking = true;

  // Let server pick best offline engine: kokoro → piper → pyttsx3 (cross-platform)
  try {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: 'pt-BR-FranciscaNeural',
        kokoro_voice: 'pf_dora',
      }),
    });
    if (r.ok) {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      // Setup Web Audio API for lip sync analysis
      try {
        if (!_audioContext) {
          _audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        _analyser = _audioContext.createAnalyser();
        _analyser.fftSize = 2048;
        _analyser.smoothingTimeConstant = 0.6;
        _audioDataArray = new Uint8Array(_analyser.frequencyBinCount);

        const audio = new Audio(url);
        const source = _audioContext.createMediaElementSource(audio);
        source.connect(_analyser);
        _analyser.connect(_audioContext.destination);

        audio.onended = () => {
          _isSpeaking = false;
          _analyser = null;
          _audioDataArray = null;
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          _isSpeaking = false;
          _analyser = null;
        };
        await audio.play();
        return;
      } catch (audioErr) {
        // Web Audio API failed — play without lip sync
        console.warn('[Companion] Web Audio API unavailable, playing without lip sync');
        const audio = new Audio(url);
        audio.onended = () => {
          _isSpeaking = false;
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => { _isSpeaking = false; };
        await audio.play();
        return;
      }
    }
  } catch { /* TTS unavailable */ }

  // TTS failed — simulate speech for mouth animation
  console.warn('[Companion] TTS unavailable');
  setTimeout(() => { _isSpeaking = false; }, Math.min(text.length * 60, 5000));
}

// ─── Resize ──────────────────────────────────────────────────────────────────

export function resizeCompanion() {
  if (!_canvas || !_renderer || !_camera) return;
  const w = _canvas.clientWidth;
  const h = _canvas.clientHeight;
  _renderer.setSize(w, h);
  _camera.aspect = w / h;
  _camera.updateProjectionMatrix();
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function destroyCompanion() {
  if (_animationFrame) cancelAnimationFrame(_animationFrame);
  if (_renderer) _renderer.dispose();
  if (_mixer) _mixer.stopAllAction();
  if (_audioContext) {
    try { _audioContext.close(); } catch {}
    _audioContext = null;
  }
  _isInitialized = false;
  _vrm = null;
  _scene = null;
  _mixer = null;
  _idleAction = null;
  _analyser = null;
  _audioDataArray = null;
  _companionMessages = [];
}
