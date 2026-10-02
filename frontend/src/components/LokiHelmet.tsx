import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { getModelUrl } from '../utils/assets';

const LOKI_MODEL = getModelUrl('/assets/loki_main.glb', '/assets/loki_main.glb');

interface LokiHelmetProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  clippingPlanes?: THREE.Plane[];
  isFloating?: boolean;
  opacity?: number;
}

export const LokiHelmet: React.FC<LokiHelmetProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  clippingPlanes,
  isFloating = true,
  opacity = 1.0,
}) => {
  const { scene } = useGLTF(LOKI_MODEL);
  const floatRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  // Update mesh opacity and visibility smoothly on every frame without shader recompilation
  useFrame(() => {
    const isVis = opacity > 0.001;
    materialsRef.current.forEach((mat) => {
      mat.opacity = opacity;
      mat.visible = isVis;
    });
  });

  // Subtle breathing / levitation float for the celestial crown
  useFrame(({ clock }) => {
    if (floatRef.current) {
      if (isFloating) {
        const t = clock.getElapsedTime();
        floatRef.current.position.y = Math.sin(t * 1.8) * 0.035;
        floatRef.current.rotation.y = Math.sin(t * 0.9) * 0.025;
      } else {
        floatRef.current.position.y = 0;
        floatRef.current.rotation.y = 0;
      }
    }
  });

  // Dynamically update clipping planes without re-cloning the 3D model
  useEffect(() => {
    materialsRef.current.forEach((mat) => {
      mat.clippingPlanes = clippingPlanes && clippingPlanes.length > 0 ? clippingPlanes : null;
    });
  }, [clippingPlanes]);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    // Exact mathematical symmetry centerline of the helmet mesh
    center.x = -0.0682823;
    clone.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 2.8; // Regal height for horns
    const s = targetHeight / Math.max(size.y, 0.001);

    const wrapper = new THREE.Group();
    clone.scale.setScalar(s);
    wrapper.add(clone);

    const mats: THREE.MeshStandardMaterial[] = [];
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;

        if (m.material) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          // Cinematic antique Asgardian Gold with depth and metallic sheen
          mat.color = new THREE.Color('#d4af37'); // Warm regal gold
          mat.metalness = 0.92;
          mat.roughness = 0.36; // Soft satin sheen that highlights contours instead of glare
          mat.envMapIntensity = 1.2;
          // Pre-enable transparency so opacity updates on the GPU without pipeline recompilation lag
          mat.transparent = true;
          mat.depthWrite = true;
          mat.opacity = opacity;
          if (clippingPlanes && clippingPlanes.length > 0) {
            mat.clippingPlanes = clippingPlanes;
          }
          m.material = mat;
          mats.push(mat);
        }
      }
    });
    materialsRef.current = mats;

    return wrapper;
  }, [scene]);

  // Clamp opacity multiplier for lights
  const lightFactor = Math.max(0, Math.min(1, opacity));

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group ref={floatRef}>
        {/* Cinematic 3-Point Lighting with Celestial Glow (fades seamlessly with opacity) */}
        {/* Soft dark ambient for deep crevice occlusion */}
        <ambientLight intensity={0.45 * lightFactor} color="#052e16" />

        {/* Top-Right Warm Golden Key Light */}
        <directionalLight position={[3.5, 4.5, 3.0]} intensity={1.8 * lightFactor} color="#fef08a" />

        {/* Left Side Emerald Timeline Fill Light */}
        <directionalLight position={[-4.0, 1.5, 1.5]} intensity={1.4 * lightFactor} color="#10b981" />

        {/* Back Rim Light: creates crisp emerald silhouette separation */}
        <directionalLight position={[0.0, 3.5, -3.5]} intensity={3.0 * lightFactor} color="#34d399" />

        {/* Ethereal corona back-glow behind the crown */}
        <pointLight position={[0, 0.2, -0.4]} intensity={2.2 * lightFactor} color="#10b981" distance={4} />

        {/* Warm golden aura casting down onto the space below */}
        <pointLight position={[0, -0.6, 0.4]} intensity={1.6 * lightFactor} color="#fbbf24" distance={3} />

        <primitive object={model} />
      </group>
    </group>
  );
};

useGLTF.preload(LOKI_MODEL);
export default LokiHelmet;
