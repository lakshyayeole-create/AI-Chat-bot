import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GAUNTLET_CONFIG } from '../config/gauntletConfig';

interface InfinityGauntletProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  /** Stone slotting progress (0.0 to 1.0) */
  convergenceProgress?: number;
  /** Overall energy glow multiplier */
  energyPulse?: number;
  /** Optional Three.js clipping planes for diagonal laser transition */
  clippingPlanes?: THREE.Plane[];
  /**
   * Fist-opening / unfurl progress (0.0 = fully closed fist, 1.0 = wide open palm).
   * Used for the pre-Event 1 intro animation. Thumb unfurls first, Pinky last.
   * When this is > 0 and convergenceProgress == 0, the gauntlet starts as a closed fist
   * and progressively opens across the sequence: Thumb → Index → Middle → Ring → Pinky.
   */
  openProgress?: number;
}

export type FingerType = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

interface FingerBoneInfo {
  bone: THREE.Bone;
  baseRotX: number;
  curlAmount: number;
  fingerType: FingerType;
}

/**
 * 3D Open-Palm Infinity Gauntlet
 * - Loads custom rigged 3D model `/assets/gauntlet.glb`
 * - Safely clones skinned mesh using SkeletonUtils to retain all 20 armature bones
 * - Dynamically curls each finger sequentially (Pinky -> Ring -> Middle -> Index -> Thumb) as stones attach!
 * - Controls gauntlet shine, metalness, and studio lighting via GAUNTLET_CONFIG
 * - Supports clipping planes for seamless in-scene diagonal laser transition to Loki
 */
export const InfinityGauntlet: React.FC<InfinityGauntletProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  convergenceProgress = 0,
  energyPulse = 1.0,
  clippingPlanes,
  openProgress = 0,
}) => {
  const gauntletGroupRef = useRef<THREE.Group>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const gauntletMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const { scene } = useGLTF('/assets/gauntlet.glb');

  // Clone using SkeletonUtils so all 20 armature bones remain bound to the SkinnedMesh!
  const { gauntletModel, fingerBones } = useMemo(() => {
    const clone = skeletonClone(scene);

    // Anchor on Mind Stone [0.009, 105.65, 19.33] so the hand is centered at (0, 0, 0)
    const s = 3.6 / 228.79; // ~0.01573

    const wrapper = new THREE.Group();
    wrapper.add(clone);
    clone.position.set(-0.009 * s, -105.65 * s, -19.33 * s);
    clone.scale.setScalar(s);

    const bonesList: FingerBoneInfo[] = [];

    // Enhance metallic gold & uru finish and find rigged finger bones
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.frustumCulled = false; // Never cull skinned mesh!
        m.castShadow = true;
        m.receiveShadow = true;

        const lowerName = m.name.toLowerCase();
        if (lowerName.includes('gauntlet')) {
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(GAUNTLET_CONFIG.color),
            metalness: GAUNTLET_CONFIG.metalness,
            roughness: GAUNTLET_CONFIG.roughness,
            emissive: new THREE.Color(GAUNTLET_CONFIG.emissive_color),
            emissiveIntensity: GAUNTLET_CONFIG.emissive_intensity,
            side: THREE.DoubleSide,
            clippingPlanes: clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : undefined,
          });
          m.material = mat;
          gauntletMaterialRef.current = mat;
        } else if (lowerName.includes('stone')) {
          // Hide built-in placeholder stones on raw model so the sockets are empty recesses!
          m.visible = false;
        }
      } else if ((child as THREE.Bone).isBone) {
        const name = child.name;
        // Individual finger curl mapping:
        // Finger 1 (Index): Bone003, Bone004, Bone005 -> index_curl
        // Finger 2 (Middle): Bone006, Bone007, Bone008 -> middle_curl
        // Finger 3 (Ring): Bone009, Bone010, Bone011 -> ring_curl
        // Finger 4 (Pinky): Bone017, Bone018, Bone019 -> pinky_curl
        // Thumb: Bone020, Bone021, Bone022 -> thumb_curl
        let curl = 0;
        let fingerType: FingerType = 'pinky';

        if (name.match(/Bone0(0[345])/)) {
          curl = GAUNTLET_CONFIG.index_curl;
          fingerType = 'index';
        } else if (name.match(/Bone0(0[678])/)) {
          curl = GAUNTLET_CONFIG.middle_curl;
          fingerType = 'middle';
        } else if (name.match(/Bone0(09|1[01])/)) {
          curl = GAUNTLET_CONFIG.ring_curl;
          fingerType = 'ring';
        } else if (name.match(/Bone0(1[789])/)) {
          curl = GAUNTLET_CONFIG.pinky_curl;
          fingerType = 'pinky';
        } else if (name.match(/Bone0(2[012])/)) {
          curl = GAUNTLET_CONFIG.thumb_curl;
          fingerType = 'thumb';
        }

        if (curl !== 0) {
          bonesList.push({
            bone: child as THREE.Bone,
            baseRotX: child.rotation.x,
            curlAmount: curl,
            fingerType,
          });
        }
      }
    });

    return { gauntletModel: wrapper, fingerBones: bonesList };
  }, [scene, clippingPlanes]);

  // Helper to compute individual eased curl progress per finger type
  const getFingerCurlEased = (fingerType: FingerType, progress: number): number => {
    let start = 0;
    let end = 1;
    switch (fingerType) {
      case 'pinky':
        start = GAUNTLET_CONFIG.pinky_start;
        end = GAUNTLET_CONFIG.pinky_end;
        break;
      case 'ring':
        start = GAUNTLET_CONFIG.ring_start;
        end = GAUNTLET_CONFIG.ring_end;
        break;
      case 'middle':
        start = GAUNTLET_CONFIG.middle_start;
        end = GAUNTLET_CONFIG.middle_end;
        break;
      case 'index':
        start = GAUNTLET_CONFIG.index_start;
        end = GAUNTLET_CONFIG.index_end;
        break;
      case 'thumb':
        start = GAUNTLET_CONFIG.thumb_start;
        end = GAUNTLET_CONFIG.thumb_end;
        break;
    }
    const t = THREE.MathUtils.clamp((progress - start) / (end - start || 1), 0, 1);
    return t * t * (3 - 2 * t); // smoothstep
  };

  // Helper to compute individual eased open progress per finger type (reverse of closing)
  const getFingerOpenEased = (fingerType: FingerType, progress: number): number => {
    let start = 0;
    let end = 1;
    switch (fingerType) {
      case 'thumb':
        start = GAUNTLET_CONFIG.thumb_open_start;
        end = GAUNTLET_CONFIG.thumb_open_end;
        break;
      case 'index':
        start = GAUNTLET_CONFIG.index_open_start;
        end = GAUNTLET_CONFIG.index_open_end;
        break;
      case 'middle':
        start = GAUNTLET_CONFIG.middle_open_start;
        end = GAUNTLET_CONFIG.middle_open_end;
        break;
      case 'ring':
        start = GAUNTLET_CONFIG.ring_open_start;
        end = GAUNTLET_CONFIG.ring_open_end;
        break;
      case 'pinky':
        start = GAUNTLET_CONFIG.pinky_open_start;
        end = GAUNTLET_CONFIG.pinky_open_end;
        break;
    }
    const t = THREE.MathUtils.clamp((progress - start) / (end - start || 1), 0, 1);
    return t * t * (3 - 2 * t); // smoothstep
  };

  // Dynamic Sequential Finger Folding & Clenching
  useFrame(() => {
    if (coreLightRef.current) {
      const p = Math.max(0, convergenceProgress);
      coreLightRef.current.intensity = (1.5 + Math.sin(Date.now() * 0.005) * 0.8) * p * GAUNTLET_CONFIG.nexus_pulse_intensity * energyPulse;
    }

    fingerBones.forEach(({ bone, baseRotX, curlAmount, fingerType }) => {
      if (openProgress !== undefined && openProgress > 0 && convergenceProgress <= 0) {
        // ── Pre-Event 1 Opening: Fist unfurls into open palm (Thumb → Index → Middle → Ring → Pinky) ──
        // openProgress=0: fully clenched fist; openProgress=1: wide open palm
        const closedCurlEased = 1.0; // Start fully closed
        const openEased = getFingerOpenEased(fingerType, openProgress);
        // Lerp from fully curled (closedCurlEased) to fully open (0)
        const totalCurl = THREE.MathUtils.lerp(closedCurlEased, 0.0, openEased);
        bone.rotation.x = THREE.MathUtils.lerp(baseRotX, baseRotX + curlAmount, totalCurl);
      } else {
        // ── Post-Event 8 Closing: Sequential Finger Clench (Pinky → Ring → Middle → Index → Thumb) ──
        const easedCurl = getFingerCurlEased(fingerType, convergenceProgress);
        bone.rotation.x = THREE.MathUtils.lerp(baseRotX, baseRotX + curlAmount, easedCurl);
      }
    });
  });

  return (
    <group ref={gauntletGroupRef} position={position} rotation={rotation} scale={scale}>
      {/* ── Soft Balanced Cinematic Illumination (Tuned to eliminate excessive glare) ── */}
      <ambientLight intensity={GAUNTLET_CONFIG.ambient_light} color="#ffffff" />
      <directionalLight position={[0, 6, 8]} intensity={GAUNTLET_CONFIG.key_light} color="#fffbeb" />
      <directionalLight position={[-6, 2, 4]} intensity={GAUNTLET_CONFIG.fill_light_left} color="#fed7aa" />
      <directionalLight position={[6, -2, 4]} intensity={GAUNTLET_CONFIG.fill_light_right} color="#fef08a" />
      <pointLight position={[0, 0, 2.5]} intensity={GAUNTLET_CONFIG.point_light} color="#fbbf24" distance={8} />

      <primitive object={gauntletModel} />

      {/* Central Pulsing Nexus Point Light */}
      <pointLight
        ref={coreLightRef}
        position={[0.02, 0.0, 0.25]}
        color="#ffd600"
        intensity={Math.max(0, convergenceProgress * GAUNTLET_CONFIG.nexus_pulse_intensity * energyPulse)}
        distance={4.5}
      />
    </group>
  );
};

useGLTF.preload('/assets/gauntlet.glb');
export default InfinityGauntlet;
