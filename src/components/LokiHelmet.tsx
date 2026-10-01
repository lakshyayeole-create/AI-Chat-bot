import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

interface LokiHelmetProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  clippingPlanes?: THREE.Plane[];
}

export const LokiHelmet: React.FC<LokiHelmetProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  clippingPlanes,
}) => {
  const { scene } = useGLTF('/assets/loki_main.glb');

  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const targetHeight = 2.8; // Regal height for horns
    const s = targetHeight / Math.max(size.y, 0.001);

    const wrapper = new THREE.Group();
    clone.scale.setScalar(s);
    wrapper.add(clone);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;

        if (m.material) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.metalness = Math.max(mat.metalness || 0, 0.88);
          mat.roughness = Math.min(mat.roughness ?? 0.3, 0.22);
          if (clippingPlanes && clippingPlanes.length > 0) {
            mat.clippingPlanes = clippingPlanes;
          }
          m.material = mat;
        }
      }
    });

    return wrapper;
  }, [scene, clippingPlanes]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Asgardian Emerald & Gold Lighting */}
      <ambientLight intensity={1.5} color="#d1fae5" />
      <directionalLight position={[4, 5, 5]} intensity={2.6} color="#fef08a" />
      <directionalLight position={[-5, 2, -3]} intensity={2.8} color="#10b981" />
      <primitive object={model} />
    </group>
  );
};

useGLTF.preload('/assets/loki_main.glb');
export default LokiHelmet;
