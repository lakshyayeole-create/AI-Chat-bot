import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { StoneData } from '../data/stonesData';
import { GAUNTLET_CONFIG, GAUNTLET_SOCKETS, calculateStoneSlotPosition, GauntletSocket } from '../config/gauntletConfig';

/**
 * 22 Orbiting Crystal Shards (Tetrahedrons)
 * Distributed using parametric trigonometric curves with gentle rotation.
 * Sized and distanced proportionally so they form a sleek cosmic debris field.
 */
interface FloatingShardsProps {
  color: string;
  isActive: boolean;
  scaleFactor?: number;
  stoneGlow?: number;
  luminanceFactor?: number;
  isMobile?: boolean;
}

export const FloatingShards: React.FC<FloatingShardsProps> = ({
  color,
  isActive,
  scaleFactor = 1,
  stoneGlow = 1.45,
  luminanceFactor = 1.0,
  isMobile = false,
}) => {
  const shardsGroupRef = useRef<THREE.Group>(null);

  const count = isMobile ? 6 : 22;
  const shards = useMemo(
    () =>
      Array.from({ length: count }, (_, t) => ({
        position: [
          Math.sin(9.4 * t) * (1.15 + (t % 4) * 0.22) * scaleFactor,
          1.42 * Math.cos(5.6 * t) * scaleFactor,
          0.72 * Math.cos(3.2 * t) * scaleFactor,
        ] as [number, number, number],
        scale: (0.02 + (t % 4) * 0.016) * (isActive ? 1.15 : 0.8) * scaleFactor,
        rotation: [0.7 * t, 0.4 * t, 0.2 * t] as [number, number, number],
      })),
    [isActive, scaleFactor, count]
  );

  useFrame((_, delta) => {
    if (shardsGroupRef.current) {
      shardsGroupRef.current.rotation.y += delta * (isActive ? 0.38 : 0.15);
      shardsGroupRef.current.rotation.x = Math.sin(delta * 0.5) * 0.08;
    }
  });

  return (
    <group ref={shardsGroupRef}>
      {shards.map((s, idx) => (
        <mesh key={idx} position={s.position} rotation={s.rotation} scale={s.scale}>
          <tetrahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={(isActive ? 2.0 : 1.2) * (stoneGlow / 1.45) * luminanceFactor}
            roughness={0.3}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
};

export interface ProceduralCrystalStoneProps {
  stone: StoneData;
  index: number;
  numStones: number;
  sharedGeometry: THREE.BufferGeometry;
  orbitRotation: number;
  orbitRadius: number;
  stonesSize: number;
  stoneGlow: number;
  pointLightIntensity?: number;
  orbitCenterX?: number;
  orbitCenterY?: number;
  orbitCenterZ?: number;
  orbitTiltX?: number;
  orbitTiltY?: number;
  orbitTiltZ?: number;
  isActive: boolean;
  onSelect: (index: number) => void;
  textureUrl?: string;
  convergenceProgress?: number;
  introFlightProgress?: number;
  introGauntletY?: number;
  gauntletPosition?: [number, number, number];
  gauntletScale?: number;
  stoneGeometry?: THREE.BufferGeometry;
  clippingPlanes?: THREE.Plane[];
  lokiTransitionProgress?: number;
  isMobile?: boolean;
}

/**
 * Procedural Concentric Layered Crystal Stone:
 * 1. Layer 1: Main Crystal Shell (MeshPhysicalMaterial with transmission, ior, roughness, clearcoat, flatShading)
 * 2. Layer 2: Outer Wireframe Cage (Scale 1.009, subtle facet edges)
 * 3. Layer 3: Pulsing Inner Core (Scale ~0.54, oscillates like a beating heart)
 * 4. Layer 4: Off-center Bright Spark (Scale [0.26, 0.38, 0.28], Pos [0.05, -0.05, 0.32])
 * 5. Internal Lights: Center PointLight + Offset Bright PointLight
 * 6. Layer 5: 22 Orbiting Crystal Shards (Tetrahedrons on active stone)
 * 7. Unified Lighting: Automatic ITU-R BT.709 luminance normalization so no stone is blown out or dim
 * 8. Interactive Drag & Inertia (Physics-based rotation when active)
 * 9. Anchor Link Navigation: Clicking triggers stone.link (blank for now)
 */
export const ProceduralCrystalStone: React.FC<ProceduralCrystalStoneProps> = ({
  stone,
  index,
  numStones,
  sharedGeometry,
  orbitRotation,
  orbitRadius,
  stonesSize,
  stoneGlow,
  pointLightIntensity = 14,
  orbitCenterX = 0,
  orbitCenterY = -0.2,
  orbitCenterZ = -9.5,
  orbitTiltX = Math.PI * 0.48,
  orbitTiltY = 0,
  orbitTiltZ = 0,
  isActive,
  onSelect,
  textureUrl = '/assets/amber-crystal-surface.webp',
  convergenceProgress = 0,
  introFlightProgress,
  introGauntletY,
  gauntletPosition = [0, -0.2, 0],
  gauntletScale = 1.75,
  stoneGeometry,
  clippingPlanes,
  lokiTransitionProgress = 0,
  isMobile = false,
}) => {
  const activeGeometry = stoneGeometry || sharedGeometry;
  const groupRef = useRef<THREE.Group>(null);
  const rotGroupRef = useRef<THREE.Group>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);
  const centerLightRef = useRef<THREE.PointLight>(null);
  const offsetLightRef = useRef<THREE.PointLight>(null);
  const shellMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const sparkMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const isCreation = stone.id === 'creation' || stone.id === 'art';

  // Unified Lighting Normalization:
  // Dynamically compute perceptual luminance (ITU-R BT.709) for each stone.
  // Higher luminance colors (like Mind/Yellow and Creation/White) get scaled down,
  // while deeper saturated tones (Power/Purple, Reality/Red, Terra/Brown) get calibrated
  // so ALL 8 stones have an identical, harmonious perceived brightness.
  const { luminanceFactor, coreEmissive, sparkColor, wireframeColor } = useMemo(() => {
    const c = new THREE.Color(stone.color);
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

    // Smooth inverse curve: clamp between [0.45, 1.35]
    // White (lum=1.0) -> ~0.50
    // Yellow (lum=0.81) -> ~0.60
    // Green (lum=0.68) -> ~0.74
    // Blue (lum=0.54) -> ~0.90
    // Purple (lum=0.45) -> ~1.05
    // Brown (lum=0.31) -> ~1.30
    // Red (lum=0.30) -> ~1.32
    const factor = THREE.MathUtils.clamp(
      Math.pow(0.48 / Math.max(lum, 0.28), 0.88),
      0.45,
      1.35
    );

    // For White (Creation Stone), use a subtle diamond crystalline tint for emissive/spark
    // instead of blazing raw white which blows out into a solid white blur
    const emissiveBase = isCreation ? new THREE.Color('#d0e8ff') : c.clone();

    // Spark color: gentle blend towards light tint, preserving facet contrast
    const spark = c.clone().lerp(new THREE.Color('#ffffff'), isCreation ? 0.2 : 0.35);

    // Wireframe color: subtle tint
    const wire = c.clone().lerp(new THREE.Color('#ffffff'), 0.45);

    return {
      luminanceFactor: factor,
      coreEmissive: `#${emissiveBase.getHexString()}`,
      sparkColor: `#${spark.getHexString()}`,
      wireframeColor: `#${wire.getHexString()}`,
    };
  }, [stone.color, isCreation]);

  // Texture loading (used strictly for bump & roughness to preserve pure gemstone colors)
  const texture = useTexture(textureUrl);
  useMemo(() => {
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1.35, 1.35);
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    }
  }, [texture]);

  // Orbit Positioning math with full 3D Orbital Tilt (perfect alignment with torus rail)
  const angleStep = (Math.PI * 2) / numStones;
  const angle = index * angleStep + orbitRotation;

  // Local circular coordinates on the orbit plane rotated by the exact 3D tilt Euler
  const orbitVector = new THREE.Vector3(
    orbitRadius * Math.cos(angle),
    orbitRadius * Math.sin(angle),
    0
  );
  orbitVector.applyEuler(new THREE.Euler(orbitTiltX, orbitTiltY, orbitTiltZ, 'XYZ'));

  // Exact coordinates relative to orbit center (clean original scale, naturally in front of text at z = -0.7)
  const targetX = orbitCenterX + orbitVector.x;
  const targetY = orbitCenterY + orbitVector.y + (isActive ? 0.08 : 0);
  const targetZ = orbitCenterZ + orbitVector.z + (isActive ? 0.38 : 0);

  // Front-facing factor: +1.0 at front, -1.0 at back
  const frontFactor = orbitVector.z / (orbitRadius || 1);

  // Subtle depth attenuation factor for stones in the background
  const depthFactor = THREE.MathUtils.clamp((frontFactor + 1) / 2, 0.42, 1.0);

  // Original stone size preserved
  const baseScale = isCreation ? stonesSize * 1.08 : stonesSize;
  const targetScale = isActive ? baseScale * 1.2 : baseScale;

  // Interactive Drag & Inertia Physics (Euler lerp)
  const targetRotation = useRef(new THREE.Euler(0.08, -0.35, 0));
  const pointerPos = useRef<[number, number]>([0, 0]);
  const isDragging = useRef<boolean>(false);

  // When stone becomes active, smoothly present a dynamic angle
  const prevActive = useRef(isActive);
  useEffect(() => {
    if (isActive && !prevActive.current) {
      targetRotation.current.y += 0.85;
    }
    prevActive.current = isActive;
  }, [isActive]);

  const handlePointerDown = (e: any) => {
    if (!isActive) {
      e.stopPropagation();
      onSelect(index);
      return;
    }
    e.stopPropagation();
    isDragging.current = true;
    pointerPos.current = [e.clientX, e.clientY];
    e.target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging.current || !isActive) return;
    e.stopPropagation();
    const [lastX, lastY] = pointerPos.current;
    targetRotation.current.y += 0.012 * (e.clientX - lastX);
    targetRotation.current.x = THREE.MathUtils.clamp(
      targetRotation.current.x + 0.009 * (e.clientY - lastY),
      -0.52,
      0.52
    );
    pointerPos.current = [e.clientX, e.clientY];
  };

  const handlePointerUp = (e: any) => {
    e.stopPropagation();
    isDragging.current = false;
    e.target.releasePointerCapture?.(e.pointerId);
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(index);
    // Anchor link navigation: if stone has link defined, navigate to it (blank for now)
    if (stone.link && stone.link.trim() !== '') {
      window.open(stone.link, '_blank', 'noopener,noreferrer');
    }
  };

  useFrame((state, delta) => {
    if (!groupRef.current || !rotGroupRef.current) return;

    // ── 0. INTRO FLIGHT SEQUENCE (Stones emerge from clenched gauntlet, fly high above, arc into orbit) ──
    if (introFlightProgress !== undefined && introFlightProgress < 1.0 && convergenceProgress < 0.001) {
      const pFlight = Math.max(0, Math.min(1, introFlightProgress));
      const socketData = (GAUNTLET_SOCKETS as Record<string, GauntletSocket>)[stone.id] || GAUNTLET_SOCKETS['mind'];

      // World position of gauntlet socket
      const gauntletY = introGauntletY ?? gauntletPosition[1];
      const dockedX = gauntletPosition[0] + socketData.position[0] * gauntletScale;
      const dockedY = gauntletY + socketData.position[1] * gauntletScale;
      const dockedZ = gauntletPosition[2] + socketData.position[2] * gauntletScale;

      // Apex high in the air above the gauntlet
      const spreadNorm = (index - (numStones - 1) / 2) / ((numStones - 1) / 2);
      const apexX = spreadNorm * 2.2;
      const apexY = 2.8 + Math.sin((index / numStones) * Math.PI) * 0.7; // ~2.8 to 3.5 world units high (well above Y = -0.32)
      const apexZ = 0.8 + Math.cos(index * 1.3) * 0.4;

      let curX: number, curY: number, curZ: number, curScale: number;

      if (pFlight <= 0.40) {
        // Phase 1: Burst out and rocket vertically upwards above the gauntlet
        const t1 = pFlight / 0.40;
        const ease1 = 1 - Math.pow(1 - t1, 2.5); // Fast launch upwards
        curX = THREE.MathUtils.lerp(dockedX, apexX, ease1);
        curY = THREE.MathUtils.lerp(dockedY, apexY, ease1);
        curZ = THREE.MathUtils.lerp(dockedZ, apexZ, ease1);
        curScale = THREE.MathUtils.lerp(socketData.scale, targetScale * 0.85, ease1);

        // Dynamic rotation from socket angle to upward hover spin
        rotGroupRef.current.rotation.x = THREE.MathUtils.lerp(socketData.rotation[0], 0.15, ease1);
        rotGroupRef.current.rotation.y = THREE.MathUtils.lerp(socketData.rotation[1], THREE.MathUtils.degToRad(index * 45) + (state.clock.elapsedTime * 0.5), ease1);
        rotGroupRef.current.rotation.z = THREE.MathUtils.lerp(socketData.rotation[2], 0, ease1);
      } else {
        // Phase 2: Parabolic curved arc into orbital station
        const t2 = (pFlight - 0.40) / 0.60;
        const ease2 = t2 * t2 * (3 - 2 * t2); // Smooth easeInOut
        const arcLift = Math.sin(t2 * Math.PI) * 0.6; // Dramatic arcing curve
        curX = THREE.MathUtils.lerp(apexX, targetX, ease2);
        curY = THREE.MathUtils.lerp(apexY, targetY, ease2) + arcLift * 0.3;
        curZ = THREE.MathUtils.lerp(apexZ, targetZ, ease2) - arcLift * 0.5;
        curScale = THREE.MathUtils.lerp(targetScale * 0.85, targetScale, ease2);

        rotGroupRef.current.rotation.x = THREE.MathUtils.lerp(0.15, targetRotation.current.x, ease2);
        rotGroupRef.current.rotation.y = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(index * 45), targetRotation.current.y, ease2);
        rotGroupRef.current.rotation.z = THREE.MathUtils.lerp(0, targetRotation.current.z, ease2);
      }

      groupRef.current.position.set(curX, curY, curZ);
      groupRef.current.scale.set(curScale, curScale, curScale);

      // ── Inner Core Breathing Pulse ──
      if (innerCoreRef.current) {
        const pulse = 0.94 + 0.06 * Math.sin(2.05 * state.clock.elapsedTime);
        innerCoreRef.current.scale.setScalar(pulse * 0.54);
      }

      // Stones in gauntlet glow with vibrant crystal energy directly from within
      let curShellEmissive: number;
      let curCoreEmissive: number;
      let curSparkEmissive: number;

      const socketRadius = GAUNTLET_CONFIG.socket_light_radius ?? 0.65;
      const socketIntensity = (GAUNTLET_CONFIG.socket_light_intensity ?? 2.6) * luminanceFactor * (stoneGlow / 1.0);

      if (pFlight < 0.28) {
        // Docked in gauntlet after Star-Lord transition: stones glow vibrantly
        curShellEmissive = 1.25 * luminanceFactor * (stoneGlow / 1.0);
        curCoreEmissive = 2.20 * luminanceFactor * (stoneGlow / 1.0);
        curSparkEmissive = 2.60 * luminanceFactor * (stoneGlow / 1.0);

        // Emit light in a small, tight radius immediately on the gauntlet socket
        if (centerLightRef.current) {
          centerLightRef.current.distance = socketRadius;
          centerLightRef.current.decay = 2.0;
          centerLightRef.current.intensity = socketIntensity;
        }
        if (offsetLightRef.current) {
          offsetLightRef.current.distance = socketRadius * 0.70;
          offsetLightRef.current.decay = 2.0;
          offsetLightRef.current.intensity = socketIntensity * 0.55;
        }
      } else {
        // Bursting and flying up: dramatic launch flare, expanding light radius as stones rise
        const flare = 1.0 + Math.sin(((pFlight - 0.28) / 0.72) * Math.PI) * 0.55;
        curShellEmissive = 1.25 * luminanceFactor * (stoneGlow / 1.0) * flare;
        curCoreEmissive = 2.30 * luminanceFactor * (stoneGlow / 1.0) * flare;
        curSparkEmissive = 2.70 * luminanceFactor * (stoneGlow / 1.0) * flare;

        const flightT = (pFlight - 0.28) / 0.72;
        const curDist = THREE.MathUtils.lerp(socketRadius, 5 * stonesSize, flightT);
        if (centerLightRef.current) {
          centerLightRef.current.distance = curDist;
          centerLightRef.current.decay = 2.0;
          centerLightRef.current.intensity = THREE.MathUtils.lerp(socketIntensity, pointLightIntensity * 0.5, flightT);
        }
        if (offsetLightRef.current) {
          offsetLightRef.current.distance = curDist * 0.70;
          offsetLightRef.current.decay = 2.0;
          offsetLightRef.current.intensity = THREE.MathUtils.lerp(socketIntensity * 0.55, pointLightIntensity * 0.3, flightT);
        }
      }

      if (shellMaterialRef.current) {
        shellMaterialRef.current.emissiveIntensity = curShellEmissive;
      }
      if (coreMaterialRef.current) {
        coreMaterialRef.current.emissiveIntensity = curCoreEmissive;
      }
      if (sparkMaterialRef.current) {
        sparkMaterialRef.current.emissiveIntensity = curSparkEmissive;
      }
      return;
    }

    // Calculate individual stone arrival progress based on GAUNTLET_CONFIG.stone_timings
    const timing = (GAUNTLET_CONFIG.stone_timings as Record<string, { start: number; end: number }>)[stone.id] || { start: 0.1, end: 0.7 };
    const stoneRawT = THREE.MathUtils.clamp((convergenceProgress - timing.start) / (timing.end - timing.start || 1), 0, 1);
    const stoneT = stoneRawT * stoneRawT * (3 - 2 * stoneRawT); // smoothstep

    // Calculate target position and scale (orbit vs gauntlet socket)
    let destX = targetX;
    let destY = targetY;
    let destZ = targetZ;
    let destScale = targetScale;

    const socketData = (GAUNTLET_SOCKETS as Record<string, GauntletSocket>)[stone.id];
    if (stoneRawT > 0 && socketData) {
      const orbitPos = new THREE.Vector3(targetX, targetY, targetZ);
      const gauntletWorldPos = new THREE.Vector3(gauntletPosition[0], gauntletPosition[1], gauntletPosition[2]);
      const slotPos = calculateStoneSlotPosition(orbitPos, socketData.position, gauntletWorldPos, stoneRawT, gauntletScale);
      destX = slotPos.x;
      destY = slotPos.y;
      destZ = slotPos.z;
      destScale = THREE.MathUtils.lerp(targetScale, socketData.scale, stoneT);

      // Smoothly orient to gauntlet socket rotation as stone docks
      if (stoneT > 0.01) {
        targetRotation.current.x = THREE.MathUtils.lerp(targetRotation.current.x, socketData.rotation[0], stoneT);
        targetRotation.current.y = THREE.MathUtils.lerp(targetRotation.current.y, socketData.rotation[1], stoneT);
        targetRotation.current.z = THREE.MathUtils.lerp(targetRotation.current.z, socketData.rotation[2], stoneT);
      }
    }

    // Position & Scale tracking (anti-phasing trajectory & real-time socket resizing)
    if (stoneRawT > 0) {
      groupRef.current.position.set(destX, destY, destZ);
      groupRef.current.scale.set(destScale, destScale, destScale);
    } else {
      groupRef.current.position.lerp(new THREE.Vector3(destX, destY, destZ), delta * 8.5);
      const curScale = groupRef.current.scale.x;
      const nextScale = THREE.MathUtils.lerp(curScale, destScale, delta * 8.5);
      groupRef.current.scale.set(nextScale, nextScale, nextScale);
    }

    // Rotational physics:
    if (stoneRawT > 0 && socketData) {
      // Direct smooth alignment to socket rotation without runaway idle spin
      rotGroupRef.current.rotation.x = THREE.MathUtils.lerp(rotGroupRef.current.rotation.x, socketData.rotation[0], Math.min(1, delta * 12 + stoneT));
      rotGroupRef.current.rotation.y = THREE.MathUtils.lerp(rotGroupRef.current.rotation.y, socketData.rotation[1], Math.min(1, delta * 12 + stoneT));
      rotGroupRef.current.rotation.z = THREE.MathUtils.lerp(rotGroupRef.current.rotation.z, socketData.rotation[2], Math.min(1, delta * 12 + stoneT));
    } else {
      // Idle spin when in orbit and not dragging
      if (!isDragging.current) {
        targetRotation.current.y += (isActive ? 0.32 : 0.18) * delta;
      }
      rotGroupRef.current.rotation.x = THREE.MathUtils.lerp(rotGroupRef.current.rotation.x, targetRotation.current.x, 0.11);
      rotGroupRef.current.rotation.y = THREE.MathUtils.lerp(rotGroupRef.current.rotation.y, targetRotation.current.y, 0.11);
      rotGroupRef.current.rotation.z = THREE.MathUtils.lerp(rotGroupRef.current.rotation.z, targetRotation.current.z, 0.11);
    }

    // Vertical levitation bobbing (only while floating in orbit)
    const bobOffset = (isActive && stoneT < 0.1) ? 0.06 * Math.sin(0.78 * state.clock.elapsedTime) : 0;
    rotGroupRef.current.position.y = bobOffset;

    // Layer 3: Breathing pulse of the inner core
    if (innerCoreRef.current) {
      const pulse = 0.94 + 0.06 * Math.sin(2.05 * state.clock.elapsedTime);
      innerCoreRef.current.scale.setScalar(pulse * 0.54);
    }

    // Internal point lights: broad radius in orbit, small tight radius when docked in gauntlet
    const socketRadius = GAUNTLET_CONFIG.socket_light_radius ?? 0.65;
    const socketIntensity = (GAUNTLET_CONFIG.socket_light_intensity ?? 2.6) * luminanceFactor * (stoneGlow / 1.0);

    const orbitLight1 = (isActive ? pointLightIntensity * 1.25 : pointLightIntensity * 0.5 * depthFactor) * (stoneGlow / 1.0) * luminanceFactor;
    const orbitLight2 = (isActive ? pointLightIntensity * 0.65 : pointLightIntensity * 0.3 * depthFactor) * (stoneGlow / 1.0) * luminanceFactor;

    // As stone docks into gauntlet, distance tightens to small radius (socketRadius) and intensity settles to socketIntensity
    // On mobile, only activate point lights on the active stone to save GPU fragment shader overhead
    const shouldEnableLights = !isMobile || isActive;
    const targetDistance = THREE.MathUtils.lerp(5 * stonesSize, socketRadius, stoneT);
    const targetLight1 = shouldEnableLights ? THREE.MathUtils.lerp(orbitLight1, socketIntensity, stoneT) : 0;
    const targetLight2 = shouldEnableLights ? THREE.MathUtils.lerp(orbitLight2, socketIntensity * 0.55, stoneT) : 0;

    if (centerLightRef.current) {
      centerLightRef.current.distance = targetDistance;
      centerLightRef.current.decay = 2.0;
      centerLightRef.current.intensity = THREE.MathUtils.lerp(
        centerLightRef.current.intensity,
        targetLight1,
        delta * 8.0
      );
    }
    if (offsetLightRef.current) {
      offsetLightRef.current.distance = targetDistance * 0.70;
      offsetLightRef.current.decay = 2.0;
      offsetLightRef.current.intensity = THREE.MathUtils.lerp(
        offsetLightRef.current.intensity,
        targetLight2,
        delta * 8.0
      );
    }

    // Stones maintain a vibrant crystal glow when docked in gauntlet, without casting light onto gauntlet metal
    const dockShellEmissive = (1.05 + stoneRawT * 0.15) * luminanceFactor * (stoneGlow / 1.0);
    const dockCoreEmissive = (isActive ? 1.85 : 2.05) * luminanceFactor * (stoneGlow / 1.0);
    const dockSparkEmissive = (isActive ? 2.25 : 2.45) * luminanceFactor * (stoneGlow / 1.0);

    if (shellMaterialRef.current) {
      shellMaterialRef.current.emissiveIntensity = dockShellEmissive;
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = dockCoreEmissive;
    }
    if (sparkMaterialRef.current) {
      sparkMaterialRef.current.emissiveIntensity = dockSparkEmissive;
    }

    // ── Remove stone with gauntlet during Loki transition ──
    if (lokiTransitionProgress !== undefined && lokiTransitionProgress >= 0.999) {
      groupRef.current.visible = false;
      return;
    } else {
      groupRef.current.visible = true;
    }

    // If transitioning to Loki and stone is behind clipping plane, extinguish its point lights
    if (clippingPlanes && clippingPlanes.length > 0 && groupRef.current) {
      const plane = clippingPlanes[0];
      const worldPos = new THREE.Vector3();
      groupRef.current.getWorldPosition(worldPos);
      const dist = plane.distanceToPoint(worldPos);
      if (dist < 0.0) {
        if (centerLightRef.current) centerLightRef.current.intensity = 0;
        if (offsetLightRef.current) offsetLightRef.current.intensity = 0;
      }
    }
  });

  // Balanced emissive intensity using unified luminance factor and depth attenuation
  const baseEmissiveIntensity = (isActive ? 1.45 : 1.05 * depthFactor) * (stoneGlow / 1.0) * luminanceFactor;

  return (
    <group
      ref={groupRef}
      position={[targetX, targetY, targetZ]}
    >
      {/* ── Internal Interactive Rotatable Crystal Assembly (Anchor Link Clickable) ── */}
      <group
        ref={rotGroupRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
        onClick={handleClick}
      >
        {/* ── Layer 1: Main Crystal Shell (MeshPhysicalMaterial) ── */}
        <mesh geometry={activeGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            ref={shellMaterialRef}
            bumpMap={texture}
            bumpScale={0.08}
            roughnessMap={texture}
            color={stone.color}
            emissive={coreEmissive}
            emissiveIntensity={baseEmissiveIntensity}
            roughness={0.16}
            metalness={0.03}
            transmission={isMobile ? 0 : (isCreation ? 0.65 : 0.52)}
            thickness={1.6}
            ior={1.48}
            clearcoat={0.92}
            clearcoatRoughness={0.05}
            transparent
            opacity={isMobile ? 0.96 : 0.92}
            flatShading={true} // Razor-sharp crystalline facet gleams
            clippingPlanes={clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : undefined}
          />
        </mesh>

        {/* ── Layer 2: Outer Wireframe Cage ── */}
        <mesh geometry={activeGeometry} scale={1.009}>
          <meshBasicMaterial
            color={wireframeColor}
            wireframe
            transparent
            opacity={(isActive ? 0.045 : 0.025) * luminanceFactor}
            clippingPlanes={clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : undefined}
          />
        </mesh>

        {/* ── Layer 3: Pulsing Inner Core ── */}
        <mesh ref={innerCoreRef} geometry={activeGeometry} scale={0.54}>
          <meshStandardMaterial
            ref={coreMaterialRef}
            color={coreEmissive}
            emissive={coreEmissive}
            emissiveIntensity={(isActive ? 2.2 : 1.85) * luminanceFactor * (stoneGlow / 1.0)}
            roughness={0.25}
            transparent
            opacity={isActive ? 0.85 : 0.72}
            clippingPlanes={clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : undefined}
          />
        </mesh>

        {/* ── Layer 4: Off-center Bright Spark ── */}
        <mesh
          geometry={activeGeometry}
          scale={[0.26, 0.38, 0.28]}
          position={[0.05, -0.05, 0.32]}
        >
          <meshStandardMaterial
            ref={sparkMaterialRef}
            color={sparkColor}
            emissive={sparkColor}
            emissiveIntensity={(isActive ? 2.6 : 2.25) * luminanceFactor * (stoneGlow / 1.0)}
            roughness={0.2}
            transparent
            opacity={0.85}
            clippingPlanes={clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : undefined}
          />
        </mesh>

        {/* ── Internal Lights (PointLight 1: Center + PointLight 2: Offset Bright Light) ── */}
        <pointLight
          ref={centerLightRef}
          color={coreEmissive}
          intensity={0}
          distance={5 * stonesSize}
          decay={2}
        />
        <pointLight
          ref={offsetLightRef}
          color={sparkColor}
          intensity={0}
          distance={3 * stonesSize}
          decay={2}
          position={[0.05, -0.05, 0.32]}
        />

        {/* ── Layer 5: 22 Orbiting Crystal Shards (Tetrahedrons on active stone) ── */}
        {isActive && convergenceProgress < 0.02 && (
          <FloatingShards
            color={stone.color}
            isActive={isActive}
            scaleFactor={0.78}
            stoneGlow={stoneGlow}
            luminanceFactor={luminanceFactor}
            isMobile={isMobile}
          />
        )}
      </group>

      {/* ── Prismatic Diamond Aura (Subtle accent on active stone only) ── */}
      {isActive && convergenceProgress < 0.02 && (
        <mesh scale={1.22}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshBasicMaterial
            color={coreEmissive}
            transparent
            opacity={0.09 * luminanceFactor}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};

export default ProceduralCrystalStone;
