import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './lib/gsap';
import Transition, { ModelConfig, TransitionHandle } from './components/Transition';
import Navbar from './components/Navbar';
import AvengersIntro from './components/ui/AvengersIntro';
import AnantyaTimeline from './components/AnantyaTimeline';
import { GallerySection } from './components/GallerySection';
import ContactSection from './components/ContactSection';
import CountdownTimer from './components/CountdownTimer';
import ScrollGuidance from './components/ScrollGuidance';
import Footer from './components/Footer';
import './components/CyberHeroCard.css';

const ironManConfig: ModelConfig = {
  modelPath: '/assets/iron_man_detailed_web.glb',
  bgImagePath: '/assets/iron_man_hud_bg.jpg',
  rotationX: 0,
  targetHeight: 1.5,
  assemblyAnimation: true,
  autoStartAssembly: false, // Driven strictly by scroll
  lighting: {
    ambientColor: 0xffffff,
    ambientIntensity: 1.15,
    keyColor: 0xfff7e6,
    keyIntensity: 2.0,
    rimColor: 0x00f0ff,
    rimIntensity: 1.5,
    fillColor: 0xff4455,
    fillIntensity: 1.25,
    topColor: 0xffffff,
    topIntensity: 0.9,
  },
};

let cachedEyeGlowTexture: THREE.CanvasTexture | null = null;
function getEyeGlowTexture(): THREE.CanvasTexture {
  if (cachedEyeGlowTexture) return cachedEyeGlowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 60, 80, 1)');
    grad.addColorStop(0.25, 'rgba(255, 15, 35, 0.85)');
    grad.addColorStop(0.55, 'rgba(255, 0, 20, 0.35)');
    grad.addColorStop(0.8, 'rgba(220, 0, 20, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  cachedEyeGlowTexture = new THREE.CanvasTexture(canvas);
  cachedEyeGlowTexture.colorSpace = THREE.SRGBColorSpace;
  return cachedEyeGlowTexture;
}

const starLordConfig: ModelConfig = {
  modelPath: '/assets/starlord.glb',
  bgImagePath: '/assets/star_lord_bg.webp',
  targetHeight: 1.32,
  offsetY: -0.08,
  lighting: {
    ambientColor: 0xd5e6ff,
    ambientIntensity: 0.85,
    keyColor: 0xfff7e6,
    keyIntensity: 1.9,
    rimColor: 0xff1a35,
    rimIntensity: 1.8,
    fillColor: 0x00f0ff,
    fillIntensity: 0.9,
    topColor: 0xffffff,
    topIntensity: 0.8,
  },
  onMeshTraverse: (mesh: THREE.Mesh) => {
    const meshName = (mesh.name || '').toLowerCase();
    const isEyeMesh =
      meshName.includes('002_7') ||
      meshName.includes('002_8') ||
      meshName.includes('eye') ||
      meshName.includes('lens');

    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const stdMat = mat as THREE.MeshStandardMaterial;
        const matName = (stdMat.name || '').toLowerCase();
        const isEyeMat =
          isEyeMesh ||
          matName.includes('017') ||
          matName.includes('018') ||
          matName.includes('eye') ||
          matName.includes('lens');

        if (isEyeMat) {
          stdMat.color = new THREE.Color(0xff1122);
          stdMat.emissive = new THREE.Color(0xff0022);
          stdMat.emissiveIntensity = 8.0;
          stdMat.toneMapped = false;
          stdMat.roughness = 0.05;
          stdMat.metalness = 0.1;
        } else {
          if (stdMat.roughness !== undefined) stdMat.roughness = Math.max(0.15, stdMat.roughness * 0.85);
          if (stdMat.metalness !== undefined) stdMat.metalness = Math.min(0.98, Math.max(0.7, stdMat.metalness * 1.2));
        }
      });
    }

    // Confine red emission glow strictly to the eye lenses without casting light onto the face
    if (isEyeMesh && !mesh.getObjectByName('eyeGlow_' + mesh.name)) {
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox;
      const centerX = b ? (b.min.x + b.max.x) / 2 : 0;
      const centerY = b ? (b.min.y + b.max.y) / 2 : 0;
      const frontZ = b ? b.max.z + 1.0 : 108;

      // Additive optical glow flare sprite directly over the lens surface
      const glowMat = new THREE.SpriteMaterial({
        map: getEyeGlowTexture(),
        color: 0xff0033,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const glowSprite = new THREE.Sprite(glowMat);
      glowSprite.name = 'eyeGlow_' + mesh.name;
      glowSprite.scale.set(30, 30, 1);
      glowSprite.position.set(centerX, centerY, frontZ);
      mesh.add(glowSprite);
    }
  },
};


if (typeof window !== 'undefined') {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
}

export default function App() {
  const transitionRef = useRef<TransitionHandle>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [morphProgress, setMorphProgress] = useState(0);
  const [assemblyProgress, setAssemblyProgress] = useState(0);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [fromPositionX, setFromPositionX] = useState(0);
  const [toPositionX, setToPositionX] = useState(0);
  const [fromRotationY, setFromRotationY] = useState(0);
  const [toRotationY, setToRotationY] = useState(0);
  const [heroInfoOpacity, setHeroInfoOpacity] = useState(0);
  const [aboutInfoOpacity, setAboutInfoOpacity] = useState(0);
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [eventsTimelineProgress, setEventsTimelineProgress] = useState(0);
  const [activeAboutCard, setActiveAboutCard] = useState(0);
  const scrollSyncedAboutCardRef = useRef(0);
  const [activeNavSection, setActiveNavSection] = useState<'home' | 'about' | 'events' | 'gallery' | 'contact'>('home');
  const [gauntletClenchProgress, setGauntletClenchProgress] = useState(0);
  const [introFlightProgress, setIntroFlightProgress] = useState(0);

  // Direct DOM and Animation refs to eliminate 60fps React state re-render cascades
  const heroPanelRef = useRef<HTMLElement>(null);
  const aboutPanelRef = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const laserWipeLineRef = useRef<HTMLDivElement>(null);
  const activeNavSectionRef = useRef<'home' | 'about' | 'events' | 'gallery' | 'contact'>('home');
  const morphProgressRef = useRef<number>(0);
  const lastEventsProgressRef = useRef<number>(-999);
  const lastGauntletClenchRef = useRef<number>(-999);
  const lastIntroFlightRef = useRef<number>(-999);
  const eventsStRef = useRef<ScrollTrigger | null>(null);

  // High-performance DOM style synchronizers
  const updateHeroPanel = useCallback((opacity: number, navSec: string) => {
    if (!heroPanelRef.current) return;
    const isHidden = navSec !== 'home' || opacity <= 0.01;
    heroPanelRef.current.style.opacity = isHidden ? '0' : String(opacity);
    heroPanelRef.current.style.transform = `translateY(-50%) translateX(${(1 - opacity) * 35}px)`;
    heroPanelRef.current.style.pointerEvents = (isHidden || opacity <= 0.4) ? 'none' : 'auto';
    heroPanelRef.current.style.visibility = isHidden ? 'hidden' : 'visible';
  }, []);

  const updateAboutPanel = useCallback((opacity: number, navSec: string) => {
    if (!aboutPanelRef.current) return;
    const isHidden = navSec !== 'about' || opacity <= 0.01;
    aboutPanelRef.current.style.opacity = isHidden ? '0' : String(opacity);
    aboutPanelRef.current.style.transform = `translateY(-50%) translateX(${(1 - opacity) * -35}px)`;
    aboutPanelRef.current.style.pointerEvents = (isHidden || opacity <= 0.4) ? 'none' : 'auto';
    aboutPanelRef.current.style.visibility = isHidden ? 'hidden' : 'visible';
  }, []);

  const updateCanvasWrap = useCallback((opacity: number, zIdx: number, mask?: string) => {
    if (!canvasWrapRef.current) return;
    canvasWrapRef.current.style.opacity = String(opacity);
    canvasWrapRef.current.style.visibility = opacity <= 0.005 ? 'hidden' : 'visible';
    canvasWrapRef.current.style.zIndex = String(zIdx);
    if (mask !== undefined) {
      canvasWrapRef.current.style.webkitMaskImage = mask;
      canvasWrapRef.current.style.maskImage = mask;
    }
  }, []);

  const updateLaserWipeLine = useCallback((show: boolean, pct?: number) => {
    if (!laserWipeLineRef.current) return;
    if (!show || pct === undefined) {
      laserWipeLineRef.current.style.display = 'none';
      return;
    }
    laserWipeLineRef.current.style.display = 'block';
    laserWipeLineRef.current.style.background = `linear-gradient(to top right, transparent calc(${pct}% - 3.5px), rgba(255, 215, 0, 0.9) calc(${pct}% - 1px), #ffffff ${pct}%, rgba(168, 85, 247, 0.95) calc(${pct}% + 1px), transparent calc(${pct}% + 3.5px))`;
  }, []);

  const syncNavSection = useCallback((sec: 'home' | 'about' | 'events' | 'gallery' | 'contact') => {
    if (activeNavSectionRef.current !== sec) {
      activeNavSectionRef.current = sec;
      setActiveNavSection(sec);
    }
  }, []);

  const syncMorphProgress = useCallback((val: number) => {
    if (Math.abs(val - morphProgressRef.current) > 0.015 || (val === 1 && morphProgressRef.current !== 1) || (val === 0 && morphProgressRef.current !== 0)) {
      morphProgressRef.current = val;
      setMorphProgress(val);
    }
  }, []);

  // Lock document scroll while introduction is playing to prevent reload jumps or wheel scroll
  useEffect(() => {
    if (!hasEntered) {
      window.scrollTo(0, 0);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [hasEntered]);

  // Reset scroll on beforeunload so the browser always sees (0,0) as last known position
  useEffect(() => {
    const handleBeforeUnload = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Initialize Lenis Smooth Scroll once on mount
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 1.8,
    });

    lenisRef.current = lenis;

    // Immediately halt scroll and anchor to top
    lenis.scrollTo(0, { immediate: true });
    lenis.stop();

    lenis.on('scroll', ScrollTrigger.update);

    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(500, 33); // Smooth out frame drops rather than harsh stuttering jumps

    return () => {
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Handle Intro Completion: unlock scroll and smoothly start from top
  const handleEnter = useCallback(() => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
      lenisRef.current.start();
    }

    setHasEntered(true);

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
      }
      ScrollTrigger.clearScrollMemory?.('manual');
      ScrollTrigger.refresh();
    });
  }, []);

  // Configure ScrollTrigger â€” sequential phases:
  // Phase 1 (0.00 -> 0.12): Logo morphs to top Navigation Bar (Mask hidden).
  // Phase 2 (0.12 -> 0.32): Iron Man mask assembles; glides to left & looks right.
  // Phase 3 (0.32 -> 0.48): HOME PAGE HERO SECTION (Iron Man on left looking right, Info on right).
  // Phase 4 (0.48 -> 0.68): TRANSITION / WIPE: Home info fades out, diagonal wipe progresses, Star-Lord glides to right looking left.
  // Phase 5 (0.68 -> 0.90): ABOUT US SECTION (Star-Lord on right looking left, About Us info on left).
  // Phase 6 (0.90 -> 1.00): Settle / buffer.
  useEffect(() => {
    if (!hasEntered) return;

    window.scrollTo(0, 0);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
    ScrollTrigger.clearScrollMemory?.('manual');

    const track = document.getElementById('scroll-track');
    if (!track) return;
    const NAV_END = 0.12;  // navbar fully formed
    const IRON_END = 0.30;  // Iron Man fully assembled and in hero position on left
    const HOME_HOLD = 0.44;  // Home page hero section in full focus
    const CENTER_END = 0.50;  // Iron Man smoothly returns to center facing forward
    const WIPE_END = 0.66;  // Diagonal laser wipe in center: Iron Man -> Star-Lord with full 3D rotation
    const ABOUT_HOLD = 0.76;  // Star-Lord glides to right, turns left, About Us panel in full focus

    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.6,
      onLeave: () => {
        updateHeroPanel(0, 'events');
        updateAboutPanel(0, 'events');
        setHeroInfoOpacity(0);
        setAboutInfoOpacity(0);
      },
      onUpdate: (self) => {
        const p = self.progress; // 0.0 to 1.0
        const aboutCardProgress = THREE.MathUtils.clamp((p - 0.66) / 0.18, 0, 0.999);
        const scrollSyncedAboutCard = Math.min(2, Math.floor(aboutCardProgress * 3));
        if (scrollSyncedAboutCard !== scrollSyncedAboutCardRef.current) {
          scrollSyncedAboutCardRef.current = scrollSyncedAboutCard;
          setActiveAboutCard(scrollSyncedAboutCard);
        }

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const targetLeftX = isMobile ? 0 : -0.65;
        const targetRightX = isMobile ? 0 : 0.65;
        const targetRightRot = isMobile ? 0 : 0.38;   // looks towards the right
        const targetLeftRot = isMobile ? 0 : -0.38;   // looks towards the left

        if (p <= NAV_END) {
          // Phase 1 â€” Logo-to-Navbar Morph
          const navP = Math.min(1, p / NAV_END);
          syncMorphProgress(navP);
          transitionRef.current?.setAssemblyProgress(0);
          transitionRef.current?.setTransitionProgress(0);
          transitionRef.current?.setModelTransforms?.(0, 0, 0, 0);
          updateCanvasWrap(1, 1, '');
          updateHeroPanel(0, 'home');
          updateAboutPanel(0, 'home');
          syncNavSection('home');
        } else if (p <= IRON_END) {
          // Phase 2 — Iron Man Assembly & Glide to Left
          setMorphProgress(1);
          const maskP = (p - NAV_END) / (IRON_END - NAV_END);
          const clampedMaskP = Math.min(1, Math.max(0, maskP));
          transitionRef.current?.setAssemblyProgress(clampedMaskP);
          transitionRef.current?.setTransitionProgress(0);
          updateCanvasWrap(1, 1, '');
          updateAboutPanel(0, 'home');
          syncNavSection('home');

          if (clampedMaskP > 0.55) {
            const slideT = (clampedMaskP - 0.55) / 0.45;
            transitionRef.current?.setModelTransforms?.(targetLeftX * slideT, targetRightRot * slideT, 0, 0);
            updateHeroPanel(slideT, 'home');
          } else {
            transitionRef.current?.setModelTransforms?.(0, 0, 0, 0);
            updateHeroPanel(0, 'home');
          }
        } else if (p <= HOME_HOLD) {
          // Phase 3 — Home Page Hero Section in full focus (Iron Man on left looking right)
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(0);
          setCanvasOpacity(1);
          setFromPositionX(targetLeftX);
          setFromRotationY(targetRightRot);
          setToPositionX(0);
          setToRotationY(0);
          setHeroInfoOpacity(1);
          setAboutInfoOpacity(0);
          setActiveNavSection('home');
        } else if (p <= CENTER_END) {
          // Phase 4a — Re-center helmet to prepare for the seamless laser wipe
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(0);
          setCanvasOpacity(1);

          const centerT = (p - HOME_HOLD) / (CENTER_END - HOME_HOLD);
          transitionRef.current?.setModelTransforms?.(targetLeftX * (1 - centerT), targetRightRot * (1 - centerT), 0, 0);
          updateHeroPanel(Math.max(0, 1 - centerT * 2.2), 'home');
          updateAboutPanel(0, 'home');
          syncNavSection('home');
        } else if (p <= WIPE_END) {
          // Phase 4b — Seamless Diagonal Laser Seam Wipe in the CENTER (Exact smooth transition like before)
          setMorphProgress(1);
          setAssemblyProgress(1);
          setCanvasOpacity(1);
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);

          const wipeNorm = (p - CENTER_END) / (WIPE_END - CENTER_END);
          const wipeT = Math.min(1, Math.max(0, wipeNorm));
          transitionRef.current?.setTransitionProgress(wipeT);

          const sharedRotY = wipeT * Math.PI * 2;
          transitionRef.current?.setModelTransforms?.(0, sharedRotY, 0, sharedRotY);
          syncNavSection(wipeT >= 0.5 ? 'about' : 'home');
        } else if (p <= ABOUT_HOLD) {
          // Phase 4c — Wipe complete: Star-Lord glides to the right and turns left, About Us panel fades in
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(1);
          setCanvasOpacity(1);
          setHeroInfoOpacity(0);

          setFromPositionX(0);
          setFromRotationY(Math.PI * 2);

          const glideNorm = (p - WIPE_END) / (ABOUT_HOLD - WIPE_END);
          const glideT = Math.min(1, Math.max(0, glideNorm));
          const posEase = Math.sin((glideT * Math.PI) / 2);
          const rotEase = 1 - Math.pow(1 - glideT, 2.5);

          transitionRef.current?.setModelTransforms?.(0, Math.PI * 2, targetRightX * posEase, Math.PI * 2 + targetLeftRot * rotEase);
          updateAboutPanel(glideT, 'about');
          syncNavSection('about');
        } else if (p <= 0.84) {
          // Phase 5a — About Us Section in full focus (Star-Lord on right looking left, About panel on left)
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(1);
          setCanvasOpacity(1);
          setFromPositionX(0);
          setFromRotationY(Math.PI * 2);

          setToPositionX(targetRightX);
          setToRotationY(Math.PI * 2 + targetLeftRot);
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(1);
          setActiveNavSection('about');
        } else {
          // Phase 5b — Re-center Star-Lord helmet for transition into Thanos Infinity Gauntlet
          // As requested: "during end of about section bring starlord helmet at center of screen again for transition"
          const recenterNorm = (p - 0.84) / (1.0 - 0.84);
          const recenterT = Math.min(1, Math.max(0, recenterNorm));
          const easedRecenter = recenterT * recenterT * (3 - 2 * recenterT);

          syncMorphProgress(1);
          transitionRef.current?.setAssemblyProgress(1);
          transitionRef.current?.setTransitionProgress(1);
          updateCanvasWrap(1, p > 0.82 ? 42 : 1, '');
          transitionRef.current?.setModelTransforms?.(0, Math.PI * 2, targetRightX * (1 - easedRecenter), Math.PI * 2 + targetLeftRot * (1 - easedRecenter));
          updateHeroPanel(0, 'about');
          updateAboutPanel(Math.max(0, 1 - recenterT * 1.5), 'about');
          syncNavSection('about');
        }
      },
    });

    // Pinned ScrollTrigger for Events Section:
    const eventsEl = document.getElementById('events');
    let eventsSt: ScrollTrigger | null = null;
    if (eventsEl) {
      eventsSt = ScrollTrigger.create({
        trigger: eventsEl,
        start: 'top top',
        end: '+=9200',
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        onUpdate: (self) => {
          const p = self.progress; // 0.0 -> 1.0

          // Phase 0A: Diagonal Laser Wipe from Star-Lord to Open Gauntlet (0.00 -> 0.14)
          if (p <= 0.14) {
            const wipeT = p / 0.14;
            const wipePct = -10 + wipeT * 120;
            const wipeMask = wipeT < 0.999
              ? `linear-gradient(to top right, transparent 0%, transparent ${wipePct}%, #000 calc(${wipePct}% + 1.5px), #000 100%)`
              : 'none';
            updateCanvasWrap(wipeT >= 0.999 ? 0 : 1, 42, wipeMask);
            updateLaserWipeLine(wipeT > 0.001 && wipeT < 0.999, wipePct);
            if (lastGauntletClenchRef.current !== 0) { lastGauntletClenchRef.current = 0; setGauntletClenchProgress(0); }
            if (lastIntroFlightRef.current !== 0) { lastIntroFlightRef.current = 0; setIntroFlightProgress(0); }
            if (lastEventsProgressRef.current !== 0) { lastEventsProgressRef.current = 0; setEventsTimelineProgress(0); }
            syncNavSection('events');
          }
          // Phase 0B: Hand Clenches from Pinky to Thumb (0.14 -> 0.24)
          else if (p <= 0.24) {
            updateLaserWipeLine(false);
            updateCanvasWrap(0, 1);
            const clenchT = (p - 0.14) / (0.24 - 0.14);
            if (Math.abs(clenchT - lastGauntletClenchRef.current) > 0.015) {
              lastGauntletClenchRef.current = clenchT;
              setGauntletClenchProgress(clenchT);
            }
            if (lastIntroFlightRef.current !== 0) { lastIntroFlightRef.current = 0; setIntroFlightProgress(0); }
            if (lastEventsProgressRef.current !== 0) { lastEventsProgressRef.current = 0; setEventsTimelineProgress(0); }
            syncNavSection('events');
          }
          // Phase 0C: Stones burst out, fly above gauntlet into orbit (0.24 -> 0.36)
          else if (p <= 0.36) {
            updateLaserWipeLine(false);
            updateCanvasWrap(0, 1);
            const flightT = (p - 0.24) / (0.36 - 0.24);
            if (lastGauntletClenchRef.current !== 1) { lastGauntletClenchRef.current = 1; setGauntletClenchProgress(1); }
            if (Math.abs(flightT - lastIntroFlightRef.current) > 0.015) {
              lastIntroFlightRef.current = flightT;
              setIntroFlightProgress(flightT);
            }
            if (lastEventsProgressRef.current !== 0) { lastEventsProgressRef.current = 0; setEventsTimelineProgress(0); }
            syncNavSection('events');
          }
          // Phase 1: Events 1 to 8 Timeline in Orbit (0.36 -> 0.76)
          else if (p <= 0.76) {
            updateLaserWipeLine(false);
            updateCanvasWrap(0, 1);
            const timeT = (p - 0.36) / (0.76 - 0.36);
            const eventsProg = timeT * 7.0;
            if (lastGauntletClenchRef.current !== 1) { lastGauntletClenchRef.current = 1; setGauntletClenchProgress(1); }
            if (lastIntroFlightRef.current !== 1) { lastIntroFlightRef.current = 1; setIntroFlightProgress(1); }
            if (Math.abs(eventsProg - lastEventsProgressRef.current) > 0.02) {
              lastEventsProgressRef.current = eventsProg;
              setEventsTimelineProgress(eventsProg);
            }
            syncNavSection('events');
          }
          // Phase 2: Dedicated Hold on Event 8 (InnovateX) (0.76 -> 0.80)
          else if (p <= 0.80) {
            updateLaserWipeLine(false);
            updateCanvasWrap(0, 1);
            if (lastGauntletClenchRef.current !== 1) { lastGauntletClenchRef.current = 1; setGauntletClenchProgress(1); }
            if (lastIntroFlightRef.current !== 1) { lastIntroFlightRef.current = 1; setIntroFlightProgress(1); }
            if (Math.abs(7.15 - lastEventsProgressRef.current) > 0.01) {
              lastEventsProgressRef.current = 7.15;
              setEventsTimelineProgress(7.15);
            }
            syncNavSection('events');
          }
          // Phase 3: Post-Event 8: Stones Convergence onto Gauntlet (0.80 -> 0.90)
          else if (p <= 0.90) {
            updateLaserWipeLine(false);
            updateCanvasWrap(0, 1);
            const convT = (p - 0.80) / (0.90 - 0.80);
            const eventsProg = 7.25 + convT * 1.0;
            if (Math.abs(eventsProg - lastEventsProgressRef.current) > 0.02) {
              lastEventsProgressRef.current = eventsProg;
              setEventsTimelineProgress(eventsProg);
            }
            syncNavSection('events');
          }
          // Phase 4: Rotate Gauntlet and Laser Wipe into Loki Helmet (0.90 -> 1.00)
          else {
            updateLaserWipeLine(false);
            updateCanvasWrap(0, 1);
            const lokiT = (p - 0.90) / (1.00 - 0.90);
            const eventsProg = 8.25 + lokiT * 0.85;
            if (Math.abs(eventsProg - lastEventsProgressRef.current) > 0.02) {
              lastEventsProgressRef.current = eventsProg;
              setEventsTimelineProgress(eventsProg);
            }
            syncNavSection(lokiT >= 0.5 ? 'gallery' : 'events');
          }
        },
        onEnter: () => {
          syncNavSection('events');
          updateAboutPanel(0, 'events');
          updateHeroPanel(0, 'events');
        },
        onEnterBack: () => {
          syncNavSection('events');
          updateAboutPanel(0, 'events');
          updateHeroPanel(0, 'events');
        },
        onLeave: () => {
          updateAboutPanel(0, 'gallery');
          updateHeroPanel(0, 'gallery');
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
        },
        onLeaveBack: () => {
          syncNavSection('about');
          updateCanvasWrap(1, 1, '');
          updateAboutPanel(1, 'about');
          updateLaserWipeLine(false);
        },
      });
      eventsStRef.current = eventsSt;
    }

    // ScrollTrigger for Gallery Section:
    const galleryEl = document.getElementById('gallery');
    let gallerySt: ScrollTrigger | null = null;
    if (galleryEl) {
      gallerySt = ScrollTrigger.create({
        trigger: galleryEl,
        start: 'top bottom',
        end: 'top top',
        scrub: true,
        onUpdate: (self) => {
          if (self.progress > 0.4) {
            syncNavSection('gallery');
          }
        },
        onEnter: () => {
          syncNavSection('gallery');
          updateAboutPanel(0, 'gallery');
          updateHeroPanel(0, 'gallery');
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
        },
        onEnterBack: () => {
          syncNavSection('gallery');
          updateAboutPanel(0, 'gallery');
          updateHeroPanel(0, 'gallery');
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
        },
        onLeave: () => {
          updateAboutPanel(0, 'contact');
          updateHeroPanel(0, 'contact');
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
        },
        onLeaveBack: () => {
          syncNavSection('gallery');
        },
      });
    }

    // ScrollTrigger for Contact Section:
    const contactEl = document.getElementById('contact');
    let contactSt: ScrollTrigger | null = null;
    if (contactEl) {
      contactSt = ScrollTrigger.create({
        trigger: contactEl,
        start: 'top 60%',
        end: 'bottom bottom',
        onEnter: () => {
          syncNavSection('contact');
          updateAboutPanel(0, 'contact');
          updateHeroPanel(0, 'contact');
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
        },
        onEnterBack: () => {
          syncNavSection('contact');
          updateAboutPanel(0, 'contact');
          updateHeroPanel(0, 'contact');
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
        },
      });
    }

    return () => {
      st.kill();
      if (eventsSt) eventsSt.kill();
      if (gallerySt) gallerySt.kill();
      if (contactSt) contactSt.kill();
      eventsStRef.current = null;
    };
  }, [hasEntered, syncMorphProgress, syncNavSection, updateAboutPanel, updateCanvasWrap, updateHeroPanel, updateLaserWipeLine]);

  // Handler to smoothly scroll to any specific stone in the pinned timeline
  const handleSelectStone = useCallback((index: number) => {
    if (!eventsStRef.current) return;
    const targetNorm = 0.36 + (index / 7.0) * 0.40; // 8 stones span 0.36 to 0.76 of the pinned scrub track
    const targetScrollY = eventsStRef.current.start + targetNorm * (eventsStRef.current.end - eventsStRef.current.start);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetScrollY, {
        duration: 1.4,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    }
  }, []);

  // Smooth programmatic scroll navigation when clicking Navbar links or buttons
  const handleNavSelect = useCallback((id: string) => {
    if (id === 'events') {
      const eventsEl = document.getElementById('events');
      if (eventsEl) {
        // Immediately dismiss Home/About panels and canvas
        updateAboutPanel(0, 'events');
        updateHeroPanel(0, 'events');
        syncNavSection('events');
        updateCanvasWrap(0, 1);

        // Scroll slightly into the pinned timeline track (+25px) to guarantee #events is firmly pinned and active
        const targetY = (eventsStRef.current ? eventsStRef.current.start : eventsEl.offsetTop) + 25;
        if (lenisRef.current) {
          lenisRef.current.scrollTo(targetY, {
            duration: 1.4,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        } else {
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
      }
      return;
    }

    if (id === 'gallery') {
      const galleryEl = document.getElementById('gallery');
      if (galleryEl) {
        updateAboutPanel(0, 'gallery');
        updateHeroPanel(0, 'gallery');
        syncNavSection('gallery');
        updateCanvasWrap(0, 1);
        setHeroInfoOpacity(0);
        setAboutInfoOpacity(0);
        if (lenisRef.current) {
          lenisRef.current.scrollTo(galleryEl, {
            duration: 1.8,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        } else {
          galleryEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    if (id === 'contact') {
      const contactEl = document.getElementById('contact');
      if (contactEl) {
        updateAboutPanel(0, 'contact');
        updateHeroPanel(0, 'contact');
        syncNavSection('contact');
        updateCanvasWrap(0, 1);
        setHeroInfoOpacity(0);
        setAboutInfoOpacity(0);
        if (lenisRef.current) {
          lenisRef.current.scrollTo(contactEl, {
            duration: 1.8,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          });
        } else {
          contactEl.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    const track = document.getElementById('scroll-track');
    if (!track) return;
    const trackScrollDistance = track.offsetHeight;
    if (trackScrollDistance <= 0) return;

    let targetProgress = 0.36; // Default to Home section (Iron Man hero stance on left, Info on right)
    if (id === 'home') {
      targetProgress = 0.36;
      updateCanvasWrap(1, 1);
    } else if (id === 'about') {
      targetProgress = 0.82; // About Us section (Star-Lord hero stance on right, Info on left)
      updateCanvasWrap(1, 1);
    }

    const targetScrollY = targetProgress * trackScrollDistance;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetScrollY, {
        duration: 1.6,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    }
  }, []);

  const goToAboutCard = (index: number) => {
    setActiveAboutCard(Math.max(0, Math.min(2, index)));
  };

  return (
    <main className="app-main-root">
      {/* Cinematic Logo Introduction */}
      {!hasEntered && <AvengersIntro onComplete={handleEnter} />}

      {/* Floating Navigation Bar with Scroll Morphing Animation */}
      <Navbar
        logoSrc="/assets/ANANTYA.png"
        activeId={activeNavSection}
        onSelect={handleNavSelect}
        morphProgress={morphProgress}
      />

      {/* Fixed 3D Canvas */}
      <div
        ref={canvasWrapRef}
        className="fixed-3d-canvas-wrap"
        style={{
          opacity: canvasOpacity,
          pointerEvents: 'none',
          visibility: 'visible',
          zIndex: 1,
          willChange: 'opacity',
        }}
      >
        <Transition
          ref={transitionRef}
          fromModel={ironManConfig}
          toModel={starLordConfig}
          assemblyProgress={assemblyProgress}
          transitionProgress={transitionProgress}
          fromPositionX={fromPositionX}
          toPositionX={toPositionX}
          fromRotationY={fromRotationY}
          toRotationY={toRotationY}
          enableScroll={false}
        />
      </div>

      {/* Diagonal laser seam controlled by the pinned events timeline */}
      <div
        ref={laserWipeLineRef}
        className="gauntlet-laser-wipe-line"
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 44,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 16px rgba(255, 215, 0, 0.85)) drop-shadow(0 0 32px rgba(168, 85, 247, 0.65))',
        }}
      />

      {/* Home Page Hero Info Panel (Right Side: high-tech Stark HUD cyber frame) */}
      <section
        id="home"
        ref={heroPanelRef}
        className="home-hero-panel cyber-hud-card"
        style={{
          opacity: activeNavSection !== 'home' ? 0 : heroInfoOpacity,
          transform: `translateY(-50%) translateX(${(1 - heroInfoOpacity) * 35}px)`,
          pointerEvents: (activeNavSection !== 'home' || heroInfoOpacity <= 0.4) ? 'none' : 'auto',
          visibility: (activeNavSection !== 'home' || heroInfoOpacity <= 0.01) ? 'hidden' : 'visible',
        }}
      >
        {/* Geometric Clipped Background Plate */}
        <div className="cyber-bg-plate" aria-hidden="true" />

        {/* Cybernetic Frame Armor Overlays & SVG HUD Accents */}
        <div className="cyber-frame-armor" aria-hidden="true">
          <svg className="cyber-frame-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cyberBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#00e5ff" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>

            {/* Outer Glowing Cyber Perimeter */}
            <path
              className="cyber-svg-outer-path"
              d="M 6.5,0.6 
                 L 41,0.6 L 43.5,2.4 L 56.5,2.4 L 59,0.6 L 93.5,0.6 
                 L 99.4,6.5 
                 L 99.4,43.5 L 97.9,45.5 L 97.9,54.5 L 99.4,56.5 L 99.4,93.5 
                 L 93.5,99.4 
                 L 59,99.4 L 56.5,97.6 L 43.5,97.6 L 41,99.4 L 6.5,99.4 
                 L 0.6,93.5 
                 L 0.6,56.5 L 2.1,54.5 L 2.1,45.5 L 0.6,43.5 L 0.6,6.5 
                 Z"
              vectorEffect="non-scaling-stroke"
            />

            {/* Inner Keyline Frame */}
            <path
              className="cyber-svg-inner-path"
              d="M 8.5,3.2 
                 L 91.5,3.2 
                 L 96.8,8.5 
                 L 96.8,91.5 
                 L 91.5,96.8 
                 L 8.5,96.8 
                 L 3.2,91.5 
                 L 3.2,8.5 
                 Z"
              vectorEffect="non-scaling-stroke"
            />

            {/* Corner Hardware Brackets */}
            <path className="cyber-bracket" d="M 2.4,12 L 2.4,6.5 L 6.5,2.4 L 12,2.4" vectorEffect="non-scaling-stroke" />
            <path className="cyber-bracket" d="M 88,2.4 L 93.5,2.4 L 97.6,6.5 L 97.6,12" vectorEffect="non-scaling-stroke" />
            <path className="cyber-bracket" d="M 2.4,88 L 2.4,93.5 L 6.5,97.6 L 12,97.6" vectorEffect="non-scaling-stroke" />
            <path className="cyber-bracket" d="M 88,97.6 L 93.5,97.6 L 97.6,93.5 L 97.6,88" vectorEffect="non-scaling-stroke" />

            {/* Side Vent Lines (Left) */}
            <line className="cyber-vent-line" x1="1.4" y1="47" x2="1.4" y2="49" vectorEffect="non-scaling-stroke" />
            <line className="cyber-vent-line" x1="1.4" y1="50" x2="1.4" y2="52" vectorEffect="non-scaling-stroke" />
            <line className="cyber-vent-line" x1="1.4" y1="53" x2="1.4" y2="55" vectorEffect="non-scaling-stroke" />

            {/* Side Vent Lines (Right) */}
            <line className="cyber-vent-line" x1="98.6" y1="47" x2="98.6" y2="49" vectorEffect="non-scaling-stroke" />
            <line className="cyber-vent-line" x1="98.6" y1="50" x2="98.6" y2="52" vectorEffect="non-scaling-stroke" />
            <line className="cyber-vent-line" x1="98.6" y1="53" x2="98.6" y2="55" vectorEffect="non-scaling-stroke" />

            {/* Top Center Rail */}
            <line className="cyber-notch-accent" x1="46" y1="1.6" x2="54" y2="1.6" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="cyber-grid-overlay" />
          <div className="cyber-corner-glow tl" />
          <div className="cyber-corner-glow tr" />
          <div className="cyber-corner-glow bl" />
          <div className="cyber-corner-glow br" />
        </div>

        {/* Card Main Body Content */}
        <div className="cyber-card-content">
          <h1 className="hero-main-title">
            ANANTYA <span className="hero-title-year">2026</span>
          </h1>

          <CountdownTimer />

          {/* Quick Highlights / Stats Capsule Container */}
          <div className="hero-stats-capsule">
            <div className="stat-capsule-item">
              <span className="stat-val">08+</span>
              <span className="stat-label">Club Arenas</span>
            </div>
            <div className="stat-capsule-divider" />
            <div className="stat-capsule-item">
              <span className="stat-val">02</span>
              <span className="stat-label">Epic Days</span>
            </div>
            <div className="stat-capsule-divider" />
            <div className="stat-capsule-item">
              <span className="stat-val">₹2L+</span>
              <span className="stat-label">Prize Pool</span>
            </div>
          </div>

          {/* Action Button Row */}
          <div className="hero-btn-row">
            <a
              href="#events"
              className="hero-btn cyber-primary-btn"
              onClick={(e) => {
                e.preventDefault();
                handleNavSelect('events');
              }}
            >
              <span>EXPLORE EVENTS</span>
              <span className="btn-arrow-circle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* About Us Info Panel (Left Side: displays About information while helmet gazes from the right) */}
      <section
        id="about"
        ref={aboutPanelRef}
        className="about-info-panel"
        style={{
          opacity: activeNavSection !== 'about' ? 0 : aboutInfoOpacity,
          transform: `translateY(-50%) translateX(${(1 - aboutInfoOpacity) * -35}px)`,
          pointerEvents: (activeNavSection !== 'about' || aboutInfoOpacity <= 0.4) ? 'none' : 'auto',
          visibility: (activeNavSection !== 'about' || aboutInfoOpacity <= 0.01) ? 'hidden' : 'visible',
        }}
      >
        <div className="about-panel-header">
          <div className="about-panel-emblem">
            <span className="about-panel-emblem-core" />
          </div>
          <span className="about-panel-brand">ANANTYA 2026</span>
          <span className="about-panel-status">
            <span className="about-panel-status-dot" />
            MISSION ACTIVE
          </span>
        </div>
        <div className="about-horizontal-viewport">
          <div
            className="about-horizontal-track"
            style={{ transform: `translateX(-${activeAboutCard * 33.333333}%)` }}
          >
            <article className="about-story-card about-intro-card">
              <div className="about-cyber-badge">
                <span className="about-pulse-dot" />
                <span className="about-badge-text">ORIGIN ARCHIVE • ABOUT ANANTYA</span>
              </div>
              <h2 className="about-main-title">ANANTYA</h2>
              <blockquote className="about-story-quote">
                "A chronicle of innovation, forged in the fires of intellect and tempered by time."
              </blockquote>
              <div className="about-intro-copy">
                <p>Anantya was founded at Pimpri Chinchwad College of Engineering to bridge academic learning with real-world technical innovation. What began as a local gathering has grown into a grand convergence of minds, where creativity and technology drive progress.</p>
              </div>
            </article>
            <article className="about-story-card">
              <div className="about-section-label">THE FOUNDATIONS OF OUR REALM</div>
              <h2 className="about-section-title">THE FOUR PILLARS</h2>
              <div className="about-pillar-grid">
                <div className="about-pillar-card">

                  <h3>INNOVATION</h3>
                  <p>Forging new paths where ideas become reality.</p>
                </div>
                <div className="about-pillar-card">
                  
                  <h3>TECHNOLOGY</h3>
                  <p>The steel of our realm, tempered through logic and code.</p>
                </div>
                <div className="about-pillar-card">
                  
                  <h3>CREATIVITY</h3>
                  <p>The magic that breathes life into machines and screens.</p>
                </div>
                <div className="about-pillar-card">
                 
                  <h3>COMMUNITY</h3>
                  <p>The banners under which we unite, stronger together.</p>
                </div>
              </div>
            </article>



            <article className="about-story-card about-finale-card">
              <div className="about-section-label">THE NEXT CHAPTER IS YOURS</div>
              <h2 className="about-finale-title">WRITE YOUR CHAPTER</h2>
              <blockquote className="about-story-quote">
                "The future is not written in the stars, but in the code we forge and the dreams we dare to build."
              </blockquote>
              <a
                href="#events"
                className="hero-btn primary-btn about-primary-btn"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavSelect('events');
                }}
              >
                <span>BECOME PART OF THE UNIVERSE</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </a>
            </article>
          </div>
        </div>
        {/* Dedicated Card Footer Navigation (Positioned cleanly at bottom of card) */}
        <div className="about-panel-footer">
          <div className="about-card-indicator" role="group" aria-label={`About story card ${activeAboutCard + 1} of 3`}>
            {[0, 1, 2].map((cardIndex) => (
              <button
                key={cardIndex}
                type="button"
                className={cardIndex === activeAboutCard ? 'about-card-indicator-item is-active' : 'about-card-indicator-item'}
                onClick={() => goToAboutCard(cardIndex)}
                aria-label={`Go to slide ${cardIndex + 1}`}
              />
            ))}
          </div>

          <div className="about-card-navigation">
            <span className="about-nav-counter">{activeAboutCard + 1} / 3</span>
            <button
              type="button"
              className="about-arrow-btn"
              onClick={() => goToAboutCard(activeAboutCard - 1)}
              disabled={activeAboutCard === 0}
              aria-label="Previous About card"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="about-arrow-btn"
              onClick={() => goToAboutCard(activeAboutCard + 1)}
              disabled={activeAboutCard === 2}
              aria-label="Next About card"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Persistent Throughout-the-Site Scroll Guidance & HUD Wayfinder */}
      <ScrollGuidance
        activeSection={activeNavSection}
        onNavigate={handleNavSelect}
      />

      {/* Scroll track providing smooth scrolling space across Home & About sections */}
      <div id="scroll-track" className="scroll-track-container" />

      {/* Events 3D Orbit Timeline Section (Pinned via ScrollTrigger for full-screen immersion) */}
      <section id="events" className="events-timeline-section">
        <AnantyaTimeline
          timelineProgress={eventsTimelineProgress}
          onSelectStone={handleSelectStone}
          gauntletClenchProgress={gauntletClenchProgress}
          introFlightProgress={introFlightProgress}
        />
      </section>

      {/* Gallery Section: Chronicles of Glory (Multiverse Quantum Archives) */}
      <section id="gallery" className="gallery-main-section">
        <GallerySection />
      </section>

      {/* Contact Section: S.H.I.E.L.D. Quantum Comm-Link & Avengers Initiative */}
      <ContactSection onNavigate={handleNavSelect} />

      {/* Cybernetic Marvel Horizon Footer */}
      <Footer onNavigate={handleNavSelect} />

      <style>{`
        .app-main-root {
          width: 100%;
          min-height: 100vh;
          position: relative;
          background: transparent;
        }

        .events-timeline-section {
          position: relative;
          width: 100%;
          height: 100vh;
          z-index: 40;
          background-color: #040711;
          box-shadow: 0 -30px 80px rgba(0, 0, 0, 0.95);
        }

        .gallery-main-section {
          position: relative;
          width: 100%;
          min-height: 100vh;
          z-index: 45;
          background: #040711;
          padding: 6rem 1.5rem 8rem;
          box-shadow: 0 -30px 80px rgba(0, 0, 0, 0.95);
        }

        .fixed-3d-canvas-wrap {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          z-index: 1;
          pointer-events: none;
        }

        /* 600vh: navbar morph â†’ Iron Man hero â†’ diagonal wipe â†’ Star-Lord About */
        .scroll-track-container {
          width: 100%;
          height: 600vh;
          position: relative;
          pointer-events: none;
        }




        /* Bottom Scroll Indicator */
        .bottom-scroll-prompt {
          position: fixed;
          bottom: 2.5rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          z-index: 50;
          user-select: none;
          transition: opacity 0.25s ease;
        }

        .scroll-prompt-text {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.25em;
          color: #94a3b8;
          text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
        }

        .scroll-prompt-mouse {
          width: 22px;
          height: 34px;
          border: 2px solid rgba(56, 189, 248, 0.6);
          border-radius: 12px;
          display: flex;
          justify-content: center;
          padding-top: 5px;
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.25);
        }

        .scroll-prompt-dot {
          width: 3px;
          height: 7px;
          background: #38bdf8;
          border-radius: 2px;
          animation: promptScroll 1.6s ease-in-out infinite;
        }

        @keyframes promptScroll {
          0% { transform: translateY(0); opacity: 1; }
          60% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 0; }
        }

        .scroll-prompt-arrow {
          color: #38bdf8;
          animation: arrowBounce 1.6s ease-in-out infinite;
        }

        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(4px); }
        }

        /* Home Hero Info Panel (Right Side, faced by Iron Man) */
        .home-hero-panel {
          position: fixed;
          top: 50%;
          right: 6%;
          max-width: 520px;
          z-index: 30;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.15rem;
          will-change: transform, opacity;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          background: radial-gradient(130% 100% at 0% 0%, rgba(15, 23, 42, 0.75) 0%, rgba(8, 14, 26, 0.65) 100%);
          border: 1px solid rgba(56, 189, 248, 0.25);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 35px rgba(56, 189, 248, 0.15);
          border-radius: 18px;
          padding: 2.2rem 2.4rem;
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
        }

        .hero-cyber-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.35rem 0.85rem;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.35);
          border-radius: 9999px;
        }

        .hero-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 10px #38bdf8;
          animation: badgePulse 2s infinite ease-in-out;
        }

        @keyframes badgePulse {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .hero-badge-text {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: #7dd3fc;
          text-transform: uppercase;
        }

        .hero-main-title {
          font-size: clamp(2.4rem, 4vw, 3.5rem);
          font-weight: 900;
          letter-spacing: 0.12em;
          color: #ffffff;
          line-height: 1.05;
          margin: 0;
          text-shadow: none;
        }

        .hero-title-year {
          color: #ff7700;
          background: none;
          -webkit-text-fill-color: #ff7700;
          filter: none;
        }

        .hero-tagline-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #cbd5e1;
        }

        .tagline-gem {
          width: 8px;
          height: 8px;
          transform: rotate(45deg);
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          box-shadow: 0 0 10px #06b6d4;
        }

        .hero-description {
          font-size: 0.94rem;
          line-height: 1.6;
          color: #94a3b8;
          margin: 0;
        }

        .hero-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.85rem;
          width: 100%;
          margin-top: 0.25rem;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.75rem 0.9rem;
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
        }

        .stat-val {
          font-size: 1.35rem;
          font-weight: 800;
          color: #f8fafc;
          letter-spacing: -0.02em;
          text-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
        }

        .stat-label {
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .hero-btn-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 100%;
          margin-top: 0.4rem;
        }

        .hero-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.45rem;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-decoration: none;
          transition: all 0.22s ease;
          cursor: pointer;
        }

        .primary-btn {
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          border: 1px solid rgba(56, 189, 248, 0.6);
          box-shadow: 0 4px 18px rgba(2, 132, 199, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(2, 132, 199, 0.55);
          border-color: #38bdf8;
        }

        .secondary-btn {
          background: rgba(15, 23, 42, 0.6);
          color: #e2e8f0;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .secondary-btn:hover {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(56, 189, 248, 0.5);
          color: #ffffff;
          transform: translateY(-2px);
        }

        /* About Us Info Panel (Left Side, faced by Ant-Man from right) */
        .about-info-panel {
          --about-accent: #ff6b8f;
          --about-accent-strong: #d93d6d;
          --about-accent-soft: #ffb3c8;
          --about-accent-glow: rgba(255, 107, 143, 0.28);

          position: fixed;
          top: 50%;
          left: 6%;
          width: min(520px, 44vw);
          max-width: 520px;
          height: min(650px, calc(100vh - 220px));
          box-sizing: border-box;
          overflow: hidden;
          z-index: 50;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.15rem;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          background: radial-gradient(130% 100% at 100% 0%, rgba(14, 27, 52, 0.82) 0%, rgba(8, 14, 26, 0.72) 100%);
          border: 2px solid rgba(59, 130, 246, 0.85);
          box-shadow: 0 0 0 1px rgba(255, 106, 148, 0.65), 0 0 30px rgba(59, 130, 246, 0.22), 0 0 40px rgba(255, 106, 148, 0.18), 0 20px 50px rgba(0, 0, 0, 0.65);
          border-radius: 18px;
          padding: 1rem 1.15rem 1.2rem;
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
        }

        .about-panel-header {
          display: grid;
          grid-template-columns: 52px 1fr auto;
          align-items: center;
          gap: 0.65rem;
          min-height: 46px;
          padding: 0.1rem 0.2rem 0.25rem;
          border-bottom: 1px solid rgba(59, 130, 246, 0.4);
        }

        .about-panel-emblem {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 2px solid rgba(255, 255, 255, 0.7);
          background: rgba(11, 20, 38, 0.9);
          box-shadow: inset 0 0 18px rgba(255, 255, 255, 0.08), 0 0 18px rgba(59, 130, 246, 0.26);
        }

        .about-panel-emblem-core {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: block;
          background: linear-gradient(135deg, #f5f8ff, #dbeafe);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
        }

        .about-panel-brand,
        .about-panel-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .about-panel-brand {
          color: rgba(226, 232, 240, 0.9);
          justify-self: center;
          font-size: 1.05rem;
          letter-spacing: 0.12em;
        }

        .about-panel-status {
          gap: 0.5rem;
          white-space: nowrap;
          color: #f7d9e4;
          justify-self: end;
        }

        .about-panel-status-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--about-accent);
          box-shadow: 0 0 12px rgba(255, 107, 143, 0.8);
        }

        .about-horizontal-viewport {
          position: relative;
          width: 100%;
          height: 100%;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          overflow-x: hidden;
          overflow-y: hidden;
        }

        .about-horizontal-track {
          display: flex;
          width: 300%;
          height: 100%;
          transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }

        .about-story-card {
          flex: 0 0 33.333333%;
          width: 33.333333%;
          min-width: 0;
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          padding: 14px 18px 10px;
        }

        .about-intro-card {
          gap: 8px;
        }

        .about-cyber-badge {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          gap: 0.6rem;
          padding: 0.35rem 0.85rem;
          background: rgba(255, 107, 143, 0.08);
          border: 1px solid rgba(255, 107, 143, 0.3);
          border-radius: 9999px;
        }

        .about-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--about-accent);
          box-shadow: 0 0 10px var(--about-accent);
          animation: badgePulse 2s infinite ease-in-out;
        }

        .about-badge-text {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: #ffe2eb;
          text-transform: uppercase;
        }

        .about-main-title,
        .about-finale-title {
          font-size: clamp(42px, 3.8vw, 76px);
          font-weight: 900;
          color: #ffffff;
          line-height: 0.9;
          margin: 0;
          letter-spacing: -0.08em;
          text-transform: uppercase;
          text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 107, 143, 0.25);
        }

        .about-story-quote {
          margin: 0;
          padding-left: 0.9rem;
          border-left: 2px solid var(--about-accent);
          color: #fff0f5;
          font-size: clamp(16px, 1.2vw, 20px);
          line-height: 1.45;
          font-weight: 500;
          font-style: italic;
        }

        .about-intro-copy,
        .about-legacy-copy {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .about-intro-copy p,
        .about-legacy-copy p {
          margin: 0;
          color: #edf3ff;
          font-size: clamp(14px, 0.95vw, 16px);
          line-height: 1.55;
        }

        .about-section-label {
          color: #ffbfd0;
          font-size: 11px;
          letter-spacing: 0.18em;
          font-weight: 800;
        }

        .about-section-title {
          margin: 0;
          color: #fff;
          font-size: clamp(26px, 2.4vw, 56px);
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: -0.05em;
          text-transform: uppercase;
        }

        .about-chapter-grid,
        .about-pillar-grid {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .about-chapter-card,
        .about-pillar-card {
          min-width: 0;
          min-height: 0;
          padding: 14px 14px 12px;
          border: 1px solid rgba(255, 108, 161, 0.58);
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(20, 25, 35, 0.82), rgba(8, 12, 20, 0.72));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(255, 108, 161, 0.18), 0 0 18px rgba(255, 108, 161, 0.08);
        }

        .about-chapter-meta {
          display: flex;
          justify-content: space-between;
          gap: 0.3rem;
          color: var(--about-accent);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .about-chapter-meta span:last-child {
          color: #94a3b8;
          font-size: 12px;
        }

        .about-chapter-card h3,
        .about-pillar-card h3 {
          margin: 0.4rem 0 0.3rem;
          color: #fff;
          font-size: 16px;
          line-height: 1.2;
          font-weight: 800;
        }

        .about-chapter-card p,
        .about-pillar-card p {
          margin: 0;
          color: #ebf2ff;
          font-size: 13px;
          line-height: 1.45;
        }

        .about-pillar-number {
          color: #ffc6d9;
          font-size: 0.7rem;
          font-weight: 800;
        }

        .about-pillar-card h3 {
          margin-top: 0.55rem;
          font-size: 16px;
        }

        .about-legacy-copy p {
          font-size: clamp(14px, 1vw, 17px);
        }

        .about-legacy-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
          margin-top: 0.4rem;
        }

        .about-legacy-stat {
          min-width: 0;
          padding: 0.8rem 0.35rem;
          text-align: center;
          border: 1px solid rgba(255, 107, 143, 0.22);
          border-radius: 8px;
          background: rgba(12, 16, 24, 0.7);
        }

        .about-legacy-stat strong,
        .about-legacy-stat span {
          display: block;
        }

        .about-legacy-stat strong {
          color: #fff;
          font-size: clamp(34px, 3vw, 50px);
          line-height: 1;
          font-weight: 900;
        }

        .about-legacy-stat span {
          margin-top: 0.4rem;
          color: var(--about-accent);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .about-finale-card {
          align-items: flex-start;
        }

        .about-primary-btn {
          margin-top: 0.35rem;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          background: linear-gradient(135deg, #ff89ae, #ff5d8b 48%, #ef4579);
          color: #fff9fb;
          border: 1px solid rgba(255, 213, 227, 0.9);
          box-shadow: 0 4px 18px rgba(239, 69, 121, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }

        .about-primary-btn:hover {
          border-color: var(--about-accent-soft);
          box-shadow: 0 8px 24px rgba(217, 61, 109, 0.45);
        }

        /* Dedicated Card Footer Navigation (At bottom of card, eliminates arrow overlap) */
        .about-panel-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.6rem 0.2rem 0.1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: auto;
          flex-shrink: 0;
        }

        .about-card-navigation {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: static;
          transform: none;
          padding: 0;
          pointer-events: auto;
          z-index: 10;
        }

        .about-nav-counter {
          font-size: 0.72rem;
          font-weight: 800;
          font-family: monospace;
          letter-spacing: 0.12em;
          color: #94a3b8;
          margin-right: 0.2rem;
        }

        .about-arrow-btn {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          border: 1px solid rgba(255, 107, 143, 0.55);
          background: rgba(15, 23, 42, 0.88);
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          pointer-events: auto;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .about-arrow-btn:hover:not(:disabled) {
          transform: scale(1.1);
          color: #fff;
          border-color: var(--about-accent);
          background: rgba(255, 107, 143, 0.22);
          box-shadow: 0 0 16px rgba(255, 107, 143, 0.45);
        }

        .about-arrow-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .about-arrow-btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .about-card-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-top: 0;
          min-height: auto;
        }

        .about-card-indicator-item {
          width: 8px;
          height: 8px;
          padding: 0;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.25);
          cursor: pointer;
          transition: width 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
        }

        .about-card-indicator-item:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        .about-card-indicator-item.is-active {
          width: 24px;
          background: var(--about-accent);
          box-shadow: 0 0 12px rgba(255, 107, 143, 0.6);
        }

        @media (max-width: 900px) {
          .home-hero-panel {
            right: 4%;
            max-width: 440px;
            padding: 1.6rem 1.8rem;
          }
          .about-info-panel {
            left: 4%;
            width: min(440px, 88vw);
            max-width: 440px;
            padding: 1.6rem 1.8rem;
          }
        }

        @media (max-width: 768px) {
          .home-hero-panel {
            top: auto !important;
            bottom: 4rem;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: 92%;
            max-width: 420px;
            padding: 1.25rem 1.4rem;
            gap: 0.75rem;
            text-align: center;
            align-items: center;
          }
          .about-info-panel {
            top: auto !important;
            bottom: 4rem;
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%) !important;
            width: 92%;
            max-width: 420px;
            height: min(620px, calc(100vh - 7rem));
            padding: 1.25rem 1rem;
            gap: 0.75rem;
            text-align: center;
            align-items: center;
          }
          .about-story-card {
            gap: 0.65rem;
            min-height: 520px;
            padding: 18px 20px;
          }
          .about-cyber-badge {
            align-self: center;
            max-width: 100%;
          }
          .about-badge-text {
            font-size: 0.52rem;
            letter-spacing: 0.1em;
          }
          .about-main-title,
          .about-finale-title {
            font-size: 40px;
          }
          .about-story-quote {
            font-size: 16px;
            line-height: 1.45;
            text-align: left;
          }
          .about-intro-copy,
          .about-legacy-copy {
            gap: 0.45rem;
          }
          .about-intro-copy p,
          .about-legacy-copy p {
            font-size: 13px;
            line-height: 1.4;
            text-align: left;
          }
          .about-section-label {
            font-size: 0.55rem;
            text-align: center;
          }
          .about-section-title {
            font-size: 28px;
            text-align: center;
          }
          .about-chapter-grid,
          .about-pillar-grid {
            gap: 10px;
          }
          .about-chapter-card,
          .about-pillar-card {
            padding: 9px;
            text-align: left;
          }
          .about-chapter-meta {
            font-size: 10px;
          }
          .about-chapter-card h3,
          .about-pillar-card h3 {
            font-size: 16px;
          }
          .about-chapter-card p,
          .about-pillar-card p {
            font-size: 12px;
            line-height: 1.35;
          }
          .about-legacy-stat {
            padding: 0.65rem 0.2rem;
          }
          .about-legacy-stat strong {
            font-size: 32px;
          }
          .about-legacy-stat span {
            font-size: 12px;
          }
          .about-card-indicator {
            padding-top: 0.25rem;
          }
          .about-finale-card {
            align-items: center;
          }
          .hero-stats-grid {
            gap: 0.5rem;
          }
          .hero-btn-row {
            justify-content: center;
          }
        }

        @media (max-width: 600px) {
          .about-arrow-btn {
            width: 32px;
            height: 32px;
          }
        }
      `}</style>
    </main>
  );
}
