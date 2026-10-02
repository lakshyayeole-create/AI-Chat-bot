import * as THREE from 'three';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 🥊 INFINITY GAUNTLET & STONES CONVERGENCE MASTER TUNING CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 * Edit freely here! Every parameter that controls the gauntlet, finger movement,
 * shine/lighting, stones flight motion, and socket docking positions can be
 * adjusted manually simply by changing numbers below:
 */
export const GAUNTLET_CONFIG = {
  // ── 1. Gauntlet Size & Placement in 3D Space ──
  scale: 1.75,                   // Overall scale of the gauntlet model
  position: [0.0, -0.32, 0.0] as [number, number, number], // [x, y, z] center position
  rotation: [0.0, 0.0, 0.0] as [number, number, number],   // [x, y, z] Euler rotation

  // ── 2. Gauntlet Material & Shine (Polished Uru Gold with metallic shine, zero glow) ──
  color: '#d4a233',              // Vibrant Asgardian Uru Gold color
  metalness: 0.74,               // Metallic shine and authentic golden reflections
  roughness: 0.36,               // Smooth polished metallic sheen
  emissive_color: '#000000',     // Pure black emissive: gauntlet does NOT glow
  emissive_intensity: 0.0,       // Strictly zero emissive power

  // ── 3. Dedicated Gauntlet Illumination Lights ──
  ambient_light: 0.35,           // Soft balanced omnidirectional fill
  key_light: 0.55,               // Soft directional light from front-top
  fill_light_left: 0.25,         // Soft left rim light
  fill_light_right: 0.20,        // Soft right rim light
  point_light: 0.0,              // Disabled (zero front glare bulb)
  nexus_pulse_intensity: 0.0,    // Disabled (zero center palm glare)
  socket_light_intensity: 2.6,   // Emits colored light onto the gauntlet metal in a small radius around each stone
  socket_light_radius: 0.65,     // Small radius around each socket (drops to 0 beyond this distance)

  // ── 4a. Sequential Finger Folding & Clenching Movement (Post-Event 8) ──
  // Sequence: Pinky (1st) -> Ring (2nd) -> Middle (3rd) -> Index (4th) -> Thumb (5th locks into fist)
  // Negative values curl fingers inward into the palm; 0.0 = fully open hand
  pinky_curl: -0.75,             // Pinky curl angle (Bone017, Bone018, Bone019)
  pinky_start: 0.05,             // Pinky begins folding
  pinky_end: 0.38,               // Pinky fully clenched

  ring_curl: -0.75,              // Ring curl angle (Bone009, Bone010, Bone011)
  ring_start: 0.18,              // Ring begins folding
  ring_end: 0.52,                // Ring fully clenched

  middle_curl: -0.75,            // Middle curl angle (Bone006, Bone007, Bone008)
  middle_start: 0.32,            // Middle begins folding
  middle_end: 0.66,              // Middle fully clenched

  index_curl: -0.75,             // Index curl angle (Bone003, Bone004, Bone005)
  index_start: 0.48,             // Index begins folding
  index_end: 0.82,               // Index fully clenched

  thumb_curl: -0.55,             // Thumb curl angle (Bone020, Bone021, Bone022)
  thumb_start: 0.65,             // Thumb begins folding (locks over clenched fingers)
  thumb_end: 0.98,               // Thumb fully clenched into fist

  // ── 4b. Sequential Finger Opening / Unfurling (Before Event 1: Thumb -> Index -> Middle -> Ring -> Pinky) ──
  // Reverse sequence: Closed fist uncurls into wide open palm as stones manifest into orbit
  thumb_open_start: 0.00,
  thumb_open_end: 0.32,
  index_open_start: 0.18,
  index_open_end: 0.50,
  middle_open_start: 0.34,
  middle_open_end: 0.68,
  ring_open_start: 0.50,
  ring_open_end: 0.84,
  pinky_open_start: 0.66,
  pinky_open_end: 1.00,

  // ── 5. Parallel Stone Arrival Timings (Synchronized with finger folds) ──
  stone_timings: {
    power:     { start: 0.05, end: 0.38 }, // Power Stone (Pinky knuckle) arrives as Pinky folds
    space:     { start: 0.18, end: 0.52 }, // Space Stone (Ring knuckle) arrives as Ring folds
    reality:   { start: 0.32, end: 0.66 }, // Reality Stone (Middle knuckle) arrives as Middle folds
    soul:      { start: 0.48, end: 0.82 }, // Soul Stone (Index knuckle) arrives as Index folds
    time:      { start: 0.65, end: 0.98 }, // Time Stone (Thumb) arrives as Thumb locks fist
    mind:      { start: 0.10, end: 0.55 }, // Mind Stone (Center palm) arrives
    art:       { start: 0.15, end: 0.60 }, // Art / Creation (Wrist nexus) arrives
    creation:  { start: 0.15, end: 0.60 },
    innovatex: { start: 0.20, end: 0.65 }, // Innovatex / Terra (Forearm bracer) arrives
    terra:     { start: 0.20, end: 0.65 },
  } as Record<string, { start: number; end: number }>,

  // ── 6. Stones Movement & Flight Arc ──
  flight_arc_height: 0.8,        // Parabolic vertical lift (Y-axis) during flight to gauntlet
  flight_arc_depth: 2.4,         // Forward pop (Z-axis) toward camera during flight
  flight_lerp_speed: 8.5,        // Movement interpolation speed

  // ── 6. Stone Placement at Gauntlet Sockets (Position, Rotation & Docked Scale) ──
  // Calibrated to 1:1 scale with the gauntlet cavities (scaled by 1.75) so stones fill the spaces
  sockets: {
    // 1. Mind Stone (Event 01 - Codigo, #ffd600 Yellow) -> Large Sunburst Medallion
    mind: {
      id: 'mind',
      name: 'Mind Stone',
      stoneNumber: '01',
      color: '#ffd600',
      position: [0.004, 0.022, 0.020] as [number, number, number],
      rotation: [0.000, 0.000, 0.000] as [number, number, number],
      scale: 0.54, // Perfectly fills the inner circle of the sunburst medallion
    },
    // 2. Time Stone (Event 02 - She Solves, #00e676 Green) -> Thumb Socket Ring
    time: {
      id: 'time',
      name: 'Time Stone',
      stoneNumber: '02',
      color: '#00e676',
      position: [0.633, -0.219, -0.260] as [number, number, number],
      rotation: [0.350, -0.550, -0.450] as [number, number, number],
      scale: 0.45, // Perfectly fills thumb socket bezel
    },
    // 3. Soul Stone (Event 03 - Byte me CTF, #ff6d00 Orange) -> Index Finger Knuckle
    soul: {
      id: 'soul',
      name: 'Soul Stone',
      stoneNumber: '03',
      color: '#ff6d00',
      position: [0.346, 0.448, -0.130] as [number, number, number],
      rotation: [0.080, -0.150, -0.050] as [number, number, number],
      scale: 0.48, // Centered & fills index knuckle oval bezel
    },
    // 4. Reality Stone (Event 04 - MasterChef UI, #ff1744 Red) -> Middle Finger Knuckle
    reality: {
      id: 'reality',
      name: 'Reality Stone',
      stoneNumber: '04',
      color: '#ff1744',
      position: [0.105, 0.448, -0.110] as [number, number, number],
      rotation: [0.080, 0.000, 0.000] as [number, number, number],
      scale: 0.48, // Centered & fills middle knuckle oval bezel
    },
    // 5. Space Stone (Event 05 - Decentral Hack, #00a8ff Blue) -> Ring Finger Knuckle
    space: {
      id: 'space',
      name: 'Space Stone',
      stoneNumber: '05',
      color: '#00a8ff',
      position: [-0.133, 0.444, -0.120] as [number, number, number],
      rotation: [0.080, 0.150, 0.050] as [number, number, number],
      scale: 0.48, // Centered & fills ring knuckle oval bezel
    },
    // 6. Power Stone (Event 06 - IoThrone, #a855f7 Purple) -> Pinky Finger Knuckle
    power: {
      id: 'power',
      name: 'Power Stone',
      stoneNumber: '06',
      color: '#a855f7',
      position: [-0.313, 0.380, -0.140] as [number, number, number],
      rotation: [0.080, 0.280, 0.120] as [number, number, number],
      scale: 0.45, // Centered & fills pinky knuckle oval bezel
    },
    // 7. Art / Creation Stone (Event 07 - Make a Doodle, #ffffff White) -> Wrist Chevron Apex
    art: {
      id: 'art',
      name: 'Creation Stone',
      stoneNumber: '07',
      color: '#ffffff',
      position: [0.000, -0.380, 0.020] as [number, number, number],
      rotation: [0.000, 0.000, 0.000] as [number, number, number],
      scale: 0.44, // Beautifully mounted on wrist chevron
    },
    creation: {
      id: 'creation',
      name: 'Creation Stone',
      stoneNumber: '07',
      color: '#ffffff',
      position: [0.000, -0.380, 0.020] as [number, number, number],
      rotation: [0.000, 0.000, 0.000] as [number, number, number],
      scale: 0.44,
    },
    // 8. Innovatex / Terra Stone (Event 08 - Innovatex, #8B4513 Bronze Brown) -> Forearm Bracer Keystone
    innovatex: {
      id: 'innovatex',
      name: 'Terra Stone',
      stoneNumber: '08',
      color: '#8B4513',
      position: [0.000, -0.800, 0.000] as [number, number, number],
      rotation: [0.000, 0.000, 0.000] as [number, number, number],
      scale: 0.42, // Beautifully mounted on forearm keystone
    },
    terra: {
      id: 'terra',
      name: 'Terra Stone',
      stoneNumber: '08',
      color: '#8B4513',
      position: [0.000, -0.800, 0.000] as [number, number, number],
      rotation: [0.000, 0.000, 0.000] as [number, number, number],
      scale: 0.42,
    },
  },
};

export interface GauntletSocket {
  id: string;
  name: string;
  stoneNumber: string;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export const GAUNTLET_SOCKETS = GAUNTLET_CONFIG.sockets;

/**
 * Computes a smooth 3D curved anti-phasing flight trajectory from circular orbit position to the gauntlet socket.
 * 
 * ANTI-PHASING MECHANISM:
 * Stones start deep in the background at z ≈ -9.2, while the gauntlet is centered at z ≈ 0.0.
 * To ensure stones NEVER phase or cut through the gauntlet body:
 * 1. Control Point 1 (Takeoff & Arc Around): Maintains wide radial clearance outside the gauntlet's
 *    cross-section while rapidly pulling Z forward into the foreground camera space (Z > +2.6).
 * 2. Control Point 2 (Hover & Align): Positioned directly in front of the target socket at Z ≈ +1.5
 *    in plain view of the camera.
 * 3. Final Docking (t: 0.85 -> 1.0): The stone descends gracefully along +Z from the front into its socket recess.
 */
export function calculateStoneSlotPosition(
  orbitPos: THREE.Vector3,
  socketPos: [number, number, number],
  gauntletWorldPos: THREE.Vector3,
  t: number, // 0.0 = on orbit, 1.0 = locked in socket
  gauntletScale: number = GAUNTLET_CONFIG.scale
): THREE.Vector3 {
  const clampedT = Math.max(0, Math.min(1, t));

  // Organic ease-in-out curve
  const easeT = clampedT < 0.5 
    ? 2 * clampedT * clampedT 
    : 1 - Math.pow(-2 * clampedT + 2, 2) / 2;

  // Final socket position in world coordinates (scaled by gauntletScale)
  const targetWorldPos = new THREE.Vector3(
    gauntletWorldPos.x + socketPos[0] * gauntletScale,
    gauntletWorldPos.y + socketPos[1] * gauntletScale,
    gauntletWorldPos.z + socketPos[2] * gauntletScale
  );

  // Direction vector from center to starting stone position in XY plane
  const hyp = Math.hypot(orbitPos.x, orbitPos.y) || 1;
  const dirX = orbitPos.x / hyp;
  const dirY = orbitPos.y / hyp;

  // Clearance waypoint (P1): Stays wide outside the gauntlet silhouette (R >= 4.6),
  // but surges forward in Z to +2.8 (well in front of the gauntlet).
  const wideRadius = Math.max(4.6, hyp * 0.70);
  const p1 = new THREE.Vector3(
    dirX * wideRadius,
    dirY * wideRadius,
    Math.max(targetWorldPos.z + 2.8, 2.5)
  );

  // Pre-docking hover waypoint (P2): Hovering directly in front of the socket in camera space
  const p2 = new THREE.Vector3(
    targetWorldPos.x + dirX * 0.35,
    targetWorldPos.y + 0.30,
    targetWorldPos.z + 1.5
  );

  // Cubic Bezier interpolation: B(u) = (1-u)^3*P0 + 3(1-u)^2*u*P1 + 3(1-u)*u^2*P2 + u^3*P3
  const u = easeT;
  const invU = 1 - u;
  const invU2 = invU * invU;
  const invU3 = invU2 * invU;
  const u2 = u * u;
  const u3 = u2 * u;

  const pos = new THREE.Vector3(
    invU3 * orbitPos.x + 3 * invU2 * u * p1.x + 3 * invU * u2 * p2.x + u3 * targetWorldPos.x,
    invU3 * orbitPos.y + 3 * invU2 * u * p1.y + 3 * invU * u2 * p2.y + u3 * targetWorldPos.y,
    invU3 * orbitPos.z + 3 * invU2 * u * p1.z + 3 * invU * u2 * p2.z + u3 * targetWorldPos.z
  );

  return pos;
}
