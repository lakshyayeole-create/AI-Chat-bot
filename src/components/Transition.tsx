import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback
} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createAssemblySystem, AssemblyController, AssemblyStatus } from '../utils/assemblyAnimation';

export type { AssemblyStatus } from '../utils/assemblyAnimation';

export interface ModelLightingConfig {
  ambientColor?: number;
  ambientIntensity?: number;
  keyColor?: number;
  keyIntensity?: number;
  rimColor?: number;
  rimIntensity?: number;
  fillColor?: number;
  fillIntensity?: number;
  topColor?: number;
  topIntensity?: number;
}

export interface ModelConfig {
  /** Path to the 3D GLTF / GLB model file */
  modelPath: string;
  /** Optional background image texture placed on a plane directly behind the model */
  bgImagePath?: string;
  /** Optional forward/backward tilt along the X axis in radians */
  rotationX?: number;
  /** Normalized target height in world units (defaults to 1.5) */
  targetHeight?: number;
  /** Optional vertical position offset in world units */
  offsetY?: number;
  /** Custom mesh traversal callback */
  onMeshTraverse?: (mesh: THREE.Mesh) => void;
  /** Optional lighting overrides */
  lighting?: ModelLightingConfig;
  /** Enable dynamic piece-by-piece suit-up assembly on load */
  assemblyAnimation?: boolean;
  /** Whether assembly automatically begins on load. Set false to wait for scroll trigger */
  autoStartAssembly?: boolean;
}

export interface TransitionHandle {
  /** Programmatically animate transition to target progress (0.0 = fromModel, 1.0 = toModel) */
  transitionTo: (progress: number, durationMs?: number) => void;
  /** Toggle between the two models smoothly */
  toggle: (durationMs?: number) => void;
  /** Set rotation directly along Y axis in radians */
  setRotationY: (radians: number) => void;
  /** Get current transition progress (0.0 to 1.0) */
  getProgress: () => number;
  /** Programmatically trigger the suit-up assembly */
  triggerAssembly: () => void;
  /** Set assembly progress explicitly for scroll-scrubbing (0.0 to 1.0) */
  setAssemblyProgress: (progress: number) => void;
  /** Get current assembly progress */
  getAssemblyProgress: () => number;
  /** Set transition progress directly (0.0 to 1.0) */
  setTransitionProgress: (progress: number) => void;
}

export interface TransitionProps {
  /** Configuration for the front model (at progress 0) */
  fromModel: ModelConfig;
  /** Configuration for the back model (at progress 1) */
  toModel: ModelConfig;
  /** Initial progress from 0.0 to 1.0 (default 0.0) */
  initialProgress?: number;
  /** Assembly progress explicitly controlled by parent scroll (0.0 to 1.0) */
  assemblyProgress?: number;
  /** Transition progress explicitly controlled by parent scroll (0.0 to 1.0) */
  transitionProgress?: number;
  /** Model rotation Y controlled by parent scroll (fallback if fromRotationY / toRotationY not provided) */
  rotationY?: number;
  /** Specific rotation Y for fromModel (Iron Man) */
  fromRotationY?: number;
  /** Specific rotation Y for toModel (Ant-Man) */
  toRotationY?: number;
  /** Model position X offset controlled by parent scroll (fallback if fromPositionX / toPositionX not provided) */
  positionX?: number;
  /** Specific position X for fromModel (Iron Man, negative = left) */
  fromPositionX?: number;
  /** Specific position X for toModel (Ant-Man, positive = right) */
  toPositionX?: number;
  /** Model position Y offset controlled by parent scroll (fallback if fromPositionY / toPositionY not provided) */
  positionY?: number;
  /** Specific position Y for fromModel (Iron Man, positive = up) */
  fromPositionY?: number;
  /** Specific position Y for toModel (Star-Lord, positive = up) */
  toPositionY?: number;
  /** Enable internal mouse wheel / trackpad scroll interaction (default false when using Lenis) */
  enableScroll?: boolean;
  /** Transition sensitivity per scroll delta (default 0.0009) */
  scrollSensitivity?: number;
  /** Y-rotation sensitivity per scroll delta (default 0.003) */
  rotationSensitivity?: number;
  /** Callback fired whenever transition progress updates */
  onProgressChange?: (progress: number) => void;
  /** Optional callback fired when assembly animation completes */
  onAssemblyComplete?: () => void;
  /** Optional callback fired during assembly status changes */
  onAssemblyStatus?: (status: AssemblyStatus) => void;
  /** Optional container CSS class */
  className?: string;
  /** Optional container style */
  style?: React.CSSProperties;
}

export const Transition = forwardRef<TransitionHandle, TransitionProps>(
  (
    {
      fromModel,
      toModel,
      initialProgress = 0,
      assemblyProgress,
      transitionProgress,
      rotationY,
      fromRotationY,
      toRotationY,
      positionX,
      fromPositionX,
      toPositionX,
      positionY,
      fromPositionY,
      toPositionY,
      enableScroll = false,
      scrollSensitivity = 0.0009,
      rotationSensitivity = 0.003,
      onProgressChange,
      onAssemblyComplete,
      onAssemblyStatus,
      className,
      style
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const frontCanvasContainerRef = useRef<HTMLDivElement>(null);
    const backCanvasContainerRef = useRef<HTMLDivElement>(null);
    const diagonalLineRef = useRef<HTMLDivElement>(null);

    // Keep callback refs stable to prevent re-renders
    const onProgressChangeRef = useRef(onProgressChange);
    onProgressChangeRef.current = onProgressChange;

    const onAssemblyCompleteRef = useRef(onAssemblyComplete);
    onAssemblyCompleteRef.current = onAssemblyComplete;

    const onAssemblyStatusRef = useRef(onAssemblyStatus);
    onAssemblyStatusRef.current = onAssemblyStatus;

    const assemblyControllerRef = useRef<AssemblyController | null>(null);
    const pendingAssemblyStartRef = useRef<boolean>(false);
    const baseYCamRef = useRef<number>(0);
    const baseCameraDistRef = useRef<number>(3.95);

    // State refs for animation loops and programmatic controls
    const targetProgressRef = useRef<number>(transitionProgress ?? initialProgress);
    const currentProgressRef = useRef<number>(transitionProgress ?? initialProgress);

    const targetAssemblyProgressRef = useRef<number>(assemblyProgress ?? 0);
    const currentAssemblyProgressRef = useRef<number>(assemblyProgress ?? 0);

    const targetFromRotationYRef = useRef<number>(fromRotationY ?? rotationY ?? 0);
    const currentFromRotationYRef = useRef<number>(fromRotationY ?? rotationY ?? 0);
    const targetToRotationYRef = useRef<number>(toRotationY ?? rotationY ?? 0);
    const currentToRotationYRef = useRef<number>(toRotationY ?? rotationY ?? 0);

    const targetFromPositionXRef = useRef<number>(fromPositionX ?? positionX ?? 0);
    const currentFromPositionXRef = useRef<number>(fromPositionX ?? positionX ?? 0);
    const targetToPositionXRef = useRef<number>(toPositionX ?? positionX ?? 0);
    const currentToPositionXRef = useRef<number>(toPositionX ?? positionX ?? 0);

    const targetFromPositionYRef = useRef<number>(fromPositionY ?? positionY ?? 0);
    const currentFromPositionYRef = useRef<number>(fromPositionY ?? positionY ?? 0);
    const targetToPositionYRef = useRef<number>(toPositionY ?? positionY ?? 0);
    const currentToPositionYRef = useRef<number>(toPositionY ?? positionY ?? 0);

    const baseFromPosYRef = useRef<number>(fromModel.offsetY ?? 0);
    const baseToPosYRef = useRef<number>(toModel.offsetY ?? 0);

    // Three.js instances refs
    const fromGroupRef = useRef<THREE.Group | null>(null);
    const toGroupRef = useRef<THREE.Group | null>(null);

    const fromRendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const toRendererRef = useRef<THREE.WebGLRenderer | null>(null);

    const fromCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const toCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

    const updateFromBgPlaneRef = useRef<(() => void) | null>(null);
    const updateToBgPlaneRef = useRef<(() => void) | null>(null);

    // Programmatic animation state
    const tweenRef = useRef<{
      startTime: number;
      duration: number;
      startVal: number;
      targetVal: number;
      active: boolean;
    } | null>(null);

    // Sync external props with refs
    useEffect(() => {
      if (assemblyProgress !== undefined) {
        targetAssemblyProgressRef.current = Math.max(0, Math.min(1, assemblyProgress));
      }
    }, [assemblyProgress]);

    useEffect(() => {
      if (transitionProgress !== undefined) {
        targetProgressRef.current = Math.max(0, Math.min(1, transitionProgress));
      }
    }, [transitionProgress]);

    useEffect(() => {
      const fromY = fromRotationY ?? rotationY;
      if (fromY !== undefined) {
        targetFromRotationYRef.current = fromY;
      }
      const toY = toRotationY ?? rotationY;
      if (toY !== undefined) {
        targetToRotationYRef.current = toY;
      }
    }, [fromRotationY, toRotationY, rotationY]);

    useEffect(() => {
      const fromX = fromPositionX ?? positionX;
      if (fromX !== undefined) {
        targetFromPositionXRef.current = fromX;
      }
      const toX = toPositionX ?? positionX;
      if (toX !== undefined) {
        targetToPositionXRef.current = toX;
      }
    }, [fromPositionX, toPositionX, positionX]);

    useEffect(() => {
      const fromY = fromPositionY ?? positionY;
      if (fromY !== undefined) {
        targetFromPositionYRef.current = fromY;
      }
      const toY = toPositionY ?? positionY;
      if (toY !== undefined) {
        targetToPositionYRef.current = toY;
      }
    }, [fromPositionY, toPositionY, positionY]);

    // Imperative API implementation
    const transitionTo = useCallback((progress: number, durationMs = 800) => {
      const clamped = Math.max(0, Math.min(1, progress));
      if (durationMs <= 0) {
        targetProgressRef.current = clamped;
        currentProgressRef.current = clamped;
        return;
      }
      tweenRef.current = {
        startTime: performance.now(),
        duration: durationMs,
        startVal: currentProgressRef.current,
        targetVal: clamped,
        active: true
      };
    }, []);

    const toggle = useCallback((durationMs = 800) => {
      const nextTarget = currentProgressRef.current < 0.5 ? 1 : 0;
      transitionTo(nextTarget, durationMs);
    }, [transitionTo]);

    const setRotationY = useCallback((rad: number) => {
      targetFromRotationYRef.current = rad;
      currentFromRotationYRef.current = rad;
      targetToRotationYRef.current = rad;
      currentToRotationYRef.current = rad;
    }, []);

    const getProgress = useCallback(() => currentProgressRef.current, []);

    const setAssemblyProgress = useCallback((prog: number) => {
      targetAssemblyProgressRef.current = Math.max(0, Math.min(1, prog));
    }, []);

    const getAssemblyProgress = useCallback(() => currentAssemblyProgressRef.current, []);

    const setTransitionProgress = useCallback((prog: number) => {
      targetProgressRef.current = Math.max(0, Math.min(1, prog));
    }, []);

    const triggerAssembly = useCallback(() => {
      if (assemblyControllerRef.current) {
        assemblyControllerRef.current.start();
      } else {
        pendingAssemblyStartRef.current = true;
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        transitionTo,
        toggle,
        setRotationY,
        getProgress,
        triggerAssembly,
        setAssemblyProgress,
        getAssemblyProgress,
        setTransitionProgress
      }),
      [transitionTo, toggle, setRotationY, getProgress, triggerAssembly, setAssemblyProgress, getAssemblyProgress, setTransitionProgress]
    );

    // Stable configs
    const fromPath = fromModel.modelPath;
    const fromBgPath = fromModel.bgImagePath;
    const fromRotX = fromModel.rotationX;
    const fromTargetHeight = fromModel.targetHeight;
    const fromOffsetY = fromModel.offsetY;
    const toPath = toModel.modelPath;
    const toBgPath = toModel.bgImagePath;
    const toRotX = toModel.rotationX;
    const toTargetHeight = toModel.targetHeight;
    const toOffsetY = toModel.offsetY;

    // Setup Three.js scenes, models, and render loops
    useEffect(() => {
      const frontContainer = frontCanvasContainerRef.current;
      const backContainer = backCanvasContainerRef.current;
      const diagonalLine = diagonalLineRef.current;
      if (!frontContainer || !backContainer) return;

      let isMounted = true;
      let animationFrameId: number;

      const loader = new GLTFLoader();
      const textureLoader = new THREE.TextureLoader();

      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspect = width / height;
      const pixelRatio = Math.min(window.devicePixelRatio, 2);

      // ==========================================
      // 1. FRONT MODEL SCENE (fromModel)
      // ==========================================
      const fromScene = new THREE.Scene();
      const fromCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      fromCamera.position.set(0, 0.15, 3.95);
      fromCameraRef.current = fromCamera;

      const fromRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      fromRenderer.setPixelRatio(pixelRatio);
      fromRenderer.setSize(width, height);
      fromRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      fromRenderer.toneMappingExposure = 1.0;
      fromRenderer.outputColorSpace = THREE.SRGBColorSpace;
      frontContainer.appendChild(fromRenderer.domElement);
      fromRendererRef.current = fromRenderer;

      const pmremGen1 = new THREE.PMREMGenerator(fromRenderer);
      pmremGen1.compileEquirectangularShader();
      const roomEnv1 = new RoomEnvironment();
      fromScene.environment = pmremGen1.fromScene(roomEnv1, 0.04).texture;
      roomEnv1.dispose();


      // Lighting Rig 1
      const light1 = fromModel.lighting || {};
      const fromAmb = new THREE.AmbientLight(light1.ambientColor ?? 0xd5e6ff, light1.ambientIntensity ?? 0.8);
      fromScene.add(fromAmb);

      const fromKey = new THREE.DirectionalLight(light1.keyColor ?? 0xfff7e6, light1.keyIntensity ?? 1.8);
      fromKey.position.set(4, 6, 4);
      fromScene.add(fromKey);

      const fromRim = new THREE.DirectionalLight(light1.rimColor ?? 0x00f0ff, light1.rimIntensity ?? 1.5);
      fromRim.position.set(-4, 3, -4);
      fromScene.add(fromRim);

      const fromFill = new THREE.DirectionalLight(light1.fillColor ?? 0xff2244, light1.fillIntensity ?? 0.9);
      fromFill.position.set(-3, -2, 2);
      fromScene.add(fromFill);

      const fromTop = new THREE.SpotLight(light1.topColor ?? 0xffffff, light1.topIntensity ?? 0.8, 12, Math.PI / 4, 0.5);
      fromTop.position.set(0, 4, 1);
      fromScene.add(fromTop);

      const fromGroup = new THREE.Group();
      fromScene.add(fromGroup);
      fromGroupRef.current = fromGroup;

      // Background Plane 1
      let fromBgPlane: THREE.Mesh | null = null;
      if (fromBgPath) {
        const tex = textureLoader.load(fromBgPath);
        tex.colorSpace = THREE.SRGBColorSpace;
        const geo = new THREE.PlaneGeometry(24, 16);
        const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, toneMapped: false });
        fromBgPlane = new THREE.Mesh(geo, mat);
        fromBgPlane.position.set(0, 0, -1.5);
        fromScene.add(fromBgPlane);
      }

      const updateFromBgPlane = () => {
        if (!fromBgPlane) return;
        const dist = Math.abs(fromCamera.position.z - fromBgPlane.position.z);
        const vFov = (fromCamera.fov * Math.PI) / 180;
        const planeH = 2 * dist * Math.tan(vFov / 2);
        const planeW = planeH * fromCamera.aspect;
        fromBgPlane.scale.set((planeW * 1.6) / 24, (planeH * 1.6) / 16, 1);
      };
      updateFromBgPlaneRef.current = updateFromBgPlane;

      // ==========================================
      // 2. BACK MODEL SCENE (toModel)
      // ==========================================
      const toScene = new THREE.Scene();
      const toCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      toCamera.position.set(0, 0.15, 3.95);
      toCameraRef.current = toCamera;

      const toRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      toRenderer.setPixelRatio(pixelRatio);
      toRenderer.setSize(width, height);
      toRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      toRenderer.toneMappingExposure = 1.0;
      toRenderer.outputColorSpace = THREE.SRGBColorSpace;
      backContainer.appendChild(toRenderer.domElement);
      toRendererRef.current = toRenderer;

      const pmremGen2 = new THREE.PMREMGenerator(toRenderer);
      pmremGen2.compileEquirectangularShader();
      const roomEnv2 = new RoomEnvironment();
      toScene.environment = pmremGen2.fromScene(roomEnv2, 0.04).texture;
      roomEnv2.dispose();

      // Lighting Rig 2
      const light2 = toModel.lighting || {};
      const toAmb = new THREE.AmbientLight(light2.ambientColor ?? 0xd5e6ff, light2.ambientIntensity ?? 0.8);
      toScene.add(toAmb);

      const toKey = new THREE.DirectionalLight(light2.keyColor ?? 0xfff7e6, light2.keyIntensity ?? 1.8);
      toKey.position.set(4, 6, 4);
      toScene.add(toKey);

      const toRim = new THREE.DirectionalLight(light2.rimColor ?? 0xff2244, light2.rimIntensity ?? 1.5);
      toRim.position.set(-4, 3, -4);
      toScene.add(toRim);

      const toFill = new THREE.DirectionalLight(light2.fillColor ?? 0x00f0ff, light2.fillIntensity ?? 0.9);
      toFill.position.set(-3, -2, 2);
      toScene.add(toFill);

      const toTop = new THREE.SpotLight(light2.topColor ?? 0xffffff, light2.topIntensity ?? 0.8, 12, Math.PI / 4, 0.5);
      toTop.position.set(0, 4, 1);
      toScene.add(toTop);

      const toGroup = new THREE.Group();
      toScene.add(toGroup);
      toGroupRef.current = toGroup;

      // Background Plane 2
      let toBgPlane: THREE.Mesh | null = null;
      if (toBgPath) {
        const tex = textureLoader.load(toBgPath);
        tex.colorSpace = THREE.SRGBColorSpace;
        const geo = new THREE.PlaneGeometry(24, 16);
        const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, toneMapped: false });
        toBgPlane = new THREE.Mesh(geo, mat);
        toBgPlane.position.set(0, 0, -1.5);
        toScene.add(toBgPlane);
      }

      const updateToBgPlane = () => {
        if (!toBgPlane) return;
        const dist = Math.abs(toCamera.position.z - toBgPlane.position.z);
        const vFov = (toCamera.fov * Math.PI) / 180;
        const planeH = 2 * dist * Math.tan(vFov / 2);
        const planeW = planeH * toCamera.aspect;
        toBgPlane.scale.set((planeW * 1.6) / 24, (planeH * 1.6) / 16, 1);
      };
      updateToBgPlaneRef.current = updateToBgPlane;

      // ==========================================
      // LOAD MODELS
      // ==========================================
      loader.load(
        fromPath,
        (gltf) => {
          if (!isMounted) return;
          const model = gltf.scene;

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (fromModel.onMeshTraverse) {
                fromModel.onMeshTraverse(mesh);
              } else {
                const childName = (child.name || '').toLowerCase();
                if (
                  childName === 'base' ||
                  childName.includes('stand') ||
                  childName === 'supportrod' ||
                  childName.includes('servobracket') ||
                  childName.includes('servoarmpivot')
                ) {
                  child.visible = false;
                  return;
                }
                if (childName.includes('eyesemissive')) {
                  child.visible = false;
                }
                if (mesh.material) {
                  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  mats.forEach((mat) => {
                    const stdMat = mat as THREE.MeshStandardMaterial;
                    if (stdMat.roughness !== undefined) stdMat.roughness = Math.max(0.18, stdMat.roughness * 0.85);
                    if (stdMat.metalness !== undefined) stdMat.metalness = Math.min(0.95, Math.max(0.6, stdMat.metalness * 1.15));
                    const matName = (stdMat.name || '').toLowerCase();
                    if (matName.includes('eye') || matName.includes('lens')) {
                      stdMat.emissive = new THREE.Color(0x00e5ff);
                      if (!fromModel.assemblyAnimation) {
                        stdMat.emissiveIntensity = 3.5;
                      } else {
                        stdMat.emissiveIntensity = 0;
                      }
                    } else if (matName.includes('emissive')) {
                      stdMat.emissive = new THREE.Color(0x000000);
                      stdMat.emissiveIntensity = 0;
                    }
                  });
                }
              }
            }
          });

          if (fromRotX !== undefined) {
            model.rotation.x = fromRotX;
          }

          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          fromGroup.add(model);

          const size = box.getSize(new THREE.Vector3());
          const targetHeight = fromModel.targetHeight ?? 1.5;
          fromGroup.scale.setScalar(targetHeight / size.y);

          const finalBox = new THREE.Box3().setFromObject(fromGroup);
          const finalCenter = finalBox.getCenter(new THREE.Vector3());
          fromGroup.position.sub(finalCenter);
          if (fromModel.offsetY !== undefined) {
            fromGroup.position.y += fromModel.offsetY;
          }
          baseFromPosYRef.current = fromGroup.position.y;

          // Calibrate camera to frame mask prominently (~78% vertical coverage)
          const scaledSize = finalBox.getSize(new THREE.Vector3());
          const fovRad = (fromCamera.fov * Math.PI) / 180;
          const cameraDist = (scaledSize.y / 0.78) / (2 * Math.tan(fovRad / 2));
          const yCam = 0;
          baseYCamRef.current = yCam;
          baseCameraDistRef.current = cameraDist;

          fromCamera.position.set(0, yCam, cameraDist);
          fromCamera.lookAt(0, 0, 0);

          if (fromBgPlane) fromBgPlane.position.set(0, 0, -2);
          updateFromBgPlane();

          // Sync toCamera
          toCamera.position.copy(fromCamera.position);
          toCamera.lookAt(0, 0, 0);

          if (toBgPlane) toBgPlane.position.set(0, 0, -2);
          updateToBgPlane();

          // Initialize piece-by-piece suit-up assembly sequence
          if (fromModel.assemblyAnimation) {
            const controller = createAssemblySystem(model, () => {
              if (onAssemblyCompleteRef.current) {
                onAssemblyCompleteRef.current();
              }
            });
            assemblyControllerRef.current = controller;

            // Initialize at target progress
            controller.setProgress(
              currentAssemblyProgressRef.current,
              fromCamera,
              fromGroup,
              cameraDist,
              yCam
            );

            if (fromModel.autoStartAssembly || pendingAssemblyStartRef.current) {
              controller.start();
              pendingAssemblyStartRef.current = false;
            }
          }
        },
        undefined,
        (err) => console.error('Failed to load fromModel:', err)
      );

      loader.load(
        toPath,
        (gltf) => {
          if (!isMounted) return;
          const model = gltf.scene;

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (toModel.onMeshTraverse) {
                toModel.onMeshTraverse(mesh);
              } else if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((mat) => {
                  const stdMat = mat as THREE.MeshStandardMaterial;
                  if (stdMat.roughness !== undefined) stdMat.roughness = Math.max(0.15, stdMat.roughness * 0.85);
                  if (stdMat.metalness !== undefined) stdMat.metalness = Math.min(0.98, Math.max(0.7, stdMat.metalness * 1.2));
                });
              }
            }
          });

          if (toRotX !== undefined) {
            model.rotation.x = toRotX;
          }

          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);

          toGroup.add(model);

          const size = box.getSize(new THREE.Vector3());
          const targetHeight = toModel.targetHeight ?? 1.5;
          toGroup.scale.setScalar(targetHeight / size.y);

          const finalBox = new THREE.Box3().setFromObject(toGroup);
          const finalCenter = finalBox.getCenter(new THREE.Vector3());
          toGroup.position.sub(finalCenter);
          if (toModel.offsetY !== undefined) {
            toGroup.position.y += toModel.offsetY;
          }
          baseToPosYRef.current = toGroup.position.y;
        },
        undefined,
        (err) => {
          console.error('Failed to load toModel:', err);
          if (toModel.modelPath !== '/assets/marvel_ant-man_helmet.glb') {
            console.warn('Attempting fallback to /assets/marvel_ant-man_helmet.glb while starlord.glb is being placed');
            loader.load('/assets/marvel_ant-man_helmet.glb', (fallbackGltf) => {
              const model = fallbackGltf.scene;
              const box = new THREE.Box3().setFromObject(model);
              const center = box.getCenter(new THREE.Vector3());
              model.position.sub(center);
              toGroup.add(model);

              const size = box.getSize(new THREE.Vector3());
              const targetHeight = toModel.targetHeight ?? 1.5;
              toGroup.scale.setScalar(targetHeight / size.y);

              const finalBox = new THREE.Box3().setFromObject(toGroup);
              const finalCenter = finalBox.getCenter(new THREE.Vector3());
              toGroup.position.sub(finalCenter);
              if (toModel.offsetY !== undefined) {
                toGroup.position.y += toModel.offsetY;
              }
              baseToPosYRef.current = toGroup.position.y;
            });
          }
        }
      );

      // ==========================================
      // EVENT LISTENERS
      // ==========================================
      const handleResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const pr = Math.min(window.devicePixelRatio, 2);

        fromCamera.aspect = w / h;
        fromCamera.updateProjectionMatrix();
        fromRenderer.setSize(w, h);
        fromRenderer.setPixelRatio(pr);
        updateFromBgPlane();

        toCamera.aspect = w / h;
        toCamera.updateProjectionMatrix();
        toRenderer.setSize(w, h);
        toRenderer.setPixelRatio(pr);
        updateToBgPlane();
      };
      window.addEventListener('resize', handleResize);

      const handleWheel = (e: WheelEvent) => {
        if (!enableScroll) return;
        targetFromRotationYRef.current += e.deltaY * rotationSensitivity;
        targetToRotationYRef.current += e.deltaY * rotationSensitivity;
        targetProgressRef.current = Math.max(0, Math.min(1, targetProgressRef.current + e.deltaY * scrollSensitivity));
        if (tweenRef.current) tweenRef.current.active = false;
      };
      if (enableScroll) {
        window.addEventListener('wheel', handleWheel, { passive: true });
      }

      // Initial diagonal mask
      const initialPct = -10 + currentProgressRef.current * 120;
      frontContainer.style.webkitMaskImage = `linear-gradient(to top right, transparent 0%, transparent ${initialPct}%, #000 calc(${initialPct}% + 1.5px), #000 100%)`;
      frontContainer.style.maskImage = `linear-gradient(to top right, transparent 0%, transparent ${initialPct}%, #000 calc(${initialPct}% + 1.5px), #000 100%)`;

      // ==========================================
      // ANIMATION & RENDER LOOP
      // ==========================================
      const animate = (now: number) => {
        animationFrameId = requestAnimationFrame(animate);


        // Smooth tween for programmatic transition
        if (tweenRef.current && tweenRef.current.active) {
          const { startTime, duration, startVal, targetVal } = tweenRef.current;
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / duration);
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          currentProgressRef.current = startVal + (targetVal - startVal) * ease;
          targetProgressRef.current = currentProgressRef.current;
          if (t >= 1) tweenRef.current.active = false;
        } else {
          currentProgressRef.current += (targetProgressRef.current - currentProgressRef.current) * 0.1;
        }

        // Smooth assembly progress lerp
        currentAssemblyProgressRef.current += (targetAssemblyProgressRef.current - currentAssemblyProgressRef.current) * 0.12;

        currentFromRotationYRef.current += (targetFromRotationYRef.current - currentFromRotationYRef.current) * 0.09;
        currentToRotationYRef.current += (targetToRotationYRef.current - currentToRotationYRef.current) * 0.09;

        // Scrub assembly formation across 3D space
        if (assemblyControllerRef.current && fromGroupRef.current && fromCameraRef.current) {
          const res = assemblyControllerRef.current.setProgress(
            currentAssemblyProgressRef.current,
            fromCameraRef.current,
            fromGroupRef.current,
            baseCameraDistRef.current,
            baseYCamRef.current
          );

          if (onAssemblyStatusRef.current) {
            onAssemblyStatusRef.current(res);
          }
        }

        const currentProgress = currentProgressRef.current;
        currentFromPositionXRef.current += (targetFromPositionXRef.current - currentFromPositionXRef.current) * 0.12;
        currentToPositionXRef.current += (targetToPositionXRef.current - currentToPositionXRef.current) * 0.12;
        currentFromPositionYRef.current += (targetFromPositionYRef.current - currentFromPositionYRef.current) * 0.12;
        currentToPositionYRef.current += (targetToPositionYRef.current - currentToPositionYRef.current) * 0.12;

        const curFromPosX = currentFromPositionXRef.current;
        const curToPosX = currentToPositionXRef.current;
        const curFromPosY = currentFromPositionYRef.current;
        const curToPosY = currentToPositionYRef.current;
        const curFromRotY = currentFromRotationYRef.current;
        const curToRotY = currentToRotationYRef.current;

        // Apply group visibility, position X, Y, and Y-axis rotation independently
        if (fromGroupRef.current) {
          if (currentAssemblyProgressRef.current <= 0.001 || currentProgress >= 0.999) {
            fromGroupRef.current.visible = false;
          } else {
            fromGroupRef.current.visible = true;
            fromGroupRef.current.position.x = curFromPosX;
            fromGroupRef.current.position.y = baseFromPosYRef.current + curFromPosY;
            fromGroupRef.current.rotation.y = curFromRotY;
          }
        }
        if (toGroupRef.current) {
          if (currentProgress <= 0.001) {
            toGroupRef.current.visible = false;
          } else {
            toGroupRef.current.visible = true;
            toGroupRef.current.position.x = curToPosX;
            toGroupRef.current.position.y = baseToPosYRef.current + curToPosY;
            toGroupRef.current.rotation.y = curToRotY;
          }
        }

        if (onProgressChangeRef.current) {
          onProgressChangeRef.current(currentProgress);
        }

        // Continuous diagonal laser seam
        const pct = -10 + currentProgress * 120;
        const mask = `linear-gradient(to top right, transparent 0%, transparent ${pct}%, #000 calc(${pct}% + 1.5px), #000 100%)`;
        frontContainer.style.webkitMaskImage = mask;
        frontContainer.style.maskImage = mask;

        if (diagonalLine) {
          if (currentProgress > 0.01 && currentProgress < 0.99) {
            diagonalLine.style.opacity = '1';
            diagonalLine.style.background = `linear-gradient(to top right, transparent calc(${pct}% - 2.5px), rgba(0, 240, 255, 0.85) calc(${pct}% - 0.5px), #ffffff ${pct}%, rgba(255, 40, 70, 0.85) calc(${pct}% + 0.5px), transparent calc(${pct}% + 2.5px))`;
          } else {
            diagonalLine.style.opacity = '0';
          }
        }

        fromRenderer.render(fromScene, fromCamera);
        toRenderer.render(toScene, toCamera);
      };

      animationFrameId = requestAnimationFrame(animate);

      return () => {
        isMounted = false;
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        if (enableScroll) {
          window.removeEventListener('wheel', handleWheel);
        }

        fromRenderer.dispose();
        toRenderer.dispose();

        if (assemblyControllerRef.current) {
          assemblyControllerRef.current.dispose();
          assemblyControllerRef.current = null;
        }

        if (frontContainer.contains(fromRenderer.domElement)) {
          frontContainer.removeChild(fromRenderer.domElement);
        }
        if (backContainer.contains(toRenderer.domElement)) {
          backContainer.removeChild(toRenderer.domElement);
        }
      };
    }, [
      fromPath,
      fromBgPath,
      fromRotX,
      fromTargetHeight,
      fromOffsetY,
      toPath,
      toBgPath,
      toRotX,
      toTargetHeight,
      toOffsetY,
      enableScroll,
      scrollSensitivity,
      rotationSensitivity
    ]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          ...style
        }}
      >
        {/* Layer 1: Back Canvas */}
        <div
          ref={backCanvasContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />

        {/* Layer 2: Front Canvas with Diagonal Mask (Iron Man) */}
        <div
          ref={frontCanvasContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            pointerEvents: 'none',
            willChange: 'mask-image, -webkit-mask-image'
          }}
        />

        {/* Layer 3: Laser Energy Seam Divider Line */}
        <div
          ref={diagonalLineRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 3,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.15s ease'
          }}
        />
      </div>
    );
  }
);

Transition.displayName = 'Transition';
export default Transition;
