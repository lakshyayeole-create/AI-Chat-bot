import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAUNTLET_SOCKETS } from '../config/gauntletConfig';
import { createProceduralStoneGeometry } from '../utils/crystalGeometry';

interface GauntletToLokiTransitionProps {
  /** 0.0 = Gauntlet in focus, 1.0 = Loki's Helmet in focus */
  transitionProgress: number;
  /** Y-axis rotation in radians (e.g. wipeT * Math.PI * 2 for 360-degree rotation) */
  rotationY?: number;
  /** Position X offset in world units (e.g. to glide Loki to the side) */
  lokiPositionX?: number;
  /** Opacity of the transition layer */
  opacity?: number;
}

/**
 * 3D Diagonal Seam Wipe Transition: Infinity Gauntlet → Loki's Horned Helmet
 * - Bottom-left to top-right diagonal laser seam wipe
 * - Synchronous 360-degree rotation on scroll
 * - High-tech Asgardian emerald & gold neon laser seam
 */
export const GauntletToLokiTransition: React.FC<GauntletToLokiTransitionProps> = ({
  transitionProgress,
  rotationY = 0,
  lokiPositionX = 0,
  opacity = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gauntletCanvasRef = useRef<HTMLCanvasElement>(null);
  const lokiCanvasRef = useRef<HTMLCanvasElement>(null);
  const diagonalLineRef = useRef<HTMLDivElement>(null);

  // Three.js instances
  const gauntletSceneRef = useRef<THREE.Scene | null>(null);
  const lokiSceneRef = useRef<THREE.Scene | null>(null);
  const gauntletGroupRef = useRef<THREE.Group | null>(null);
  const lokiGroupRef = useRef<THREE.Group | null>(null);
  const gauntletRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const lokiRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Initialize Scenes on Mount
  useEffect(() => {
    const gauntletCanvas = gauntletCanvasRef.current;
    const lokiCanvas = lokiCanvasRef.current;
    if (!gauntletCanvas || !lokiCanvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Camera shared framing (aligned with AnantyaTimeline perspective)
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 8.5);
    cameraRef.current = camera;

    // ── 1. Gauntlet Scene Setup ──
    const gauntletScene = new THREE.Scene();
    gauntletSceneRef.current = gauntletScene;

    const gauntletRenderer = new THREE.WebGLRenderer({
      canvas: gauntletCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    gauntletRenderer.setSize(width, height);
    gauntletRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    gauntletRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    gauntletRendererRef.current = gauntletRenderer;

    // Lighting for Gauntlet
    const gAmbient = new THREE.AmbientLight(0xffffff, 1.2);
    gauntletScene.add(gAmbient);
    const gKey = new THREE.DirectionalLight(0xfff7e6, 2.2);
    gKey.position.set(4, 5, 4);
    gauntletScene.add(gKey);
    const gRim = new THREE.DirectionalLight(0x00f0ff, 1.6);
    gRim.position.set(-4, -2, -3);
    gauntletScene.add(gRim);

    // Build the Gauntlet Hand with All 8 Stones in Sockets (matching timeline gauntlet)
    const gauntletGroup = new THREE.Group();
    gauntletGroup.position.set(0, -0.32, 0.0);
    gauntletGroup.scale.setScalar(1.75);
    gauntletScene.add(gauntletGroup);
    gauntletGroupRef.current = gauntletGroup;

    // Load Thanos Infinity Gauntlet GLB model
    const gauntletLoader = new GLTFLoader();
    gauntletLoader.load(
      '/assets/gauntlet.glb',
      (gltf) => {
        const model = gltf.scene;
        const s = 3.6 / 228.79;
        model.position.set(-0.009 * s, -105.65 * s, -19.33 * s);
        model.scale.setScalar(s);

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.frustumCulled = false;
            m.castShadow = true;
            m.receiveShadow = true;
            if (m.name === 'Thanos_Infinity_Gauntlet') {
              const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0xf59e0b),
                metalness: 0.72,
                roughness: 0.28,
                emissive: new THREE.Color(0x92400e),
                emissiveIntensity: 0.35,
                side: THREE.DoubleSide,
              });
              m.material = mat;
            } else if (m.name.includes('Infinity_Stones')) {
              child.visible = false;
            }
          }
        });

        gauntletGroup.add(model);
      },
      undefined,
      (err) => console.error('Failed to load gauntlet.glb:', err)
    );

    // Add all 8 Glowing Infinity Stones into their respective sockets
    const stoneGeom = createProceduralStoneGeometry();
    Object.values(GAUNTLET_SOCKETS).forEach((socket) => {
      const stoneMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(socket.color),
        emissive: new THREE.Color(socket.color),
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.1,
        transmission: 0.75,
        ior: 1.52,
        flatShading: true,
      });

      const stoneMesh = new THREE.Mesh(stoneGeom, stoneMat);
      stoneMesh.position.set(...socket.position);
      stoneMesh.rotation.set(...socket.rotation);
      stoneMesh.scale.setScalar(socket.scale);
      gauntletGroup.add(stoneMesh);

      // Core point light for each stone
      const pLight = new THREE.PointLight(socket.color, 2.5, 3.5);
      pLight.position.set(...socket.position);
      gauntletGroup.add(pLight);
    });

    // ── 2. Loki's Helmet Scene Setup ──
    const lokiScene = new THREE.Scene();
    lokiSceneRef.current = lokiScene;

    const lokiRenderer = new THREE.WebGLRenderer({
      canvas: lokiCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    lokiRenderer.setSize(width, height);
    lokiRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    lokiRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    lokiRendererRef.current = lokiRenderer;

    // Asgardian Emerald & Gold Lighting
    const lAmbient = new THREE.AmbientLight(0xd1fae5, 1.1);
    lokiScene.add(lAmbient);
    const lKey = new THREE.DirectionalLight(0xfef08a, 2.4);
    lKey.position.set(4, 5, 5);
    lokiScene.add(lKey);
    const lEmeraldRim = new THREE.DirectionalLight(0x10b981, 2.5);
    lEmeraldRim.position.set(-5, 2, -3);
    lokiScene.add(lEmeraldRim);

    const lokiGroup = new THREE.Group();
    lokiGroup.position.set(0, -0.15, -0.4);
    lokiScene.add(lokiGroup);
    lokiGroupRef.current = lokiGroup;

    // Load Loki's Horned Helmet GLB
    const loader = new GLTFLoader();
    loader.load(
      '/assets/loki_helmet.glb',
      (gltf) => {
        const model = gltf.scene;

        // Auto-center and normalize size
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 1.85; // Regal height for horns
        const scale = targetHeight / Math.max(size.y, 0.001);
        lokiGroup.scale.setScalar(scale);

        // Enhance gold & metallic sheen
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            if (m.material) {
              const mat = m.material as THREE.MeshStandardMaterial;
              mat.metalness = Math.max(mat.metalness || 0, 0.85);
              mat.roughness = Math.min(mat.roughness ?? 0.3, 0.25);
            }
          }
        });

        lokiGroup.add(model);
      },
      undefined,
      (err) => console.error('Failed to load loki_helmet.glb:', err)
    );

    // Resize handler
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (cameraRef.current) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
      }
      gauntletRenderer.setSize(w, h);
      lokiRenderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      gauntletRenderer.dispose();
      lokiRenderer.dispose();
    };
  }, []);

  // Frame Render Loop driven by transitionProgress and rotationY
  useEffect(() => {
    let animId: number;

    const render = () => {
      animId = requestAnimationFrame(render);

      const p = Math.max(0, Math.min(1, transitionProgress));

      // Synchronous 360-degree rotation across the laser seam
      if (gauntletGroupRef.current) {
        gauntletGroupRef.current.rotation.y = rotationY;
        gauntletGroupRef.current.visible = p < 0.999;
      }
      if (lokiGroupRef.current) {
        lokiGroupRef.current.rotation.y = rotationY;
        lokiGroupRef.current.position.x = lokiPositionX;
        lokiGroupRef.current.visible = p > 0.001;
      }

      // Render both views
      if (cameraRef.current) {
        if (gauntletRendererRef.current && gauntletSceneRef.current && p < 0.999) {
          gauntletRendererRef.current.render(gauntletSceneRef.current, cameraRef.current);
        }
        if (lokiRendererRef.current && lokiSceneRef.current && p > 0.001) {
          lokiRendererRef.current.render(lokiSceneRef.current, cameraRef.current);
        }
      }

      // Continuous Diagonal Laser Seam: linear-gradient(to top right)
      // Identical to Iron Man -> Ant-Man wipe line
      const pct = -10 + p * 120;
      if (gauntletCanvasRef.current) {
        const mask = `linear-gradient(to top right, transparent 0%, transparent ${pct}%, #000 calc(${pct}% + 1.5px), #000 100%)`;
        gauntletCanvasRef.current.style.webkitMaskImage = mask;
        gauntletCanvasRef.current.style.maskImage = mask;
      }

      // Glowing Neon Laser Seam Line (Asgardian Emerald to Cosmic Gold)
      if (diagonalLineRef.current) {
        if (p > 0.01 && p < 0.99) {
          diagonalLineRef.current.style.opacity = '1';
          diagonalLineRef.current.style.background = `linear-gradient(to top right, transparent calc(${pct}% - 2.5px), rgba(16, 185, 129, 0.85) calc(${pct}% - 0.5px), #ffffff ${pct}%, rgba(234, 179, 8, 0.85) calc(${pct}% + 0.5px), transparent calc(${pct}% + 2.5px))`;
        } else {
          diagonalLineRef.current.style.opacity = '0';
        }
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [transitionProgress, rotationY, lokiPositionX]);

  return (
    <div
      ref={containerRef}
      className="gauntlet-loki-transition-root"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        opacity,
        visibility: opacity <= 0.005 ? 'hidden' : 'visible',
        zIndex: 42,
        transition: 'opacity 0.25s linear',
      }}
    >
      {/* Back Layer: Loki's Horned Helmet */}
      <canvas
        ref={lokiCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Front Layer: Infinity Gauntlet with Diagonal Mask */}
      <canvas
        ref={gauntletCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Diagonal Neon Laser Line */}
      <div
        ref={diagonalLineRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.1s ease',
        }}
      />
    </div>
  );
};

export default GauntletToLokiTransition;
