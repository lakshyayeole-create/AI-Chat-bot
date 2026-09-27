import * as THREE from 'three';

// ─── Easing Functions ──────────────────────────────────────────────────────────
export const easeOutBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

export const easeOutCubic = (x: number): number => {
  return 1 - Math.pow(1 - x, 3);
};

// ─── Trajectory Definition ─────────────────────────────────────────────────────
export interface TrajectoryDef {
  startTime: number;
  duration: number;
  offset?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  easing: 'back' | 'cubic';
}

// ─── Clean Assembly Component Timeline ────────────────────────────────────────
// Pure mechanical suit-up:
// 0.0s – Interior dental frame & mic
// 0.35s – 1.7s: Ear rotaries, cogs, hydraulic pistons glide in along X axis
// 1.5s – 2.7s: Cranial dome & rear plates drop down from top-back
// 2.4s – 3.5s: Lower jaw swings up from below, cheeks & brow align
// 3.5s – 4.5s: Golden faceplate visor glides in from front-top and clamps shut
// 4.6s: Arc reactor eyes ignite!
export const TRAJECTORIES: Record<string, TrajectoryDef> = {
  // ── Stationary Core Frame ──
  WholeTeeth:         { startTime: 0.0, duration: 0.1, offset: [0, 0, 0], easing: 'cubic' },
  UpperTeethOuter:    { startTime: 0.0, duration: 0.1, offset: [0, 0, 0], easing: 'cubic' },
  UpperToothInner:    { startTime: 0.0, duration: 0.1, offset: [0, 0, 0], easing: 'cubic' },
  Mic:                { startTime: 0.1, duration: 0.5, offset: [0, -15, 15], easing: 'cubic' },

  // ── Phase 1: Ear Rotaries & Hydraulic Cogs (slide along X axis from sides) ──
  L_CogWheel:         { startTime: 0.35, duration: 1.35, offset: [0, 10, -15], scale: [2.5, 1.25, 1.25], easing: 'back' },
  L_BackPlateRotary:  { startTime: 0.45, duration: 1.35, offset: [0, 15, -20], scale: [2.4, 1.2, 1.2], easing: 'back' },
  L_EarHook:          { startTime: 0.55, duration: 1.25, offset: [0, 10, -15], scale: [2.3, 1.2, 1.2], easing: 'back' },
  L_EarTabCatch:      { startTime: 0.60, duration: 1.25, offset: [0, 10, -15], scale: [2.3, 1.2, 1.2], easing: 'back' },
  L_DomePin:          { startTime: 0.70, duration: 1.15, offset: [0, 15, -10], scale: [2.1, 1.15, 1.15], easing: 'back' },
  JawPin:             { startTime: 0.75, duration: 1.15, offset: [0, -15, -10], scale: [2.2, 1.15, 1.15], easing: 'back' },
  L_ServoArm:         { startTime: 0.90, duration: 1.10, offset: [0, 15, 10], scale: [2.1, 1.15, 1.15], easing: 'back' },
  L_JawPiston:        { startTime: 1.00, duration: 1.10, offset: [0, -10, 15], scale: [2.2, 1.15, 1.15], easing: 'back' },
  L_JawPivot:         { startTime: 1.05, duration: 1.10, offset: [0, -10, 15], scale: [2.2, 1.15, 1.15], easing: 'back' },
  L_HelperArm:        { startTime: 1.15, duration: 1.05, offset: [0, 10, 20], scale: [2.1, 1.15, 1.15], easing: 'back' },
  L_LowerFacePlatePin:{ startTime: 1.25, duration: 1.00, offset: [0, 5, 25], scale: [2.0, 1.1, 1.1], easing: 'back' },
  L_UpperFacePlatePin:{ startTime: 1.30, duration: 1.00, offset: [0, 15, 25], scale: [2.0, 1.1, 1.1], easing: 'back' },

  // ── Phase 2: Cranial Dome & Rear Skull Plates (drop down from top-back) ──
  BackPlate1:         { startTime: 1.50, duration: 1.15, offset: [0, 35, -90], scale: [1.08, 1.08, 1.08], easing: 'cubic' },
  BackPlate2:         { startTime: 1.65, duration: 1.15, offset: [0, 45, -110], scale: [1.08, 1.08, 1.08], easing: 'cubic' },
  Dome:               { startTime: 1.85, duration: 1.15, offset: [0, 70, -20], easing: 'cubic' },

  // ── Phase 3: Jaw, Cheeks, Eyelids & Brows ──
  Jaw:                { startTime: 2.35, duration: 1.10, offset: [0, -55, 20], easing: 'cubic' },
  LowerLip:           { startTime: 2.50, duration: 1.05, offset: [0, -65, 25], easing: 'cubic' },
  L_Cheek:            { startTime: 2.70, duration: 1.00, offset: [0, -15, 40], scale: [1.5, 1.1, 1.1], easing: 'cubic' },
  L_Eyebrow:          { startTime: 2.85, duration: 0.95, offset: [0, 20, 40], scale: [1.4, 1.1, 1.1], easing: 'cubic' },
  EyeLidInnerLayer:   { startTime: 3.00, duration: 0.90, offset: [0, 0, 45], easing: 'cubic' },
  EyeLidOuterLayer:   { startTime: 3.10, duration: 0.90, offset: [0, 0, 45], easing: 'cubic' },
  L_EyeLens:          { startTime: 3.20, duration: 0.85, offset: [0, 0, 30], easing: 'cubic' },

  // ── Phase 4: Golden Faceplate Visor Glides Straight In from Front ──
  FacePlate_Detailed: {
    startTime: 3.45,
    duration: 1.05,
    offset: [0, 0, 95], // Pure frontal approach along Z axis - prevents dipping into cheeks or jaw!
    easing: 'cubic'     // Monotonic cubic deceleration with ZERO overshoot past the components!
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrajectoryTrack {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  startRot: THREE.Euler;
  startScale: THREE.Vector3;
  startTime: number;
  duration: number;
  easing: 'back' | 'cubic';
  baseMats: THREE.MeshStandardMaterial[];
}

export interface AssemblyController {
  active: boolean;
  startTime: number;
  tracks: TrajectoryTrack[];
  eyeMaterial: THREE.MeshStandardMaterial | null;
  audioElement: HTMLAudioElement | null;
  start: () => void;
  update: (
    now: number,
    camera: THREE.PerspectiveCamera,
    baseYCam: number
  ) => {
    isComplete: boolean;
    progress: number;
    statusText: string;
  };
  resetToAssembled: () => void;
  dispose: () => void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createAssemblySystem(
  model: THREE.Group,
  onComplete?: () => void
): AssemblyController {
  const tracks: TrajectoryTrack[] = [];
  let eyeMaterial: THREE.MeshStandardMaterial | null = null;
  const TOTAL_DURATION = 5.3;

  // Audio track setup
  let audioElement: HTMLAudioElement | null = null;
  try {
    audioElement = new Audio('helmet_assembly.mp3');
    audioElement.volume = 0.85;
  } catch (e) {
    console.warn('Audio deferred:', e);
  }

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const name = mesh.name;

    // Permanently hide any stand or rear mounting rod/bracket
    const nameLower = name.toLowerCase();
    if (
      nameLower === 'base' ||
      nameLower.includes('stand') ||
      nameLower === 'supportrod' ||
      nameLower.includes('servobracket') ||
      nameLower.includes('servoarmpivot')
    ) {
      mesh.visible = false;
      return;
    }

    const rawMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const baseMats = rawMats.filter(
      (m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial
    );

    // Identify Eye Lens
    if (nameLower === 'l_eyelens' || nameLower.includes('eyelens') || nameLower.includes('lens')) {
      for (const mat of baseMats) {
        mat.emissive = new THREE.Color(0x00f0ff);
        mat.emissiveIntensity = 0;
        eyeMaterial = mat;
      }
    }

    const def = TRAJECTORIES[name];
    if (!def) return;

    tracks.push({
      mesh,
      startPos: new THREE.Vector3(...(def.offset || [0, 0, 0])),
      startRot: def.rotation ? new THREE.Euler(...def.rotation) : new THREE.Euler(0, 0, 0),
      startScale: def.scale ? new THREE.Vector3(...def.scale) : new THREE.Vector3(1, 1, 1),
      startTime: def.startTime,
      duration: def.duration,
      easing: def.easing,
      baseMats,
    });
  });

  const controller: AssemblyController = {
    active: false,
    startTime: 0,
    tracks,
    eyeMaterial,
    audioElement,

    start: () => {
      controller.active = true;
      controller.startTime = performance.now();

      if (controller.audioElement) {
        controller.audioElement.currentTime = 0;
        controller.audioElement.play().catch(() => {});
      }

      for (const track of tracks) {
        if (track.startTime === 0.0) {
          track.mesh.visible = true;
          track.mesh.position.set(0, 0, 0);
          track.mesh.rotation.set(0, 0, 0);
          track.mesh.scale.set(1, 1, 1);
        } else {
          track.mesh.visible = false;
          track.mesh.position.copy(track.startPos);
          track.mesh.rotation.copy(track.startRot);
          track.mesh.scale.copy(track.startScale);
        }

        for (const mat of track.baseMats) {
          if (mat !== controller.eyeMaterial) {
            mat.emissiveIntensity = 0;
          }
        }
      }

      if (controller.eyeMaterial) {
        controller.eyeMaterial.emissiveIntensity = 0;
      }
    },

    resetToAssembled: () => {
      controller.active = false;
      for (const track of tracks) {
        track.mesh.visible = true;
        track.mesh.position.set(0, 0, 0);
        track.mesh.rotation.set(0, 0, 0);
        track.mesh.scale.set(1, 1, 1);
        for (const mat of track.baseMats) {
          if (mat !== controller.eyeMaterial) {
            mat.emissiveIntensity = 0;
          }
        }
      }
      if (controller.eyeMaterial) {
        controller.eyeMaterial.emissiveIntensity = 3.5;
      }
    },

    update: (now: number, camera: THREE.PerspectiveCamera, baseYCam: number) => {
      if (!controller.active) {
        return {
          isComplete: true,
          progress: 1.0,
          statusText: 'MARK LXXXV // ASSEMBLED',
        };
      }

      const elapsed = (now - controller.startTime) / 1000;
      let allSettled = true;

      // ── Animate Components along Physical Assembly Trajectories ──
      for (const track of tracks) {
        if (track.startTime === 0.0) continue;

        const localT = (elapsed - track.startTime) / track.duration;

        if (localT <= 0) {
          track.mesh.visible = false;
          allSettled = false;
        } else if (localT < 1) {
          track.mesh.visible = true;
          allSettled = false;

          const progress = Math.min(1, Math.max(0, localT));
          const ease = track.easing === 'back' ? easeOutBack(progress) : easeOutCubic(progress);

          track.mesh.position.lerpVectors(track.startPos, THREE.Vector3.prototype.set.call(new THREE.Vector3(), 0, 0, 0), ease);

          // Physical barrier clamp: prevents any approaching part from passing through resting zero into internal mechanics
          if (track.startPos.z > 0 && track.mesh.position.z < 0) {
            track.mesh.position.z = 0;
          }
          if (track.startPos.z < 0 && track.mesh.position.z > 0) {
            track.mesh.position.z = 0;
          }
          if (track.startPos.y > 0 && track.mesh.position.y < 0) {
            track.mesh.position.y = 0;
          }
          if (track.startPos.y < 0 && track.mesh.position.y > 0) {
            track.mesh.position.y = 0;
          }

          track.mesh.rotation.x = track.startRot.x * (1 - ease);
          track.mesh.rotation.y = track.startRot.y * (1 - ease);
          track.mesh.rotation.z = track.startRot.z * (1 - ease);
          track.mesh.scale.lerpVectors(track.startScale, THREE.Vector3.prototype.set.call(new THREE.Vector3(), 1, 1, 1), ease);
        } else {
          track.mesh.visible = true;
          track.mesh.position.set(0, 0, 0);
          track.mesh.rotation.set(0, 0, 0);
          track.mesh.scale.set(1, 1, 1);
        }
      }

      // ── Camera Micro-Recoil on Faceplate Latch (t = 4.48s -> 4.75s) ──
      if (elapsed >= 4.48 && elapsed < 4.75) {
        const shakeT = (elapsed - 4.48) / 0.27;
        const recoil = Math.sin(shakeT * Math.PI * 6) * (1 - shakeT) * 0.008;
        camera.position.y = baseYCam + recoil;
      } else if (elapsed >= 4.75) {
        camera.position.y = baseYCam;
      }

      // ── Arc Reactor Eye Ignition (t = 4.60s) ──
      if (controller.eyeMaterial) {
        const eyeT = elapsed - 4.60;
        if (eyeT <= 0) {
          controller.eyeMaterial.emissiveIntensity = 0;
        } else if (eyeT < 0.15) {
          controller.eyeMaterial.emissiveIntensity = (eyeT / 0.15) * 12.0;
        } else if (eyeT < 0.65) {
          const settle = (eyeT - 0.15) / 0.50;
          controller.eyeMaterial.emissiveIntensity = 12.0 - settle * (12.0 - 3.5);
        } else {
          controller.eyeMaterial.emissiveIntensity = 3.5;
        }
      }

      const progress = Math.min(1, elapsed / TOTAL_DURATION);

      if (allSettled && elapsed >= TOTAL_DURATION) {
        controller.active = false;
        if (onComplete) onComplete();
        return {
          isComplete: true,
          progress: 1.0,
          statusText: 'MARK LXXXV // ASSEMBLED',
        };
      }

      return {
        isComplete: false,
        progress,
        statusText: 'MARK LXXXV // ASSEMBLING...',
      };
    },

    dispose: () => {
      if (controller.audioElement) {
        controller.audioElement.pause();
        controller.audioElement = null;
      }
    }
  };

  return controller;
}
