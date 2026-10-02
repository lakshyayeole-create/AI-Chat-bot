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

// ─── Dynamic 3D Nanotech Assembly Component Timeline ──────────────────────────
// Total duration baseline: 5.3s (normalized to 0.0 -> 1.0 for scroll scrub)
export const TOTAL_ASSEMBLY_DURATION = 5.3;

export const TRAJECTORIES: Record<string, TrajectoryDef> = {
  // ── Stationary Core Frame ──
  WholeTeeth:         { startTime: 0.0, duration: 0.1, offset: [0, 0, 0], easing: 'cubic' },
  UpperTeethOuter:    { startTime: 0.0, duration: 0.1, offset: [0, 0, 0], easing: 'cubic' },
  UpperToothInner:    { startTime: 0.0, duration: 0.1, offset: [0, 0, 0], easing: 'cubic' },
  Mic:                { startTime: 0.1, duration: 0.5, offset: [0, -25, 25], rotation: [0.3, 0, 0], easing: 'cubic' },

  // ── Phase 1: Ear Rotaries & Hydraulic Cogs (Expanded 3D spiral orbit from flanks) ──
  L_CogWheel:         { startTime: 0.35, duration: 1.35, offset: [-45, 18, -25], rotation: [0.2, Math.PI * 2, 0.4], scale: [2.5, 1.25, 1.25], easing: 'back' },
  L_BackPlateRotary:  { startTime: 0.45, duration: 1.35, offset: [-50, 25, -35], rotation: [0.4, Math.PI * 1.5, 0], scale: [2.4, 1.2, 1.2], easing: 'back' },
  L_EarHook:          { startTime: 0.55, duration: 1.25, offset: [-40, 18, -25], rotation: [0, 1.8, 0], scale: [2.3, 1.2, 1.2], easing: 'back' },
  L_EarTabCatch:      { startTime: 0.60, duration: 1.25, offset: [-40, 18, -25], rotation: [0.1, 1.5, 0], scale: [2.3, 1.2, 1.2], easing: 'back' },
  L_DomePin:          { startTime: 0.70, duration: 1.15, offset: [-30, 30, -15], rotation: [0.3, 1.0, 0.2], scale: [2.1, 1.15, 1.15], easing: 'back' },
  JawPin:             { startTime: 0.75, duration: 1.15, offset: [-30, -25, -15], rotation: [-0.3, 1.0, 0], scale: [2.2, 1.15, 1.15], easing: 'back' },
  L_ServoArm:         { startTime: 0.90, duration: 1.10, offset: [-35, 25, 18], rotation: [0.2, 0.8, -0.3], scale: [2.1, 1.15, 1.15], easing: 'back' },
  L_JawPiston:        { startTime: 1.00, duration: 1.10, offset: [-35, -20, 25], rotation: [-0.4, 0.6, 0.2], scale: [2.2, 1.15, 1.15], easing: 'back' },
  L_JawPivot:         { startTime: 1.05, duration: 1.10, offset: [-35, -20, 25], rotation: [-0.4, 0.6, 0.2], scale: [2.2, 1.15, 1.15], easing: 'back' },
  L_HelperArm:        { startTime: 1.15, duration: 1.05, offset: [-30, 20, 30], rotation: [0.3, 0.5, 0], scale: [2.1, 1.15, 1.15], easing: 'back' },
  L_LowerFacePlatePin:{ startTime: 1.25, duration: 1.00, offset: [-25, 10, 35], rotation: [0.2, 0.4, 0], scale: [2.0, 1.1, 1.1], easing: 'back' },
  L_UpperFacePlatePin:{ startTime: 1.30, duration: 1.00, offset: [-25, 25, 35], rotation: [0.2, 0.4, 0], scale: [2.0, 1.1, 1.1], easing: 'back' },

  // ── Phase 2: Cranial Dome & Rear Skull Plates (Arced descent from high-back cosmos) ──
  BackPlate1:         { startTime: 1.50, duration: 1.15, offset: [0, 60, -130], rotation: [-0.4, 0.15, 0], scale: [1.08, 1.08, 1.08], easing: 'cubic' },
  BackPlate2:         { startTime: 1.65, duration: 1.15, offset: [0, 75, -150], rotation: [-0.45, -0.15, 0], scale: [1.08, 1.08, 1.08], easing: 'cubic' },
  Dome:               { startTime: 1.85, duration: 1.15, offset: [0, 110, -50], rotation: [-0.55, 0, 0.08], easing: 'cubic' },

  // ── Phase 3: Jaw, Cheeks, Eyelids & Brows (Heroic upward swing and lateral lock) ──
  Jaw:                { startTime: 2.35, duration: 1.10, offset: [0, -85, 35], rotation: [-0.5, 0, 0], easing: 'cubic' },
  LowerLip:           { startTime: 2.50, duration: 1.05, offset: [0, -95, 40], rotation: [-0.55, 0, 0], easing: 'cubic' },
  L_Cheek:            { startTime: 2.70, duration: 1.00, offset: [-40, -25, 60], rotation: [0.15, -0.5, 0.25], scale: [1.5, 1.1, 1.1], easing: 'cubic' },
  L_Eyebrow:          { startTime: 2.85, duration: 0.95, offset: [-30, 35, 60], rotation: [-0.3, 0.4, -0.15], scale: [1.4, 1.1, 1.1], easing: 'cubic' },
  EyeLidInnerLayer:   { startTime: 3.00, duration: 0.90, offset: [0, 0, 65], rotation: [0.1, 0, 0], easing: 'cubic' },
  EyeLidOuterLayer:   { startTime: 3.10, duration: 0.90, offset: [0, 0, 65], rotation: [0.1, 0, 0], easing: 'cubic' },
  L_EyeLens:          { startTime: 3.20, duration: 0.85, offset: [0, 0, 45], rotation: [0, 0, 0], easing: 'cubic' },

  // ── Phase 4: Golden Faceplate Visor Glides In with Angular Twist & Magnetic Dock ──
  FacePlate_Detailed: {
    startTime: 3.45,
    duration: 1.05,
    offset: [0, 65, 140],
    rotation: [0.45, 0.12, -0.06],
    easing: 'cubic'
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TrajectoryTrack {
  mesh: THREE.Mesh;
  startPos: THREE.Vector3;
  startRot: THREE.Euler;
  startScale: THREE.Vector3;
  startTime: number;
  duration: number;
  easing: 'back' | 'cubic';
  baseMats: THREE.MeshStandardMaterial[];
}

export interface AssemblyStatus {
  isComplete: boolean;
  progress: number;
  statusText: string;
  stageIndex: number;
  activeComponent: string;
}

export interface AssemblyController {
  active: boolean;
  startTime: number;
  currentProgress: number;
  tracks: TrajectoryTrack[];
  eyeMaterial: THREE.MeshStandardMaterial | null;
  start: () => void;
  /** Set progress explicitly (0.0 to 1.0) for scroll-scrubbing */
  setProgress: (
    progress: number,
    camera: THREE.PerspectiveCamera,
    fromGroup: THREE.Group,
    baseCameraDist: number,
    baseYCam: number
  ) => AssemblyStatus;
  /** Time-based fallback loop */
  update: (
    now: number,
    camera: THREE.PerspectiveCamera,
    fromGroup: THREE.Group,
    baseCameraDist: number,
    baseYCam: number
  ) => AssemblyStatus;
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
  const targetZero = new THREE.Vector3(0, 0, 0);
  const targetOne = new THREE.Vector3(1, 1, 1);

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

  const evaluateFormation = (
    pClamped: number,
    camera: THREE.PerspectiveCamera,
    fromGroup: THREE.Group,
    baseCameraDist: number,
    baseYCam: number
  ): AssemblyStatus => {
    // ── 1. Animate Individual Components ──
    for (const track of tracks) {
      if (pClamped <= 0.001) {
        track.mesh.visible = false;
        continue;
      }

      if (track.startTime === 0.0) {
        track.mesh.visible = true;
        track.mesh.position.set(0, 0, 0);
        track.mesh.rotation.set(0, 0, 0);
        track.mesh.scale.set(1, 1, 1);
        continue;
      }

      const normStart = track.startTime / TOTAL_ASSEMBLY_DURATION;
      const normDuration = track.duration / TOTAL_ASSEMBLY_DURATION;
      const localT = (pClamped - normStart) / normDuration;

      if (localT <= 0) {
        track.mesh.visible = false;
        track.mesh.position.copy(track.startPos);
        track.mesh.rotation.copy(track.startRot);
        track.mesh.scale.copy(track.startScale);
      } else if (localT < 1) {
        track.mesh.visible = true;
        const ease = track.easing === 'back' ? easeOutBack(localT) : easeOutCubic(localT);

        track.mesh.position.lerpVectors(track.startPos, targetZero, ease);

        // Clamp against physical penetrations
        if (track.startPos.z > 0 && track.mesh.position.z < 0) track.mesh.position.z = 0;
        if (track.startPos.z < 0 && track.mesh.position.z > 0) track.mesh.position.z = 0;
        if (track.startPos.y > 0 && track.mesh.position.y < 0) track.mesh.position.y = 0;
        if (track.startPos.y < 0 && track.mesh.position.y > 0) track.mesh.position.y = 0;

        track.mesh.rotation.x = track.startRot.x * (1 - ease);
        track.mesh.rotation.y = track.startRot.y * (1 - ease);
        track.mesh.rotation.z = track.startRot.z * (1 - ease);
        track.mesh.scale.lerpVectors(track.startScale, targetOne, ease);
      } else {
        track.mesh.visible = true;
        track.mesh.position.set(0, 0, 0);
        track.mesh.rotation.set(0, 0, 0);
        track.mesh.scale.set(1, 1, 1);
      }
    }

    // ── 2. Dynamic 3D Flight Choreography for the Whole Helmet Group ──
    let gx = 0, gy = 0, gz = 0;
    let grx = 0, gry = 0, grz = 0;

    if (pClamped < 0.25) {
      const t = pClamped / 0.25;
      // Angled side profile in 3D space showcasing skeletal core and side cogs
      gx = THREE.MathUtils.lerp(0.35, -0.22, t);
      gy = THREE.MathUtils.lerp(-0.12, -0.06, t);
      gz = THREE.MathUtils.lerp(-0.15, -0.02, t);
      gry = THREE.MathUtils.lerp(-0.55, 0.42, t);
      grx = THREE.MathUtils.lerp(0.18, 0.08, t);
      grz = THREE.MathUtils.lerp(-0.06, 0.04, t);
    } else if (pClamped < 0.58) {
      const t = (pClamped - 0.25) / 0.33;
      // Dynamic tilt downward to capture cranial dome descent and rear plating
      gx = THREE.MathUtils.lerp(-0.22, 0.20, t);
      gy = THREE.MathUtils.lerp(-0.06, -0.25, t);
      gz = THREE.MathUtils.lerp(-0.02, -0.18, t);
      gry = THREE.MathUtils.lerp(0.42, -0.35, t);
      grx = THREE.MathUtils.lerp(0.08, -0.22, t);
      grz = THREE.MathUtils.lerp(0.04, -0.04, t);
    } else if (pClamped < 0.85) {
      const t = (pClamped - 0.58) / 0.27;
      // Low-angle heroic ascent as jaw swings up and cheeks clamp shut
      gx = THREE.MathUtils.lerp(0.20, -0.05, t);
      gy = THREE.MathUtils.lerp(-0.25, 0.16, t);
      gz = THREE.MathUtils.lerp(-0.18, -0.05, t);
      gry = THREE.MathUtils.lerp(-0.35, 0.08, t);
      grx = THREE.MathUtils.lerp(-0.22, 0.14, t);
      grz = THREE.MathUtils.lerp(-0.04, 0.01, t);
    } else {
      const t = (pClamped - 0.85) / 0.15;
      // Centering, squaring up, and locking into final power stance
      gx = THREE.MathUtils.lerp(-0.05, 0, t);
      gy = THREE.MathUtils.lerp(0.16, 0, t);
      gz = THREE.MathUtils.lerp(-0.05, 0, t);
      gry = THREE.MathUtils.lerp(0.08, 0, t);
      grx = THREE.MathUtils.lerp(0.14, 0, t);
      grz = THREE.MathUtils.lerp(0.01, 0, t);
    }

    // Heavy mechanical latch recoil when faceplate shuts at p in [0.91, 0.96]
    if (pClamped >= 0.91 && pClamped <= 0.96) {
      const shockT = (pClamped - 0.91) / 0.05;
      const recoilZ = -Math.sin(shockT * Math.PI) * 0.08;
      gz += recoilZ;
    }

    fromGroup.position.set(gx, gy, gz);
    fromGroup.rotation.set(grx, gry, grz);

    // ── 3. Dynamic Camera Swoop Choreography ──
    let cx = 0, cy = baseYCam, cz = baseCameraDist;
    const swoopScale = 0.55;

    if (pClamped < 0.3) {
      const t = pClamped / 0.3;
      cx = THREE.MathUtils.lerp(0.40, -0.32, t) * swoopScale;
      cy = baseYCam + THREE.MathUtils.lerp(0.22, -0.08, t) * swoopScale;
      cz = baseCameraDist * THREE.MathUtils.lerp(1.15, 1.04, t);
    } else if (pClamped < 0.7) {
      const t = (pClamped - 0.3) / 0.4;
      cx = THREE.MathUtils.lerp(-0.32, 0.28, t) * swoopScale;
      cy = baseYCam + THREE.MathUtils.lerp(-0.08, 0.26, t) * swoopScale;
      cz = baseCameraDist * THREE.MathUtils.lerp(1.04, 1.08, t);
    } else {
      const t = (pClamped - 0.7) / 0.3;
      cx = THREE.MathUtils.lerp(0.28, 0, t) * swoopScale;
      cy = baseYCam + THREE.MathUtils.lerp(0.26, 0, t) * swoopScale;
      cz = baseCameraDist * THREE.MathUtils.lerp(1.08, 1.0, t);
    }

    // Camera micro-shake on faceplate impact
    if (pClamped >= 0.92 && pClamped <= 0.97) {
      const shakeT = (pClamped - 0.92) / 0.05;
      const shake = Math.sin(shakeT * Math.PI * 6) * (1 - shakeT) * 0.018;
      cy += shake;
    }

    camera.position.set(cx, cy, cz);
    camera.lookAt(gx * 0.35, gy * 0.35, gz * 0.35);

    // ── 4. Arc Reactor Eyes Ignition ──
    if (eyeMaterial) {
      if (pClamped < 0.92) {
        eyeMaterial.emissiveIntensity = 0;
      } else if (pClamped < 0.96) {
        const flashT = (pClamped - 0.92) / 0.04;
        eyeMaterial.emissiveIntensity = flashT * 14.0;
      } else {
        const settleT = (pClamped - 0.96) / 0.04;
        eyeMaterial.emissiveIntensity = 14.0 - settleT * (14.0 - 3.8);
      }
    }

    // ── 5. Status Diagnostics ──
    let stageIndex = 1;
    let statusText = 'MARK LXXXV // STANDBY';
    let activeComponent = 'Core Skeletal Frame';

    if (pClamped > 0.02 && pClamped < 0.25) {
      stageIndex = 1;
      statusText = '01 // ENDOSKELETAL FRAME & COG ROTARIES';
      activeComponent = 'Ear Rotaries & Hydraulic Servos';
    } else if (pClamped >= 0.25 && pClamped < 0.60) {
      stageIndex = 2;
      statusText = '02 // CRANIAL DOME & REAR ARMOR';
      activeComponent = 'Gold-Titanium Dome Plates';
    } else if (pClamped >= 0.60 && pClamped < 0.85) {
      stageIndex = 3;
      statusText = '03 // MANDIBLE & CHEEK STABILIZERS';
      activeComponent = 'Lower Jaw Pin & Eyelid Layering';
    } else if (pClamped >= 0.85 && pClamped < 0.94) {
      stageIndex = 4;
      statusText = '04 // FACEPLATE VISOR APPROACHING';
      activeComponent = 'FacePlate Visor Latch Alignment';
    } else if (pClamped >= 0.94) {
      stageIndex = 5;
      statusText = '05 // FACEPLATE SEALED // ARC REACTOR 100%';
      activeComponent = 'Neural Link Synced // Armor Active';
    }

    return {
      isComplete: pClamped >= 1.0,
      progress: pClamped,
      statusText,
      stageIndex,
      activeComponent
    };
  };

  const controller: AssemblyController = {
    active: false,
    startTime: 0,
    currentProgress: 0,
    tracks,
    eyeMaterial,

    start: () => {
      controller.active = true;
      controller.startTime = performance.now();
    },

    setProgress: (progress, camera, fromGroup, baseCameraDist, baseYCam) => {
      const pClamped = Math.max(0, Math.min(1, progress));
      controller.currentProgress = pClamped;
      const res = evaluateFormation(pClamped, camera, fromGroup, baseCameraDist, baseYCam);
      if (res.isComplete && onComplete) {
        onComplete();
      }
      return res;
    },

    update: (now, camera, fromGroup, baseCameraDist, baseYCam) => {
      if (!controller.active) {
        return evaluateFormation(controller.currentProgress, camera, fromGroup, baseCameraDist, baseYCam);
      }

      const elapsed = (now - controller.startTime) / 1000;
      const p = Math.min(1, elapsed / TOTAL_ASSEMBLY_DURATION);
      controller.currentProgress = p;

      const res = evaluateFormation(p, camera, fromGroup, baseCameraDist, baseYCam);
      if (p >= 1.0) {
        controller.active = false;
        if (onComplete) onComplete();
      }
      return res;
    },

    resetToAssembled: () => {
      controller.active = false;
      controller.currentProgress = 1.0;
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
        controller.eyeMaterial.emissiveIntensity = 3.8;
      }
    },

    dispose: () => {
    }
  };

  return controller;
}
