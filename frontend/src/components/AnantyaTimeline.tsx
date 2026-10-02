import React, { useRef, useState, useMemo, useEffect, Suspense, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stars, Sparkles, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { STONES_DATA } from '../data/stonesData';
import { ProceduralCrystalStone } from './ProceduralCrystalStone';
import { createProceduralStoneGeometry } from '../utils/crystalGeometry';
import InfinityGauntlet from './InfinityGauntlet';
import LokiHelmet from './LokiHelmet';
import LokiLoomOverlay from './LokiLoomOverlay';
import './AllEvents.css';
import { getModelUrl } from '../utils/assets';

const GAUNTLET_MODEL = getModelUrl('/assets/gauntlet.glb', '/assets/gauntlet.glb');
// ============================================================================
// 🌌 TIMELINE 3D CONTROLS & TUNING VARIABLES (EDIT FREELY HERE!)
// ============================================================================
// Change radius of circle, size of stones, and increase or decrease lighting/glow below:
const TIMELINE_CONFIG = {
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

// ============================================================================
// 🥊 INFINITY GAUNTLET & STONES CONVERGENCE TUNING (EDIT FREELY HERE!)
// ============================================================================
// Change gauntlet scale, each finger's fold angle, shine/lighting, and stone docking:
import { GAUNTLET_CONFIG } from '../config/gauntletConfig';

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
  galleryLoomProgress: number;
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
  let galleryLoomProgress = 0;

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
    galleryLoomProgress = 0;
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
    galleryLoomProgress = 0;
  } else if (p <= (NUM_STONES - 1) + 1.25 + 0.85) {
    // ── Post Convergence: Rotate SAME Gauntlet into Loki's Helmet (8.25 -> 9.10) ──
    activeIndex = NUM_STONES - 1;
    rotationIndex = NUM_STONES - 1;
    convergenceProgress = 1.0;
    cardOpacity = 0;
    cardOffset = -40;
    cardScale = 0.95;
    const lokiT = Math.min(1, Math.max(0, (p - ((NUM_STONES - 1) + 1.25)) / 0.85));
    lokiTransitionProgress = lokiT;
    galleryLoomProgress = 0;
  } else {
    // ── Post Loki Reveal: Multiverse Timeline Loom (Threads & Images sprout on scroll) (9.10 -> 10.70) ──
    activeIndex = NUM_STONES - 1;
    rotationIndex = NUM_STONES - 1;
    convergenceProgress = 1.0;
    cardOpacity = 0;
    cardOffset = -40;
    cardScale = 0.95;
    lokiTransitionProgress = 1.0;
    const loomT = Math.min(1, Math.max(0, (p - 9.10) / 1.6));
    galleryLoomProgress = loomT;
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
    galleryLoomProgress,
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
  /** Star-Lord -> Gauntlet 360° laser wipe transition progress (0.0 to 1.0) */
  gauntletWipeProgress?: number;
  isMobile?: boolean;
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
  gauntletWipeProgress = 0,
  isMobile = false,
}) => {
  const { gl, scene, camera } = useThree();

  // Combined 360° Synchronous Rotation for both Star-Lord→Gauntlet wipe and Gauntlet→Loki wipe
  // These phases are strictly sequential and never overlap
  const isTransitioning = lokiTransitionProgress > 0.001;
  const wipeRotY = gauntletWipeProgress * Math.PI * 2;
  const sharedRotY = wipeRotY + lokiTransitionProgress * Math.PI * 2;

  // Diagonal laser clipping planes (perfectly aligned with to top right laser seam line)
  const clipPlaneGauntlet = useMemo(() => new THREE.Plane(), []);
  const clipPlaneLoki = useMemo(() => new THREE.Plane(), []);
  const lokiClippingPlanes = useMemo(() => [clipPlaneLoki], [clipPlaneLoki]);

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
  const { scene: gauntletScene } = useGLTF(GAUNTLET_MODEL);

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

  // Dynamic Camera Mouse Parallax: subtle perspective shift giving authentic 3D pop during timeline;
  // Locks camera to dead-center during the Multiverse Loom Gallery for perfect thread alignment
  useFrame((state, delta) => {
    const isGallery = lokiTransitionProgress >= 0.999;
    const targetCamX = isGallery ? 0 : state.pointer.x * 0.25;
    const targetCamY = isGallery ? cfg.camera_y : cfg.camera_y + state.pointer.y * 0.15;
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


      {/* ── Desktop 3D Layered Orbit Ring (Removed during Gauntlet convergence, transition to Loki, and on mobile) ── */}
      {!isMobile && !isTransitioning && lokiTransitionProgress <= 0.001 && convergenceProgress <= 0.01 && (introFlightProgress === undefined || introFlightProgress >= 0.75) && (
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
          const baseY = isMobile ? 0.35 : GAUNTLET_CONFIG.position[1];
          let introGauntletY = baseY;
          if (introFlightProgress > 0.28) {
            const sinkT = (introFlightProgress - 0.28) / (1.0 - 0.28);
            const easedSink = sinkT * sinkT * 1.35;
            introGauntletY = THREE.MathUtils.lerp(baseY, -9.5, Math.min(1, easedSink));
          }

          const mobileGauntletScale = isMobile ? GAUNTLET_CONFIG.scale * 0.72 : GAUNTLET_CONFIG.scale;
          const gauntletPosX = isMobile ? 0.0 : GAUNTLET_CONFIG.position[0];
          const gauntletPosZ = isMobile ? 0.0 : GAUNTLET_CONFIG.position[2];

          return (
            <group
              position={[gauntletPosX, introGauntletY, gauntletPosZ]}
              rotation={[GAUNTLET_CONFIG.rotation[0], GAUNTLET_CONFIG.rotation[1] + wipeRotY, GAUNTLET_CONFIG.rotation[2]]}
              scale={mobileGauntletScale}
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
          <group
            position={isMobile ? [0.0, 0.35, 0.0] : GAUNTLET_CONFIG.position}
            rotation={GAUNTLET_CONFIG.rotation}
            scale={isMobile ? GAUNTLET_CONFIG.scale * 0.72 : GAUNTLET_CONFIG.scale}
          >
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
            const baseY = isMobile ? 0.35 : GAUNTLET_CONFIG.position[1];
            let stoneGauntletY = baseY;
            if (introFlightProgress !== undefined && introFlightProgress > 0.28) {
              const sinkT = (introFlightProgress - 0.28) / (1.0 - 0.28);
              const easedSink = sinkT * sinkT * 1.35;
              stoneGauntletY = THREE.MathUtils.lerp(baseY, -9.5, Math.min(1, easedSink));
            }

            const mobileGauntletPos: [number, number, number] = isMobile
              ? [0.0, 0.35, 0.0]
              : GAUNTLET_CONFIG.position;
            const mobileGauntletScale = isMobile
              ? GAUNTLET_CONFIG.scale * 0.72
              : GAUNTLET_CONFIG.scale;

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
                isActive={i === activeIndex && (introFlightProgress === undefined || introFlightProgress >= 0.88)}
                onSelect={onSelectStone}
                convergenceProgress={convergenceProgress}
                introFlightProgress={introFlightProgress}
                introGauntletY={stoneGauntletY}
                gauntletPosition={mobileGauntletPos}
                gauntletScale={mobileGauntletScale}
                isMobile={isMobile}
                clippingPlanes={isTransitioning ? [clipPlaneGauntlet] : undefined}
                lokiTransitionProgress={lokiTransitionProgress}
              />
            );
          })}
        </group>
      )}

      {/* ── Loki's Regal Horned Crown: Renders during 360° transition, smoothly glides near the head, and dissolves seamlessly into the artwork ── */}
      {isTransitioning && (() => {
        // 1. Full 360° rotation (completes by 0.72 so it stays poised and upright while moving to head)
        const rotT = Math.min(1, lokiTransitionProgress / 0.72);
        const rotEase = rotT * rotT * (3 - 2 * rotT);
        const lokiRotY = (rotEase - 1) * Math.PI * 2;

        // 2. Smooth glide from center to the exact place of Loki's crown in the background image
        const startY = isMobile ? 0.35 : 0.0;
        const startScale = isMobile ? 0.78 : 1.0;
        const targetY = isMobile ? 0.38 : 0.71;
        const targetScale = isMobile ? 0.28 : 0.34;

        const glideRaw = Math.min(1, Math.max(0, (lokiTransitionProgress - 0.42) / 0.42));
        const glideEase = glideRaw * glideRaw * (3 - 2 * glideRaw);

        const currentY = THREE.MathUtils.lerp(startY, targetY, glideEase);
        const currentScale = THREE.MathUtils.lerp(startScale, targetScale, glideEase);

        // 3. Smooth dissolve into the painted crown on Loki's head (between 0.82 and 0.98)
        const fadeRaw = Math.min(1, Math.max(0, (lokiTransitionProgress - 0.82) / 0.16));
        const fadeEase = fadeRaw * fadeRaw * (3 - 2 * fadeRaw);
        const crownOpacity = Math.max(0, 1.0 - fadeEase);

        if (crownOpacity <= 0.001) return null;

        return (
          <group
            rotation={[0, lokiRotY, 0]}
            position={[0, currentY, 0.0]}
            scale={currentScale}
          >
            <LokiHelmet
              clippingPlanes={lokiTransitionProgress < 0.75 ? lokiClippingPlanes : undefined}
              isFloating={lokiTransitionProgress < 0.42}
              opacity={crownOpacity}
            />
          </group>
        );
      })()}

      {/* ── UnrealBloom & Vignette Post-Processing Glow (Enabled on desktop; bypassed on mobile for 60fps performance) ── */}
      {!isMobile && (
        <EffectComposer multisampling={4}>
          <Bloom
            intensity={0.78}
            luminanceThreshold={cfg.bloom_threshold ?? 1.00}
            luminanceSmoothing={0.12}
            radius={0.30}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.2} darkness={1.12} />
        </EffectComposer>
      )}
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
  /** Whether the timeline canvas should pause rendering when offscreen */
  isPaused?: boolean;
}

export interface AnantyaTimelineHandle {
  setTimelineProgress: (progress: number) => void;
  setGauntletClenchProgress: (progress: number) => void;
  setIntroFlightProgress: (progress: number) => void;
  setGauntletWipeProgress: (progress: number) => void;
}

export const AnantyaTimeline = forwardRef<AnantyaTimelineHandle, AnantyaTimelineProps>(({
  timelineProgress,
  onSelectStone: onSelectStoneProp,
  gauntletOpenProgress = 0,
  gauntletClenchProgress: initialClench = 0,
  introFlightProgress: initialIntroFlight,
  isPaused = false,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Continuous scroll progress: 0.0 (Stone 1) -> 7.0 (Stone 8) -> 8.0 (Gauntlet Placement)
  const targetProgressRef = useRef<number>(0);
  const [gauntletClenchProgress, setGauntletClenchProgress] = useState(initialClench);
  const [introFlightProgress, setIntroFlightProgress] = useState<number | undefined>(initialIntroFlight);
  const [gauntletWipeProgress, setGauntletWipeProgressState] = useState(0);

  useImperativeHandle(ref, () => ({
    setTimelineProgress: (prog: number) => {
      targetProgressRef.current = Math.max(0, Math.min(13.5, prog));
    },
    setGauntletClenchProgress: (prog: number) => {
      setGauntletClenchProgress((prev) => (Math.abs(prev - prog) > 0.015 ? prog : prev));
    },
    setIntroFlightProgress: (prog: number) => {
      setIntroFlightProgress((prev) => (prev === undefined || Math.abs(prev - prog) > 0.015 ? prog : prev));
    },
    setGauntletWipeProgress: (prog: number) => {
      setGauntletWipeProgressState((prev) => (Math.abs(prev - prog) > 0.015 ? prog : prev));
    },
  }), []);
  const [currentRotation, setCurrentRotation] = useState<number>(START_ROTATION);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [displayIndex, setDisplayIndex] = useState<number>(0);
  const isDirectNavRef = useRef<boolean>(false);
  const [convergenceProgress, setConvergenceProgress] = useState<number>(0);
  const [lokiTransitionProgress, setLokiTransitionProgress] = useState<number>(0);
  const [galleryLoomProgress, setGalleryLoomProgress] = useState<number>(0);
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

  // Preload all event logos into browser memory for 0ms instantaneous transitions
  useEffect(() => {
    STONES_DATA.forEach((stone) => {
      if (stone.logoUrl) {
        const img = new Image();
        img.src = stone.logoUrl;
      }
    });
  }, []);

  // Sync external ScrollTrigger timeline progress
  useEffect(() => {
    if (timelineProgress !== undefined) {
      isDirectNavRef.current = false;
      targetProgressRef.current = Math.max(0, Math.min(13.5, timelineProgress));
    }
  }, [timelineProgress]);

  // Frame Lerp Loop: smooth progress damping & phased timeline calculations
  useEffect(() => {
    let animId: number;
    let progress = targetProgressRef.current;
    let lastRenderedProgress = -999;

    const loop = () => {
      animId = requestAnimationFrame(loop);
      if (isPausedRef.current) return;
      const diff = targetProgressRef.current - progress;
      if (Math.abs(diff) > 0.0002) {
        progress += diff * 0.14;
        progress = Math.max(0, Math.min(13.5, progress));
      } else {
        progress = targetProgressRef.current;
        isDirectNavRef.current = false;
      }

      // ONLY trigger React re-renders when progress actually changes!
      if (Math.abs(progress - lastRenderedProgress) > 0.0005) {
        lastRenderedProgress = progress;
        const stage = computeTimelineStage(progress);
        setCurrentRotation(stage.orbitRotation);
        setActiveIndex(stage.activeIndex);
        if (!isDirectNavRef.current) {
          setDisplayIndex(stage.activeIndex);
        }
        setConvergenceProgress(stage.convergenceProgress);
        setLokiTransitionProgress(stage.lokiTransitionProgress);
        setGalleryLoomProgress(stage.galleryLoomProgress);
        setCardState((prev) => {
          if (
            Math.abs(prev.opacity - stage.cardOpacity) < 0.008 &&
            Math.abs(prev.offset - stage.cardOffset) < 0.25 &&
            Math.abs(prev.scale - stage.cardScale) < 0.008
          ) {
            return prev;
          }
          return {
            opacity: stage.cardOpacity,
            offset: stage.cardOffset,
            scale: stage.cardScale,
          };
        });
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Touch swipe support for mobile horizontal navigation
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Only handle horizontal swipes (ignore vertical scrolls)
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        // Swiped Left -> Advance to next stone instantaneously
        handleSelectStone(Math.min(NUM_STONES - 1, displayIndex + 1));
      } else {
        // Swiped Right -> Go to previous stone instantaneously
        handleSelectStone(Math.max(0, displayIndex - 1));
      }
    }
  };

  // Smoothly rotate directly to selected stone station with 0ms instantaneous card & logo response
  const handleSelectStone = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(NUM_STONES - 1, index));
    targetProgressRef.current = clampedIndex;
    isDirectNavRef.current = true;
    setDisplayIndex(clampedIndex);
    setActiveIndex(clampedIndex);
    if (onSelectStoneProp) {
      onSelectStoneProp(clampedIndex);
    }
  };

  const activeStone = STONES_DATA[displayIndex] || STONES_DATA[0];
  const isIntroFlight = introFlightProgress !== undefined && introFlightProgress < 1.0;
  // Fade for card & controls: strictly 0 while gauntlet is wiping/clenching/plunging; smoothly reaches 1.0 once gauntlet finishes sinking
  const gauntletCompleteFade = isIntroFlight ? Math.max(0, (introFlightProgress - 0.80) / 0.20) : 1.0;
  const introUiFade = isIntroFlight ? Math.max(0, (introFlightProgress - 0.88) / 0.12) : 1.0;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#040711',
      }}
    >
      {/* ── Loki God of Stories Atmospheric Background (Fades in smoothly as crown glides near head) ── */}
      {(() => {
        // Smoothly fade in background image as the crown begins gliding to the head
        const bgFadeRaw = Math.min(1, Math.max(0, (lokiTransitionProgress - 0.50) / 0.32));
        const bgOpacity = lokiTransitionProgress >= 0.82 ? 1 : bgFadeRaw * bgFadeRaw * (3 - 2 * bgFadeRaw);

        return (
          <div
            className="loki-gallery-bg-backdrop"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
              pointerEvents: 'none',
              opacity: bgOpacity,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              background: '#040711',
            }}
            aria-hidden="true"
          >
            <div style={{ position: 'relative', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', transform: 'translateY(42px)' }}>
              <img
                src="/assets/loki_god_of_stories.jpg"
                alt=""
                style={{
                  height: '100%',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  maskImage: 'radial-gradient(ellipse 62% 72% at 50% 50%, black 32%, transparent 74%)',
                  WebkitMaskImage: 'radial-gradient(ellipse 62% 72% at 50% 50%, black 32%, transparent 74%)',
                }}
              />
            </div>
            {/* Soft cosmic dark emerald atmospheric vignette seamlessly dissolving any edges */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse 80% 85% at center, transparent 30%, rgba(4, 7, 17, 0.65) 60%, #040711 90%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      })()}

      {/* ── 1. Fullscreen R3F Canvas with Responsive Camera & Viewport Clamping ── */}
      <Canvas
        frameloop="always"
        dpr={isMobile ? 1.0 : [1, 1.5]}
        camera={{
          position: [0, TIMELINE_CONFIG.camera_y, TIMELINE_CONFIG.camera_z],
          fov: TIMELINE_CONFIG.camera_fov,
        }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
        }}
      >
        {lokiTransitionProgress < 0.98 && (
          <color attach="background" args={['#040711']} />
        )}
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
            gauntletWipeProgress={gauntletWipeProgress}
            isMobile={isMobile}
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

      {/* ── Multiverse Timeline Loom (Threads & Images sprout from Loki's Horned Crown on scroll) ── */}
      <LokiLoomOverlay loomProgress={galleryLoomProgress} />

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
            const isCurrent = i === displayIndex;
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

      {/* ── 5. Scroll-Driven Event Details Outer Container (Appears precisely at focal stone position) ── */}
      <div
        className="event-card-outer"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          '--accent-color': activeStone.color,
          position: 'absolute',
          left: isMobile ? '50%' : 'clamp(47%, 50vw, 54%)',
          top: isMobile ? 'auto' : '50%',
          bottom: isMobile ? 'clamp(1.2rem, 2.5vh, 1.8rem)' : 'auto',
          transform: isMobile
            ? `translate(-50%, ${(1 - gauntletCompleteFade) * 35}px)`
            : `translate(${cardState.offset}px, -50%) scale(${cardState.scale})`,
          transformOrigin: isMobile ? 'center bottom' : 'left center',
          opacity: (isMobile ? 1.0 : cardState.opacity) * Math.max(0, 1 - convergenceProgress * 3.5) * (isMobile ? gauntletCompleteFade : introUiFade),
          pointerEvents: (convergenceProgress > 0.2 || (isMobile ? gauntletCompleteFade : introUiFade) < 0.5) ? 'none' : 'auto',
          transition: isMobile ? 'opacity 0.35s ease, transform 0.35s ease' : undefined,
          width: isMobile ? 'min(90vw, 340px)' : 'clamp(410px, 34vw, 470px)',
          maxWidth: isMobile ? '340px' : '470px',
          zIndex: 20,
          userSelect: 'none',
        } as React.CSSProperties}
      >
        {/* Mobile Stone Switcher Navigation Bar (Guaranteed strictly 8px above the card, never overlaps) */}
        {isMobile && (
          <div
            className="mobile-stone-nav-bar"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 2px',
              zIndex: 25,
            }}
          >
            {/* Left Navigation Arrow */}
            <button
              type="button"
              aria-label="Previous Event Stone"
              disabled={displayIndex === 0}
              onClick={() => handleSelectStone(Math.max(0, displayIndex - 1))}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(8, 14, 26, 0.90)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${displayIndex > 0 ? `${activeStone.color}88` : 'rgba(255, 255, 255, 0.15)'}`,
                boxShadow: displayIndex > 0
                  ? `0 4px 14px rgba(0, 0, 0, 0.7), 0 0 12px ${activeStone.color}44`
                  : '0 4px 14px rgba(0, 0, 0, 0.5)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: displayIndex === 0 ? 'default' : 'pointer',
                opacity: displayIndex === 0 ? 0.3 : 1.0,
                pointerEvents: displayIndex === 0 ? 'none' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Glowing Stone Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '4px 12px',
                borderRadius: '9999px',
                background: 'rgba(8, 14, 26, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${activeStone.color}66`,
                boxShadow: `0 0 14px ${activeStone.color}33, 0 4px 16px rgba(0, 0, 0, 0.7)`,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: activeStone.color,
                  boxShadow: `0 0 8px ${activeStone.color}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'clamp(0.66rem, 2.4vw, 0.72rem)',
                  letterSpacing: '0.10em',
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  textShadow: `0 0 8px ${activeStone.color}66`,
                  whiteSpace: 'nowrap',
                }}
              >
                {activeStone.stoneNumber} / 08 • {activeStone.name}
              </span>
            </div>

            {/* Right Navigation Arrow */}
            <button
              type="button"
              aria-label="Next Event Stone"
              disabled={displayIndex === NUM_STONES - 1}
              onClick={() => handleSelectStone(Math.min(NUM_STONES - 1, displayIndex + 1))}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(8, 14, 26, 0.90)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${displayIndex < NUM_STONES - 1 ? `${activeStone.color}88` : 'rgba(255, 255, 255, 0.15)'}`,
                boxShadow: displayIndex < NUM_STONES - 1
                  ? `0 4px 14px rgba(0, 0, 0, 0.7), 0 0 12px ${activeStone.color}44`
                  : '0 4px 14px rgba(0, 0, 0, 0.5)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: displayIndex === NUM_STONES - 1 ? 'default' : 'pointer',
                opacity: displayIndex === NUM_STONES - 1 ? 0.3 : 1.0,
                pointerEvents: displayIndex === NUM_STONES - 1 ? 'none' : 'auto',
                touchAction: 'manipulation',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}

        <div
          className="event-card-wrapper"
          style={{
            width: '100%',
          }}
        >
          <div className="event-card">
            <div className="event-logo-area">
              <div className="logo-glow" />
              <div className="event-logo-container">
                {activeStone.logoUrl ? (
                  <img
                    key={activeStone.id}
                    src={activeStone.logoUrl}
                    alt={`${activeStone.title} logo`}
                    className="event-logo"
                    loading="eager"
                    decoding="sync"
                  />
                ) : (
                  <div className="event-logo-placeholder">
                    <svg viewBox="0 0 100 100" className="placeholder-icon">
                      <polygon points="50,10 90,90 10,90" fill="none" stroke="currentColor" strokeWidth="4" />
                      <circle cx="50" cy="65" r="10" fill="currentColor" />
                    </svg>
                    <span>A N A N T Y A</span>
                  </div>
                )}
              </div>
            </div>

            <div className="event-card-content">
              <div className="event-category-row">
                <span className="event-category">STONE {activeStone.stoneNumber} • {activeStone.category}</span>
                <div className="category-line" />
              </div>

              {activeStone.organizer && (
                <div className="event-organizer-row">
                  <span className="organizer-badge">BY {activeStone.organizer}</span>
                </div>
              )}

              <h3 className="event-name">{activeStone.title}</h3>
              <p className="event-card-desc">{activeStone.description}</p>

              <div className="event-divider" />

              <div className="event-details">
                <div className="detail-item">
                  <div className="detail-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    DATE
                  </div>
                  <span className="detail-value">{activeStone.day}{activeStone.time ? ` • ${activeStone.time}` : ''}</span>
                </div>
                <div className="detail-item">
                  <div className="detail-label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    TEAM SIZE
                  </div>
                  <span className="detail-value">{activeStone.teamSize || 'Individual (1 member)'}</span>
                </div>
                {activeStone.prizePool && (
                  <div className="detail-item full-width">
                    <div className="detail-label">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                      PRIZE POOL
                    </div>
                    <span className="detail-value accent-text">{activeStone.prizePool}</span>
                  </div>
                )}
              </div>

              <div className="event-card-footer">
                {(() => {
                  const targetUrl = activeStone.url || activeStone.link;
                  const isExternal = Boolean(targetUrl && targetUrl.startsWith('http'));
                  return (
                    <a
                      href={targetUrl || '#'}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="explore-btn"
                      onClick={(e) => {
                        if (!isExternal) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <span>EXPLORE EVENT</span> <span className="arrow">→</span>
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

AnantyaTimeline.displayName = 'AnantyaTimeline';

useGLTF.preload(GAUNTLET_MODEL);

export default AnantyaTimeline;
