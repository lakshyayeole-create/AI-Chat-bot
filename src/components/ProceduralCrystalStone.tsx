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
}

export const FloatingShards: React.FC<FloatingShardsProps> = ({
  color,
  isActive,
  scaleFactor = 1,
  stoneGlow = 1.45,
  luminanceFactor = 1.0,
}) => {
  const shardsGroupRef = useRef<THREE.Group>(null);

  const shards = useMemo(
    () =>
      Array.from({ length: 22 }, (_, t) => ({
        position: [
          Math.sin(9.4 * t) * (1.15 + (t % 4) * 0.22) * scaleFactor,
          1.42 * Math.cos(5.6 * t) * scaleFactor,
          0.72 * Math.cos(3.2 * t) * scaleFactor,
        ] as [number, number, number],
        scale: (0.02 + (t % 4) * 0.016) * (isActive ? 1.15 : 0.8) * scaleFactor,
        rotation: [0.7 * t, 0.4 * t, 0.2 * t] as [number, number, number],
      })),
    [isActive, scaleFactor]
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
  gauntletPosition?: [number, number, number];
  gauntletScale?: number;
  stoneGeometry?: THREE.BufferGeometry;
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
  textureUrl = '/assets/amber-crystal-surface.png',
  convergenceProgress = 0,
  gauntletPosition = [0, -0.2, 0],
  gauntletScale = 1.75,
  stoneGeometry,
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

    // Extinguish internal point lights when docked to eliminate blinding glare!
    const dockLightDim = THREE.MathUtils.clamp(1.0 - stoneRawT * 1.5, 0, 1);
    const targetLight1 = (isActive ? pointLightIntensity * 1.25 : pointLightIntensity * 0.5 * depthFactor) * (stoneGlow / 1.25) * luminanceFactor * dockLightDim;
    const targetLight2 = (isActive ? pointLightIntensity * 0.65 : pointLightIntensity * 0.3 * depthFactor) * (stoneGlow / 1.25) * luminanceFactor * dockLightDim;
    if (centerLightRef.current) {
      centerLightRef.current.intensity = THREE.MathUtils.lerp(
        centerLightRef.current.intensity,
        targetLight1,
        delta * 8.0
      );
    }
    if (offsetLightRef.current) {
      offsetLightRef.current.intensity = THREE.MathUtils.lerp(
        offsetLightRef.current.intensity,
        targetLight2,
        delta * 8.0
      );
    }

    // Dim stone emissive intensity during docking so faceted crystal geometry remains crisp & visible
    const dockEmissiveFactor = THREE.MathUtils.clamp(1.0 - stoneRawT * 0.72, 0.28, 1.0);
    if (shellMaterialRef.current) {
      shellMaterialRef.current.emissiveIntensity = baseEmissiveIntensity * dockEmissiveFactor;
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = (isActive ? 1.3 : 0.75) * luminanceFactor * (stoneGlow / 1.25) * dockEmissiveFactor;
    }
    if (sparkMaterialRef.current) {
      sparkMaterialRef.current.emissiveIntensity = (isActive ? 1.5 : 0.85) * luminanceFactor * (stoneGlow / 1.25) * dockEmissiveFactor;
    }
  });

  // Balanced emissive intensity using unified luminance factor and depth attenuation
  const baseEmissiveIntensity = (isActive ? 1.35 : 0.72 * depthFactor) * (stoneGlow / 1.25) * luminanceFactor;

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
            transmission={isCreation ? 0.65 : 0.52}
            thickness={1.6}
            ior={1.48}
            clearcoat={0.92}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.92}
            flatShading={true} // Razor-sharp crystalline facet gleams
          />
        </mesh>

        {/* ── Layer 2: Outer Wireframe Cage ── */}
        <mesh geometry={activeGeometry} scale={1.009}>
          <meshBasicMaterial
            color={wireframeColor}
            wireframe
            transparent
            opacity={(isActive ? 0.045 : 0.025) * luminanceFactor}
          />
        </mesh>

        {/* ── Layer 3: Pulsing Inner Core ── */}
        <mesh ref={innerCoreRef} geometry={activeGeometry} scale={0.54}>
          <meshStandardMaterial
            ref={coreMaterialRef}
            color={coreEmissive}
            emissive={coreEmissive}
            emissiveIntensity={(isActive ? 1.3 : 0.75) * luminanceFactor * (stoneGlow / 1.25)}
            roughness={0.25}
            transparent
            opacity={isActive ? 0.85 : 0.72}
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
            emissiveIntensity={(isActive ? 1.5 : 0.85) * luminanceFactor * (stoneGlow / 1.25)}
            roughness={0.2}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* ── Internal Lights (PointLight 1: Center + PointLight 2: Offset Bright Light) ── */}
        <pointLight
          ref={centerLightRef}
          color={coreEmissive}
          intensity={pointLightIntensity * (stoneGlow / 1.25) * luminanceFactor}
          distance={7 * stonesSize}
          decay={2}
        />
        <pointLight
          ref={offsetLightRef}
          color={sparkColor}
          intensity={(pointLightIntensity * 0.5) * (stoneGlow / 1.25) * luminanceFactor}
          distance={4 * stonesSize}
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
