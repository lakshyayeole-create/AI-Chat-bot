import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import * as THREE from 'three'
import { gsap } from '../../lib/gsap'

interface BoxProps {
  onRegisterTrigger?: (trigger: () => void) => void
}

function AnimatedBox({ onRegisterTrigger }: BoxProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Continuous subtle rotation via Three.js frame loop
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.4
    }
  })

  // Hook GSAP animation into Three.js mesh
  useEffect(() => {
    if (onRegisterTrigger) {
      onRegisterTrigger(() => {
        if (!meshRef.current) return
        gsap.to(meshRef.current.scale, {
          x: 1.35,
          y: 1.35,
          z: 1.35,
          duration: 0.3,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out',
        })
        gsap.to(meshRef.current.rotation, {
          x: meshRef.current.rotation.x + Math.PI,
          duration: 0.8,
          ease: 'back.out(1.7)',
        })
      })
    }
  }, [onRegisterTrigger])

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef}>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshStandardMaterial
          color="#6366f1"
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>
    </Float>
  )
}

interface SceneProps {
  onRegisterTrigger?: (trigger: () => void) => void
}

export function Scene({ onRegisterTrigger }: SceneProps) {
  return (
    <div className="canvas-container">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 7]} intensity={1.5} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#ec4899" />
        <AnimatedBox onRegisterTrigger={onRegisterTrigger} />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  )
}
