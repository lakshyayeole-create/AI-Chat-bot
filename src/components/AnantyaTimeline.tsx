import React, { useRef, useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stars, Sparkles, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { STONES_DATA } from '../data/stonesData';
import { ProceduralCrystalStone } from './ProceduralCrystalStone';
import { createProceduralStoneGeometry } from '../utils/crystalGeometry';
import InfinityGauntlet from './InfinityGauntlet';
import LokiHelmet from './LokiHelmet';
// ============================================================================
// 🌌 TIMELINE 3D CONTROLS & TUNING VARIABLES (EDIT FREELY HERE!)
// ============================================================================
// Change radius of circle, size of stones, and increase or decrease lighting/glow below:
export const TIMELINE_CONFIG = {
  // ── 1. Circle Radius & Orbit Controls ──
  circle_radius: 11.2,           // Change the radius of the circle (orbit radius)
  orbit_center_x: 0.0,          // Horizontal position of circle center (negative = left, positive = right)
  orbit_center_y: 0.0,        // Vertical position of circle center (negative = down, positive = up)
  orbit_center_z: -9.2,         // Depth position of circle center (moves orbit forward or backward)
  orbit_tilt_x: Math.PI * 0.515, // Forward-dipping tilt (~91.8°) so front stones sweep below the title without overlapping
  orbit_tilt_y: 0.0,
  orbit_tilt_z: 0.0,

  // ── 2. Stone Size & Proportions ──
  stones_size: 0.70,            // Change the size / scale of all stones

  // ── 3. Lighting & Brightness Controls ──
  lighting_intensity: 1.0,      // General scene lighting multiplier (increase or decrease)
  stone_glow: 1.0,              // Overall stone glow & bloom intensity
  ambient_light: 0.45,          // Ambient background fill light brightness
  directional_light: 1.5,       // Main directional key-light brightness
  point_light_intensity: 14,    // Internal crystal core point-light brightness
  bloom_threshold: 1.00,        // Bloom threshold (>= 1.0 ensures non-emissive gauntlet body never blooms, only glowing stones bloom)

  // ── 4. Camera Framing ──
  camera_fov: 42,
  camera_y: 0.5,
  camera_z: 8.5,

  // Backward compatibility alias for orbit_radius
  get orbit_radius() {
    return this.circle_radius;
  },
};

export const TIMELINE_ORBIT_CONFIG = TIMELINE_CONFIG;

// ============================================================================
// 🥊 INFINITY GAUNTLET & STONES CONVERGENCE TUNING (EDIT FREELY HERE!)
// ============================================================================
// Change gauntlet scale, each finger's fold angle, shine/lighting, and stone docking:
import { GAUNTLET_CONFIG } from '../config/gauntletConfig';
export { GAUNTLET_CONFIG };

const NUM_STONES = STONES_DATA.length; // 8 stones (including brown Terra Stone)
const ANGLE_STEP = (Math.PI * 2) / NUM_STONES;
const START_ROTATION = Math.PI * 0.572; // Left focal position (screen X ≈ 21.2%, exactly matching SS 3)

interface TimelineStage {
  activeIndex: number;
  orbitRotation: number;
  cardOpacity: number;
  cardOffset: number;
  cardScale: number;
  convergenceProgress: number;
  lokiTransitionProgress: number;
}

/**
 * Scroll-driven timeline progression:
 * - 0.0 -> 7.0: 8 event stations (Events 01 to 08), stone on left, card on right. Gauntlet is HIDDEN.
 * - 7.0 -> 7.25: Dedicated resting hold on Event 8 (InnovateX). Gauntlet is HIDDEN.
 * - 7.25 -> 8.25: Post-Event 8: Card dissolves. The Gauntlet rises in the center! Stones attach and fingers fold.
 * - 8.25 -> 9.1: The SAME Gauntlet rotates 360° as the diagonal laser wipes across to reveal Loki's Helmet!
 */
function computeTimelineStage(progress: number): TimelineStage {
  const p = Math.max(0, progress);

  let activeIndex: number;
  let rotationIndex: number;
  let cardOpacity: number;
  let cardOffset: number;
  let cardScale: number;
  let convergenceProgress = 0;
  let lokiTransitionProgress = 0;

  if (p < NUM_STONES - 1) {
    const k = Math.min(NUM_STONES - 2, Math.floor(p));
    const u = p - k; // 0.0 -> 1.0 between stone k and stone k + 1

    if (u < 0.22) {
      activeIndex = k;
      const t = u / 0.22;
      const easedT = t * t;
      cardOpacity = Math.max(0, 1 - easedT);
      cardOffset = -25 * easedT;
      cardScale = 1 - 0.04 * easedT;
      rotationIndex = k + 0.08 * easedT;
    } else if (u < 0.78) {
      cardOpacity = 0;
      cardOffset = 38;
      cardScale = 0.92;
      const t = (u - 0.22) / (0.78 - 0.22);
      const easedT = t * t * (3 - 2 * t);
      rotationIndex = k + 0.08 + 0.84 * easedT;
      activeIndex = t < 0.5 ? k : k + 1;
    } else {
      activeIndex = k + 1;
      const t = (u - 0.78) / (1.0 - 0.78);
      const easedT = 1 - Math.pow(1 - t, 2.5);
      rotationIndex = k + 0.92 + 0.08 * easedT;
      cardOpacity = Math.min(1, easedT);
      cardOffset = (1 - easedT) * 38;
      cardScale = 0.92 + 0.08 * easedT;
    }
  } else if (p <= (NUM_STONES - 1) + 0.25) {
    // ── Dedicated Resting View for Stone 8 (InnovateX) ──
    // Gauntlet is completely HIDDEN; user reads Event 8 card in peace
    activeIndex = NUM_STONES - 1;
    rotationIndex = NUM_STONES - 1;
    cardOpacity = 1;
    cardOffset = 0;
    cardScale = 1;
    convergenceProgress = 0;
    lokiTransitionProgress = 0;
  } else if (p <= (NUM_STONES - 1) + 1.25) {
    // ── Post Event 8: Stones Converge & Attach to Gauntlet with Finger Folding ──
    activeIndex = NUM_STONES - 1;
    rotationIndex = NUM_STONES - 1;
    const convT = (p - ((NUM_STONES - 1) + 0.25)) / 1.0; // 0.0 -> 1.0
    convergenceProgress = convT;
    cardOpacity = Math.max(0, 1 - convT * 4.0); // card quickly dissolves
    cardOffset = -40 * convT;
    cardScale = 1 - 0.05 * convT;
    lokiTransitionProgress = 0;
  } else {
    // ── Post Convergence: Rotate SAME Gauntlet into Loki's Helmet ──
    activeIndex = NUM_STONES - 1;
    rotationIndex = NUM_STONES - 1;
    convergenceProgress = 1.0;
    cardOpacity = 0;
    cardOffset = -40;
    cardScale = 0.95;
    const lokiT = Math.min(1, Math.max(0, (p - ((NUM_STONES - 1) + 1.25)) / 0.85));
    lokiTransitionProgress = lokiT;
  }

  // Orbit rotation driven by rotationIndex
  const orbitRotation = START_ROTATION - rotationIndex * ANGLE_STEP;

  return {
    activeIndex,
    orbitRotation,
    cardOpacity,
    cardOffset,
    cardScale,
    convergenceProgress,
    lokiTransitionProgress,
  };
}

/**
 * Creates an offline, zero-network procedural HDR studio environment map
 * with high-contrast light panels that give crystals and titanium glossy reflections.
 */
function createProceduralStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();

  const geo = new THREE.BoxGeometry();
  const mat = new THREE.MeshBasicMaterial();

  // Lateral lightbox 1 (rim gleam)
  const light1 = new THREE.Mesh(geo, mat);
  light1.position.set(-10, 6, 8);
  light1.scale.set(1, 8, 4);
  scene.add(light1);

  // Lateral lightbox 2
  const light2 = new THREE.Mesh(geo, mat);
  light2.position.set(10, 6, -8);
  light2.scale.set(1, 8, 4);
  scene.add(light2);

  // Top soft ceiling light
  const lightTop = new THREE.Mesh(geo, mat);
  lightTop.position.set(0, 12, 0);
  lightTop.scale.set(8, 0.5, 8);
  scene.add(lightTop);

  // Front fill light
  const lightFront = new THREE.Mesh(geo, mat);
  lightFront.position.set(0, 3, 12);
  lightFront.scale.set(6, 4, 0.5);
  scene.add(lightFront);

  const envMap = pmremGenerator.fromScene(scene, 0.04).texture;

  scene.traverse((obj: any) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  pmremGenerator.dispose();
  return envMap;
}

interface OrbitSceneProps {
  orbitRotation: number;
  activeIndex: number;
  onSelectStone: (index: number) => void;
  convergenceProgress?: number;
  lokiTransitionProgress?: number;
  /** 0.0 = closed fist top-right, 1.0 = wide open palm centered (pre-Event 1 intro) */
  gauntletOpenProgress?: number;
  /** Direct hand clench progress (0.0 = open hand, 1.0 = closed fist from pinky to thumb) */
  gauntletClenchProgress?: number;
  /** Intro stone emergence and flight progress (0.0 = docked in hand, 1.0 = in orbit) */
  introFlightProgress?: number;
}

/**
 * 3D Scene Controller with Responsive Framing & Cinematic Orbit:
 * - Enlarged orbit radius ensuring only 1 stone on the front is visible on screen
 * - Configurable orbit tilt, orbit radius, stones size, stone glow, and orbit center position
 * - Procedural layered concentric crystal stones with 22 orbiting shards
 * - Single 3D orbit ring with layered titanium rail and luminous energy path
 * - Procedural HDR studio reflections
 * - UnrealBloomPass & Vignette post-processing glow
 */
const OrbitScene: React.FC<OrbitSceneProps> = ({
  orbitRotation,
  activeIndex,
  onSelectStone,
  convergenceProgress = 0,
  lokiTransitionProgress = 0,
  gauntletOpenProgress = 0,
  gauntletClenchProgress = 0,
  introFlightProgress,
}) => {
  const { gl, scene, camera } = useThree();

  // Loki Transition & 360° Synchronous Rotation
  const isTransitioning = lokiTransitionProgress > 0.001;
  const sharedRotY = lokiTransitionProgress * Math.PI * 2;

  // Diagonal laser clipping planes (perfectly aligned with to top right laser seam line)
  const clipPlaneGauntlet = useMemo(() => new THREE.Plane(), []);
  const clipPlaneLoki = useMemo(() => new THREE.Plane(), []);

  useFrame(() => {
    if (isTransitioning && lokiTransitionProgress < 0.999) {
      gl.localClippingEnabled = true;

      // ── Fixed Transition Axis: Exactly matches linear-gradient(to top right, ...) in 2D Viewport Space ──
      const persCam = camera as THREE.PerspectiveCamera;
      const aspect = persCam.aspect || (typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9);
      const fovRad = ((persCam.fov || 45) * Math.PI) / 180;
      const zDist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
      const h3d = 2 * Math.tan(fovRad / 2) * zDist;
      const w3d = h3d * aspect;
      const len = Math.hypot(w3d, h3d);
      // CSS linear-gradient(to top right) has color lines perpendicular to (w, h)
      // Normal vector pointing to top-right in screen space is (h3d / len, w3d / len)
      const nx = h3d / len;
      const ny = w3d / len;
      const totalL = (2 * w3d * h3d) / len;

      // Exact distance matching 2D pct = -10 + p * 120 (from -10% to 110% of gradient length)
      const pct = -10 + lokiTransitionProgress * 120;
      const d = ((pct - 50) / 100) * totalL;

      // Define plane in CAMERA (VIEW) SPACE so normal (nx, ny, 0) matches screen linear-gradient(to top right) perfectly
      const planeCamGauntlet = new THREE.Plane(new THREE.Vector3(nx, ny, 0), -d);
      const planeCamLoki = new THREE.Plane(new THREE.Vector3(-nx, -ny, 0), d);

      // Transform to world space so that Three.js (which applies camera.matrixWorldInverse) gets exact camera-space planes!
      camera.updateMatrixWorld();
      clipPlaneGauntlet.copy(planeCamGauntlet).applyMatrix4(camera.matrixWorld);
      clipPlaneLoki.copy(planeCamLoki).applyMatrix4(camera.matrixWorld);
    } else {
      gl.localClippingEnabled = false;
    }
  });

  // Set up procedural HDR studio reflections
  useEffect(() => {
    const envTexture = createProceduralStudioEnv(gl);
    scene.environment = envTexture;

    return () => {
      envTexture.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  // Shared procedural deformed octahedron crystal geometry fallback
  const sharedGeometry = useMemo(() => createProceduralStoneGeometry(), []);

  // Load gauntlet model to extract authentic 3D Infinity Stone geometries directly from gauntlet.glb!
  const { scene: gauntletScene } = useGLTF('/assets/gauntlet.glb');

  const gauntletStoneGeometries = useMemo(() => {
    const mapping: Record<string, string> = {
      mind: 'Infinity_Stones002',       // 1. Mind: Iconic oval brilliant-cut centerpiece (515 verts)
      time: 'Infinity_Stones015',       // 2. Time: Thumb marquise/pear stone (216 verts)
      soul: 'Infinity_Stones003_1',     // 3. Soul: Index finger knuckle stone (182 verts)
      reality: 'Infinity_Stones004_1',  // 4. Reality: Middle finger knuckle stone (163 verts)
      space: 'Infinity_Stones005_1',    // 5. Space: Ring finger knuckle stone (216 verts)
      power: 'Infinity_Stones006_1',    // 6. Power: Pinky finger knuckle stone (53 verts)
      
      // ── 7th Stone (Art / Creation, #ffffff White) ──
      // Duplicated from centerpiece Mind Stone (Infinity_Stones002) for brilliant diamond facets
      art: 'Infinity_Stones002',
      creation: 'Infinity_Stones002',

      // ── 8th Stone (Innovatex / Terra, #8B4513 Bronze Brown) ──
      // Duplicated from Reality Stone (Infinity_Stones004_1) for tall prismatic crystal facets
      innovatex: 'Infinity_Stones004_1',
      terra: 'Infinity_Stones004_1',
    };

    const geoms: Record<string, THREE.BufferGeometry> = {};
    for (const [stoneId, meshName] of Object.entries(mapping)) {
      const obj = gauntletScene.getObjectByName(meshName) as THREE.Mesh | undefined;
      if (obj && obj.geometry) {
        const g = obj.geometry.clone();
        g.center();
        g.computeVertexNormals();
        g.computeBoundingBox();
        const box = g.boundingBox;
        if (box) {
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          // Scale to 1.15 units bounding diameter so it fits the timeline orbit perfectly
          const factor = 1.15 / (maxDim || 1);
          g.scale(factor, factor, factor);
        }
        geoms[stoneId] = g;
      }
    }
    return geoms;
  }, [gauntletScene]);

  useEffect(() => {
    return () => {
      sharedGeometry.dispose();
      Object.values(gauntletStoneGeometries).forEach((g) => g.dispose());
    };
  }, [sharedGeometry, gauntletStoneGeometries]);

  // ── Dynamic Responsive Framing Calculations ──
  useEffect(() => {
    camera.position.set(0, TIMELINE_CONFIG.camera_y, TIMELINE_CONFIG.camera_z);
    camera.updateProjectionMatrix();
  }, [camera]);

  const cfg = TIMELINE_CONFIG;

  // Dynamic Camera Mouse Parallax: subtle perspective shift giving authentic 3D pop
  useFrame((state, delta) => {
    const targetCamX = state.pointer.x * 0.25;
    const targetCamY = cfg.camera_y + state.pointer.y * 0.15;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, delta * 3.5);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, delta * 3.5);
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      {/* ── Cinematic Balanced Lighting (Unified across all 8 stone colors) ── */}
      <ambientLight intensity={cfg.ambient_light * cfg.lighting_intensity} color="#e2e8f0" />
      <directionalLight position={[0, 14, 6]} intensity={cfg.directional_light * cfg.lighting_intensity} color="#ffffff" />
      <directionalLight position={[-8, -4, -6]} intensity={0.75 * cfg.lighting_intensity} color="#bae6fd" />
      <directionalLight position={[8, 3, 6]} intensity={0.6 * cfg.lighting_intensity} color="#cbd5e1" />

      {/* ── Deep Space Background Stars ── */}
      <Stars
        radius={50}
        depth={20}
        count={1000}
        factor={3.0}
        saturation={0.3}
        fade
        speed={0.4}
      />

      {/* ── Atmospheric Ambient Sparkles ── */}
      <Sparkles
        count={85}
        scale={[16, 8, 16]}
        size={2.2}
        speed={0.2}
        color="#38bdf8"
        opacity={0.45}
      />

      {/* ── One Single 3D Layered Orbit Ring (Removed during Gauntlet convergence & transition to Loki) ── */}
      {!isTransitioning && lokiTransitionProgress <= 0.001 && convergenceProgress <= 0.01 && (introFlightProgress === undefined || introFlightProgress >= 0.75) && (
        <group
          position={[cfg.orbit_center_x, cfg.orbit_center_y, cfg.orbit_center_z]}
          rotation={[cfg.orbit_tilt_x, cfg.orbit_tilt_y, cfg.orbit_tilt_z]}
        >
          {/* Layer 1: Heavy Titanium Aerospace Rail with physical depth */}
          <mesh>
            <torusGeometry args={[cfg.circle_radius, 0.045 * cfg.stones_size, 16, 240]} />
            <meshStandardMaterial
              color="#1c2432"
              roughness={0.2}
              metalness={0.95}
              envMapIntensity={2.2}
            />
          </mesh>

          {/* Layer 2: Gold/Bronze Outer Bevel Rim */}
          <mesh>
            <torusGeometry
              args={[
                cfg.circle_radius + 0.038 * cfg.stones_size,
                0.008 * cfg.stones_size,
                12,
                240,
              ]}
            />
            <meshStandardMaterial
              color="#d4af37"
              roughness={0.25}
              metalness={0.92}
              envMapIntensity={1.8}
            />
          </mesh>

          {/* Layer 3: Central Luminous Energy Conduit Track */}
          <mesh>
            <torusGeometry
              args={[cfg.circle_radius, 0.01 * cfg.stones_size, 12, 200]}
            />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.5 * cfg.stone_glow}
              roughness={0.1}
            />
          </mesh>

          {/* Layer 4: Inner Dark Track Guide */}
          <mesh>
            <torusGeometry
              args={[
                cfg.circle_radius - 0.038 * cfg.stones_size,
                0.008 * cfg.stones_size,
                12,
                240,
              ]}
            />
            <meshStandardMaterial
              color="#2a3446"
              roughness={0.3}
              metalness={0.9}
            />
          </mesh>
        </group>
      )}

      {/* ── Intro Thanos Infinity Gauntlet (Open hand clenches pinky to thumb, then hides under camera as stones fly) ── */}
      {introFlightProgress !== undefined && introFlightProgress < 1.0 && convergenceProgress < 0.001 && (
        (() => {
          let introGauntletY = GAUNTLET_CONFIG.position[1];
          if (introFlightProgress > 0.28) {
            const sinkT = (introFlightProgress - 0.28) / (1.0 - 0.28);
            const easedSink = sinkT * sinkT * 1.35;
            introGauntletY = THREE.MathUtils.lerp(GAUNTLET_CONFIG.position[1], -9.5, Math.min(1, easedSink));
          }

          return (
            <group
              position={[GAUNTLET_CONFIG.position[0], introGauntletY, GAUNTLET_CONFIG.position[2]]}
              rotation={GAUNTLET_CONFIG.rotation}
              scale={GAUNTLET_CONFIG.scale}
            >
              <InfinityGauntlet
                clenchProgress={gauntletClenchProgress}
                scale={1.0}
              />
            </group>
          );
        })()
      )}

      {/* ── Backward compatibility fallback for standalone gauntletOpenProgress ── */}
      {gauntletOpenProgress > 0.001 && convergenceProgress < 0.01 && introFlightProgress === undefined && (
        (() => {
          const ease = gauntletOpenProgress < 0.5
            ? 2 * gauntletOpenProgress * gauntletOpenProgress
            : 1 - Math.pow(-2 * gauntletOpenProgress + 2, 2) / 2;

          const posX = THREE.MathUtils.lerp(3.2, GAUNTLET_CONFIG.position[0], ease);
          const posY = THREE.MathUtils.lerp(2.4, GAUNTLET_CONFIG.position[1], ease);
          const posZ = GAUNTLET_CONFIG.position[2];
          const openScale = THREE.MathUtils.lerp(1.2, 1.0, ease) * GAUNTLET_CONFIG.scale;
          const rotZ = THREE.MathUtils.lerp(-0.35, 0, ease);

          return (
            <group position={[posX, posY, posZ]} rotation={[GAUNTLET_CONFIG.rotation[0], GAUNTLET_CONFIG.rotation[1], rotZ]} scale={openScale}>
              <InfinityGauntlet
                convergenceProgress={0}
                openProgress={gauntletOpenProgress}
                scale={1.0}
              />
            </group>
          );
        })()
      )}

      {/* ── 3D Open-Palm Infinity Gauntlet (Emerges AFTER Event 8, stones attach, fingers fold) ── */}
      {convergenceProgress > 0.0001 && lokiTransitionProgress < 0.999 && (
        <group rotation={[0, sharedRotY, 0]}>
          <group position={GAUNTLET_CONFIG.position} rotation={GAUNTLET_CONFIG.rotation} scale={GAUNTLET_CONFIG.scale}>
            <InfinityGauntlet
              convergenceProgress={convergenceProgress}
              scale={1.0}
              clippingPlanes={isTransitioning ? [clipPlaneGauntlet] : undefined}
            />
          </group>
        </group>
      )}

      {/* ── 8 Procedural Concentric Layered Crystals along the Orbit ── */}
      {lokiTransitionProgress < 0.999 && (
        <group rotation={[0, sharedRotY, 0]}>
          {STONES_DATA.map((stone, i) => {
            let stoneGauntletY = GAUNTLET_CONFIG.position[1];
            if (introFlightProgress !== undefined && introFlightProgress > 0.28) {
              const sinkT = (introFlightProgress - 0.28) / (1.0 - 0.28);
              const easedSink = sinkT * sinkT * 1.35;
              stoneGauntletY = THREE.MathUtils.lerp(GAUNTLET_CONFIG.position[1], -9.5, Math.min(1, easedSink));
            }

            return (
              <ProceduralCrystalStone
                key={stone.id}
                stone={stone}
                index={i}
                numStones={NUM_STONES}
                sharedGeometry={sharedGeometry}
                stoneGeometry={gauntletStoneGeometries[stone.id]}
                orbitRotation={orbitRotation}
                orbitRadius={cfg.circle_radius}
                stonesSize={cfg.stones_size}
                stoneGlow={cfg.stone_glow}
                pointLightIntensity={cfg.point_light_intensity}
                orbitCenterX={cfg.orbit_center_x}
                orbitCenterY={cfg.orbit_center_y}
                orbitCenterZ={cfg.orbit_center_z}
                orbitTiltX={cfg.orbit_tilt_x}
                orbitTiltY={cfg.orbit_tilt_y}
                orbitTiltZ={cfg.orbit_tilt_z}
                isActive={i === activeIndex && (introFlightProgress === undefined || introFlightProgress >= 0.95)}
                onSelect={onSelectStone}
                convergenceProgress={convergenceProgress}
                introFlightProgress={introFlightProgress}
                introGauntletY={stoneGauntletY}
                gauntletPosition={GAUNTLET_CONFIG.position}
                gauntletScale={GAUNTLET_CONFIG.scale}
                clippingPlanes={isTransitioning ? [clipPlaneGauntlet] : undefined}
                lokiTransitionProgress={lokiTransitionProgress}
              />
            );
          })}
        </group>
      )}

      {/* ── Loki's Regal Horned Helmet (Revealed along the laser seam) ── */}
      {isTransitioning && (
        <group rotation={[0, sharedRotY, 0]} position={[0, 0.05, 0.0]} scale={1.0}>
          <LokiHelmet clippingPlanes={lokiTransitionProgress < 0.999 ? [clipPlaneLoki] : undefined} />
        </group>
      )}

      {/* ── UnrealBloom & Vignette Post-Processing Glow (Tight radius ensures stones glow vibrantly without spilling on gauntlet) ── */}
      <EffectComposer>
        <Bloom
          intensity={0.78}
          luminanceThreshold={cfg.bloom_threshold ?? 1.00}
          luminanceSmoothing={0.12}
          radius={0.30}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.2} darkness={1.12} />
      </EffectComposer>
    </>
  );
};

export interface AnantyaTimelineProps {
  timelineProgress?: number;
  onSelectStone?: (index: number) => void;
  /** 0.0 = gauntlet hidden, transitioning from 0→1 triggers the pre-Event 1 fist-opening intro */
  gauntletOpenProgress?: number;
  /** Direct hand clench progress (0.0 = open hand, 1.0 = closed fist from pinky to thumb) */
  gauntletClenchProgress?: number;
  /** Intro stone emergence and flight progress (0.0 = docked in hand, 1.0 = in orbit) */
  introFlightProgress?: number;
}

export const AnantyaTimeline: React.FC<AnantyaTimelineProps> = ({
  timelineProgress,
  onSelectStone: onSelectStoneProp,
  gauntletOpenProgress = 0,
  gauntletClenchProgress = 0,
  introFlightProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Continuous scroll progress: 0.0 (Stone 1) -> 7.0 (Stone 8) -> 8.0 (Gauntlet Placement)
  const targetProgressRef = useRef<number>(0);
  const [currentRotation, setCurrentRotation] = useState<number>(START_ROTATION);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [convergenceProgress, setConvergenceProgress] = useState<number>(0);
  const [lokiTransitionProgress, setLokiTransitionProgress] = useState<number>(0);
  const [cardState, setCardState] = useState<{ opacity: number; offset: number; scale: number }>({
    opacity: 1,
    offset: 0,
    scale: 1,
  });
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync external ScrollTrigger timeline progress
  useEffect(() => {
    if (timelineProgress !== undefined) {
      targetProgressRef.current = Math.max(0, Math.min(9.1, timelineProgress));
    }
  }, [timelineProgress]);

  // Bounded Scroll Wheel, Touch, and Keyboard listeners (fallback for standalone mode)
  useEffect(() => {
    if (timelineProgress !== undefined) {
      // Driven externally by ScrollTrigger and Lenis smooth scroll: do not hijack window scroll!
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Bounded scroll wheel: phased lifecycle across 8 stone stations
    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) * 0.0016;
      if (e.deltaY > 0) {
        // Scrolling down: advance through timeline stations towards stone 8 (index 7)
        if (targetProgressRef.current < NUM_STONES - 1 - 0.005) {
          e.preventDefault();
          e.stopPropagation();
          targetProgressRef.current = Math.min(NUM_STONES - 1, targetProgressRef.current + delta);
        } else {
          // Reached stone 8! Allow native window scroll to lower sections
          targetProgressRef.current = NUM_STONES - 1;
        }
      } else if (e.deltaY < 0) {
        // Scrolling up: move backwards towards stone 1 (index 0)
        if (targetProgressRef.current > 0.005) {
          e.preventDefault();
          e.stopPropagation();
          targetProgressRef.current = Math.max(0, targetProgressRef.current - delta);
        } else {
          targetProgressRef.current = 0;
        }
      }
    };

    // Touch swipe support for mobile/tablets
    let touchStartY = 0;
    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };
    const handleTouchMove = (e: TouchEvent) => {
      const deltaY = touchStartY - e.touches[0].clientY;
      const deltaX = touchStartX - e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      const swipeDelta = (Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : -deltaX) * 0.0035;

      if (swipeDelta > 0) {
        if (targetProgressRef.current < NUM_STONES - 1 - 0.005) {
          e.preventDefault();
          e.stopPropagation();
          targetProgressRef.current = Math.min(NUM_STONES - 1, targetProgressRef.current + swipeDelta);
        } else {
          targetProgressRef.current = NUM_STONES - 1;
        }
      } else if (swipeDelta < 0) {
        if (targetProgressRef.current > 0.005) {
          e.preventDefault();
          e.stopPropagation();
          targetProgressRef.current = Math.max(0, targetProgressRef.current - Math.abs(swipeDelta));
        } else {
          targetProgressRef.current = 0;
        }
      }
    };

    // Keyboard arrow keys navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        if (targetProgressRef.current < NUM_STONES - 1 - 0.005) {
          e.preventDefault();
          targetProgressRef.current = Math.min(NUM_STONES - 1, Math.floor(targetProgressRef.current + 1.001));
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        if (targetProgressRef.current > 0.005) {
          e.preventDefault();
          targetProgressRef.current = Math.max(0, Math.ceil(targetProgressRef.current - 1.001));
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Frame Lerp Loop: smooth progress damping & phased timeline calculations
  useEffect(() => {
    let animId: number;
    let progress = targetProgressRef.current;

    const loop = () => {
      animId = requestAnimationFrame(loop);
      // Smooth exponential lerp damping for buttery 60fps momentum
      progress += (targetProgressRef.current - progress) * 0.09;
      progress = Math.max(0, Math.min(9.1, progress));

      const stage = computeTimelineStage(progress);
      setCurrentRotation(stage.orbitRotation);
      setActiveIndex(stage.activeIndex);
      setConvergenceProgress(stage.convergenceProgress);
      setLokiTransitionProgress(stage.lokiTransitionProgress);
      setCardState({
        opacity: stage.cardOpacity,
        offset: stage.cardOffset,
        scale: stage.cardScale,
      });
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Smoothly rotate directly to selected stone station
  const handleSelectStone = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(NUM_STONES - 1, index));
    if (onSelectStoneProp) {
      onSelectStoneProp(clampedIndex);
    } else {
      targetProgressRef.current = clampedIndex;
    }
  };

  const activeStone = STONES_DATA[activeIndex] || STONES_DATA[0];
  const isIntroFlight = introFlightProgress !== undefined && introFlightProgress < 1.0;
  const introUiFade = isIntroFlight ? Math.max(0, (introFlightProgress - 0.88) / 0.12) : 1.0;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#040711',
      }}
    >
      {/* ── 1. Fullscreen R3F Canvas with Responsive Camera & Viewport Clamping ── */}
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [0, TIMELINE_CONFIG.camera_y, TIMELINE_CONFIG.camera_z],
          fov: TIMELINE_CONFIG.camera_fov,
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      >
        <color attach="background" args={['#040711']} />
        <Suspense fallback={null}>
          <OrbitScene
            orbitRotation={currentRotation}
            activeIndex={activeIndex}
            onSelectStone={handleSelectStone}
            convergenceProgress={convergenceProgress}
            lokiTransitionProgress={lokiTransitionProgress}
            gauntletOpenProgress={gauntletOpenProgress}
            gauntletClenchProgress={gauntletClenchProgress}
            introFlightProgress={introFlightProgress}
          />
        </Suspense>
      </Canvas>

      {/* ── Diagonal Laser Seam Line (Sweeps across during Gauntlet -> Loki wipe) ── */}
      {lokiTransitionProgress > 0.001 && lokiTransitionProgress < 0.999 && (() => {
        const pct = -10 + lokiTransitionProgress * 120;
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 35,
              pointerEvents: 'none',
              background: `linear-gradient(to top right, transparent calc(${pct}% - 4px), rgba(16, 185, 129, 0.95) calc(${pct}% - 1.2px), #ffffff ${pct}%, rgba(245, 158, 11, 0.95) calc(${pct}% + 1.2px), transparent calc(${pct}% + 4px))`,
              filter: 'drop-shadow(0 0 14px rgba(16, 185, 129, 0.9)) drop-shadow(0 0 28px rgba(245, 158, 11, 0.8))',
            }}
          />
        );
      })()}

      {/* ── 2. Desktop: Vertical 01–08 Progress Indicator (Right Side) ── */}
      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            right: 'clamp(0.8rem, 2.2vw, 2.2rem)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(7px, 1.4vh, 12px)',
            alignItems: 'flex-end',
            userSelect: 'none',
            opacity: Math.max(0, 1 - convergenceProgress * 3.5) * introUiFade,
            pointerEvents: (convergenceProgress > 0.2 || introUiFade < 0.5) ? 'none' : 'auto',
            transition: 'opacity 0.25s ease',
          }}
        >
          {STONES_DATA.map((stone, i) => {
            const isCurrent = i === activeIndex;
            return (
              <button
                key={stone.id}
                onClick={() => handleSelectStone(i)}
                title={`${stone.stoneNumber} • ${stone.name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isCurrent ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                  outline: 'none',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Active Indicator Bar */}
                <div
                  style={{
                    width: isCurrent ? 'clamp(14px, 2vw, 22px)' : '6px',
                    height: '2px',
                    backgroundColor: isCurrent ? stone.color : 'rgba(255, 255, 255, 0.25)',
                    boxShadow: isCurrent ? `0 0 10px ${stone.color}` : 'none',
                    transition: 'all 0.25s ease',
                  }}
                />
                {/* Number */}
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: isCurrent ? 'clamp(0.84rem, 1.1vw, 0.95rem)' : 'clamp(0.72rem, 0.9vw, 0.78rem)',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? stone.color : 'rgba(255, 255, 255, 0.4)',
                    textShadow: isCurrent ? `0 0 12px ${stone.color}` : 'none',
                    letterSpacing: '1px',
                  }}
                >
                  {stone.stoneNumber}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3. Mobile: Horizontal Floating Stone Pagination Pill ── */}
      {isMobile && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(clamp(1.2rem, 3vh, 2.2rem) + 48vh + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(8, 14, 26, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '9999px',
            padding: '5px 12px',
            opacity: Math.max(0, 1 - convergenceProgress * 3.5) * introUiFade,
            pointerEvents: (convergenceProgress > 0.2 || introUiFade < 0.5) ? 'none' : 'auto',
            transition: 'opacity 0.25s ease',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.65)',
          }}
        >
          {STONES_DATA.map((stone, i) => {
            const isCurrent = i === activeIndex;
            return (
              <button
                key={stone.id}
                onClick={() => handleSelectStone(i)}
                aria-label={`Select ${stone.name}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px 3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    width: isCurrent ? '18px' : '6px',
                    height: '6px',
                    borderRadius: '9999px',
                    backgroundColor: isCurrent ? stone.color : 'rgba(255, 255, 255, 0.3)',
                    boxShadow: isCurrent ? `0 0 10px ${stone.color}` : 'none',
                    transition: 'all 0.25s ease',
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* ── 4. Bottom Left: “SCROLL TO ROTATE” (Desktop Only) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(1.5rem, 3.2vh, 3.0rem)',
          left: 'clamp(1.2rem, 2.8vw, 2.8rem)',
          zIndex: 10,
          display: isMobile ? 'none' : 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: Math.max(0, 1 - convergenceProgress * 3.5) * introUiFade,
          transition: 'opacity 0.25s ease',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#38bdf8',
            boxShadow: '0 0 8px #38bdf8',
          }}
        />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 'clamp(0.68rem, 0.9vw, 0.74rem)',
            letterSpacing: '0.24em',
            color: 'rgba(255, 255, 255, 0.55)',
            textTransform: 'uppercase',
          }}
        >
          SCROLL TO EXPLORE TIMELINE
        </span>
      </div>

      {/* ── 5. Scroll-Driven Event Details Box (Appears precisely at focal stone position) ── */}
      <div
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: isMobile ? '50%' : 'clamp(48%, 52vw, 55%)',
          top: isMobile ? 'auto' : '50%',
          bottom: isMobile ? 'clamp(1.2rem, 3vh, 2.2rem)' : 'auto',
          transform: isMobile
            ? `translate(-50%, ${Math.abs(cardState.offset) * 0.6}px) scale(${cardState.scale})`
            : `translate(${cardState.offset}px, -50%) scale(${cardState.scale})`,
          transformOrigin: isMobile ? 'center bottom' : 'left center',
          opacity: cardState.opacity * introUiFade,
          pointerEvents: (cardState.opacity * introUiFade > 0.35) ? 'auto' : 'none',
          width: isMobile ? 'calc(100% - 32px)' : 'clamp(320px, 32vw, 440px)',
          maxWidth: '440px',
          maxHeight: isMobile ? '48vh' : '82vh',
          overflowY: 'auto',
          zIndex: 20,
          background: 'linear-gradient(135deg, rgba(8, 14, 28, 0.90) 0%, rgba(12, 20, 38, 0.78) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${activeStone.color}45`,
          borderRadius: '20px',
          padding: 'clamp(18px, 2.2vh, 26px) clamp(20px, 2vw, 28px)',
          boxShadow: `0 24px 60px rgba(0, 0, 0, 0.85), 0 0 35px ${activeStone.color}22, inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          userSelect: 'none',
          color: '#ffffff',
        }}
      >
        {/* Top Glowing Laser Accent Line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, transparent, ${activeStone.color}, transparent)`,
            boxShadow: `0 0 14px ${activeStone.color}`,
          }}
        />

        {/* Category & Schedule Meta Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                color: activeStone.color,
                background: `${activeStone.color}18`,
                border: `1px solid ${activeStone.color}45`,
                letterSpacing: '1.4px',
                textTransform: 'uppercase',
              }}
            >
              STONE {activeStone.stoneNumber}
            </span>
            <span
              style={{
                fontSize: '0.70rem',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                letterSpacing: '1.5px',
                color: '#94a3b8',
                textTransform: 'uppercase',
              }}
            >
              {activeStone.category}
            </span>
          </div>

          <div
            style={{
              fontSize: '0.70rem',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              letterSpacing: '1.0px',
              color: '#f1f5f9',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
            }}
          >
            {activeStone.day} • {activeStone.time}
          </div>
        </div>

        {/* Event Title */}
        <h2
          style={{
            fontSize: 'clamp(1.35rem, 2.0vw, 1.85rem)',
            fontWeight: 900,
            color: '#ffffff',
            margin: '0 0 8px 0',
            lineHeight: 1.15,
            letterSpacing: '1.6px',
            fontFamily: "'Inter', sans-serif",
            textTransform: 'uppercase',
            textShadow: '0 2px 20px rgba(0, 0, 0, 0.9)',
          }}
        >
          {activeStone.title}
        </h2>

        {/* Venue with Map-Pin Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            color: '#94a3b8',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1.4px',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={activeStone.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span>{activeStone.venue}</span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: 'clamp(0.82rem, 0.98vw, 0.90rem)',
            lineHeight: 1.6,
            color: '#e2e8f0',
            margin: '0 0 14px 0',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            letterSpacing: '0.3px',
          }}
        >
          {activeStone.description}
        </p>

        {/* Highlight Tags */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '16px',
          }}
        >
          {activeStone.highlights.map((h, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '0.70rem',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                color: '#f8fafc',
                background: 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${activeStone.color}45`,
                padding: '4px 9px',
                borderRadius: '8px',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
              }}
            >
              ✦ {h}
            </span>
          ))}
        </div>

        {/* Action Button */}
        <a
          href={activeStone.link || '#'}
          target={activeStone.link ? '_blank' : undefined}
          rel="noopener noreferrer"
          title={`Explore ${activeStone.name}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${activeStone.color}28 0%, rgba(255, 255, 255, 0.06) 100%)`,
            border: `1px solid ${activeStone.color}66`,
            color: '#ffffff',
            fontSize: '0.82rem',
            fontWeight: 800,
            letterSpacing: '1.6px',
            textTransform: 'uppercase',
            fontFamily: "'Inter', sans-serif",
            textDecoration: 'none',
            cursor: 'pointer',
            boxShadow: `0 4px 15px rgba(0, 0, 0, 0.4), 0 0 15px ${activeStone.color}25`,
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = activeStone.color;
            e.currentTarget.style.color = '#000000';
            e.currentTarget.style.boxShadow = `0 6px 20px ${activeStone.color}66`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `linear-gradient(135deg, ${activeStone.color}28 0%, rgba(255, 255, 255, 0.06) 100%)`;
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.4), 0 0 15px ${activeStone.color}25`;
          }}
        >
          <span>Explore Event</span>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </a>
      </div>
    </div>
  );
};

useGLTF.preload('/assets/gauntlet.glb');

export default AnantyaTimeline;
