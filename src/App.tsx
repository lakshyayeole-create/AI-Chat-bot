import { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './lib/gsap';
import Transition, { ModelConfig, TransitionHandle } from './components/Transition';
import Navbar from './components/Navbar';
import AvengersIntro from './components/ui/AvengersIntro';

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

const antManConfig: ModelConfig = {
  modelPath: '/assets/marvel_ant-man_helmet.glb',
  bgImagePath: '/assets/outer-space-background-sparkling-universe-glowing-in-the-dark-vector.jpg',
  targetHeight: 1.5,
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
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const stdMat = mat as THREE.MeshStandardMaterial;
        const matName = (stdMat.name || '').toLowerCase();
        if (
          matName.includes('001') ||
          matName.includes('002') ||
          matName.includes('eye') ||
          matName.includes('lens')
        ) {
          stdMat.emissive = new THREE.Color(0xff1122);
          stdMat.emissiveIntensity = 2.8;
        } else {
          if (stdMat.roughness !== undefined) stdMat.roughness = Math.max(0.15, stdMat.roughness * 0.85);
          if (stdMat.metalness !== undefined) stdMat.metalness = Math.min(0.98, Math.max(0.7, stdMat.metalness * 1.2));
        }
      });
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [morphProgress, setMorphProgress] = useState(0);
  const [assemblyProgress, setAssemblyProgress] = useState(0);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [fromPositionX, setFromPositionX] = useState(0);
  const [toPositionX, setToPositionX] = useState(0);
  const [fromRotationY, setFromRotationY] = useState(0);
  const [toRotationY, setToRotationY] = useState(0);
  const [heroInfoOpacity, setHeroInfoOpacity] = useState(0);
  const [aboutInfoOpacity, setAboutInfoOpacity] = useState(0);
  const [activeNavSection, setActiveNavSection] = useState<'home' | 'about' | 'events' | 'gallery' | 'contact'>('home');

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
    gsap.ticker.lagSmoothing(0);

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

  // Configure ScrollTrigger — sequential phases:
  // Phase 1 (0.00 -> 0.12): Logo morphs to top Navigation Bar (Mask hidden).
  // Phase 2 (0.12 -> 0.32): Iron Man mask assembles; glides to left & looks right.
  // Phase 3 (0.32 -> 0.48): HOME PAGE HERO SECTION (Iron Man on left looking right, Info on right).
  // Phase 4 (0.48 -> 0.68): TRANSITION / WIPE: Home info fades out, diagonal wipe progresses, Ant-Man glides to right looking left.
  // Phase 5 (0.68 -> 0.90): ABOUT US SECTION (Ant-Man on right looking left, About Us info on left).
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

    const NAV_END      = 0.12;  // navbar fully formed
    const IRON_END     = 0.30;  // Iron Man fully assembled and in hero position on left
    const HOME_HOLD    = 0.44;  // Home page hero section in full focus
    const CENTER_END   = 0.50;  // Iron Man smoothly returns to center facing forward
    const WIPE_END     = 0.66;  // Diagonal laser wipe in center: Iron Man -> Ant-Man with full 3D rotation
    const ABOUT_HOLD   = 0.76;  // Ant-Man glides to right, turns left, About Us panel in full focus

    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress; // 0.0 to 1.0
        setScrollProgress(p);

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const targetLeftX = isMobile ? 0 : -0.65;
        const targetRightX = isMobile ? 0 : 0.65;
        const targetRightRot = isMobile ? 0 : 0.38;   // looks towards the right
        const targetLeftRot = isMobile ? 0 : -0.38;   // looks towards the left

        if (p <= NAV_END) {
          // Phase 1 — Logo-to-Navbar Morph
          const navP = Math.min(1, p / NAV_END);
          setMorphProgress(navP);
          setAssemblyProgress(0);
          setTransitionProgress(0);
          setFromPositionX(0);
          setFromRotationY(0);
          setToPositionX(0);
          setToRotationY(0);
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);
          setActiveNavSection('home');
        } else if (p <= IRON_END) {
          // Phase 2 — Iron Man Assembly & Glide to Left
          setMorphProgress(1);
          const maskP = (p - NAV_END) / (IRON_END - NAV_END);
          const clampedMaskP = Math.min(1, Math.max(0, maskP));
          setAssemblyProgress(clampedMaskP);
          setTransitionProgress(0);
          setToPositionX(0);
          setToRotationY(0);
          setAboutInfoOpacity(0);
          setActiveNavSection('home');

          if (clampedMaskP > 0.55) {
            const slideT = (clampedMaskP - 0.55) / 0.45;
            setFromPositionX(targetLeftX * slideT);
            setFromRotationY(targetRightRot * slideT);
            setHeroInfoOpacity(slideT);
          } else {
            setFromPositionX(0);
            setFromRotationY(0);
            setHeroInfoOpacity(0);
          }
        } else if (p <= HOME_HOLD) {
          // Phase 3 — Home Page Hero Section in full focus (Iron Man on left looking right)
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(0);
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

          const centerT = (p - HOME_HOLD) / (CENTER_END - HOME_HOLD);
          setFromPositionX(targetLeftX * (1 - centerT));
          setFromRotationY(targetRightRot * (1 - centerT));
          setHeroInfoOpacity(Math.max(0, 1 - centerT * 2.2));

          setToPositionX(0);
          setToRotationY(0);
          setAboutInfoOpacity(0);
          setActiveNavSection('home');
        } else if (p <= WIPE_END) {
          // Phase 4b — Seamless Diagonal Laser Seam Wipe in the CENTER (Exact smooth transition like before)
          setMorphProgress(1);
          setAssemblyProgress(1);
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(0);

          const wipeNorm = (p - CENTER_END) / (WIPE_END - CENTER_END);
          const wipeT = Math.min(1, Math.max(0, wipeNorm));
          setTransitionProgress(wipeT);

          // Both models are aligned in the exact same center position
          setFromPositionX(0);
          setToPositionX(0);

          // Synchronous full 360-degree rotation across the diagonal laser seam
          const sharedRotY = wipeT * Math.PI * 2;
          setFromRotationY(sharedRotY);
          setToRotationY(sharedRotY);

          setActiveNavSection(wipeT >= 0.5 ? 'about' : 'home');
        } else if (p <= ABOUT_HOLD) {
          // Phase 4c — Wipe complete: Ant-Man glides to the right and turns left, About Us panel fades in
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(1);
          setHeroInfoOpacity(0);

          setFromPositionX(0);
          setFromRotationY(Math.PI * 2);

          const glideNorm = (p - WIPE_END) / (ABOUT_HOLD - WIPE_END);
          const glideT = Math.min(1, Math.max(0, glideNorm));
          const posEase = Math.sin((glideT * Math.PI) / 2);
          const rotEase = 1 - Math.pow(1 - glideT, 2.5);

          setToPositionX(targetRightX * posEase);
          setToRotationY(Math.PI * 2 + targetLeftRot * rotEase);
          setAboutInfoOpacity(glideT);

          setActiveNavSection('about');
        } else {
          // Phase 5 & 6 — About Us Section in full focus (Ant-Man on right looking left, About panel on left)
          setMorphProgress(1);
          setAssemblyProgress(1);
          setTransitionProgress(1);
          setFromPositionX(0);
          setFromRotationY(Math.PI * 2);

          setToPositionX(targetRightX);
          setToRotationY(Math.PI * 2 + targetLeftRot);
          setHeroInfoOpacity(0);
          setAboutInfoOpacity(1);
          setActiveNavSection('about');
        }
      },
    });

    return () => {
      st.kill();
    };
  }, [hasEntered]);

  // Smooth programmatic scroll navigation when clicking Navbar links or buttons
  const handleNavSelect = useCallback((id: string) => {
    const track = document.getElementById('scroll-track');
    const scrollHeight = document.documentElement.scrollHeight || (track ? track.scrollHeight : 0);
    const maxScroll = scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;

    let targetProgress = 0.36; // Default to Home section (Iron Man hero stance on left, Info on right)
    if (id === 'home') {
      targetProgress = 0.36;
    } else if (id === 'about') {
      targetProgress = 0.80; // About Us section (Ant-Man hero stance on right, Info on left)
    } else {
      targetProgress = 0.80;
    }

    const targetScrollY = targetProgress * maxScroll;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetScrollY, {
        duration: 1.6,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else {
      window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    }
  }, []);

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
      <div className="fixed-3d-canvas-wrap">
        <Transition
          ref={transitionRef}
          fromModel={ironManConfig}
          toModel={antManConfig}
          assemblyProgress={assemblyProgress}
          transitionProgress={transitionProgress}
          fromPositionX={fromPositionX}
          toPositionX={toPositionX}
          fromRotationY={fromRotationY}
          toRotationY={toRotationY}
          enableScroll={false}
        />
      </div>

      {/* Home Page Hero Info Panel (Right Side: displays festival details while helmet gazes from the left) */}
      <section
        className="home-hero-panel"
        style={{
          opacity: heroInfoOpacity,
          transform: `translateY(-50%) translateX(${(1 - heroInfoOpacity) * 35}px)`,
          pointerEvents: heroInfoOpacity > 0.4 ? 'auto' : 'none',
        }}
      >
        <div className="hero-cyber-badge">
          <span className="hero-pulse-dot" />
          <span className="hero-badge-text">PCCOE PRESENTS • MARCH 2026</span>
        </div>

        <h1 className="hero-main-title">
          ANANTYA <span className="hero-title-year">2026</span>
        </h1>

        <div className="hero-tagline-pill">
          <span className="tagline-gem" />
          <span>SEVEN CRYSTALS • ONE SYSTEM</span>
        </div>

        <p className="hero-description">
          Welcome to PCCOE's premier national techno-cultural extravaganza. Step into the high-tech Marvel dimension where speed coding warfare, autonomous robotics, CTF cybersecurity, and cultural brilliance converge.
        </p>

        {/* Quick Highlights / Stats Grid */}
        <div className="hero-stats-grid">
          <div className="stat-card">
            <span className="stat-val">8+</span>
            <span className="stat-label">Club Arenas</span>
          </div>
          <div className="stat-card">
            <span className="stat-val">3</span>
            <span className="stat-label">Epic Days</span>
          </div>
          <div className="stat-card">
            <span className="stat-val">₹2L+</span>
            <span className="stat-label">Prize Pool</span>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="hero-btn-row">
          <a href="#events" className="hero-btn primary-btn">
            <span>EXPLORE EVENTS</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </a>
          <a href="#contact" className="hero-btn secondary-btn">
            <span>REGISTER NOW</span>
          </a>
        </div>
      </section>

      {/* About Us Info Panel (Left Side: displays About information while Ant-Man helmet gazes from the right) */}
      <section
        id="about"
        className="about-info-panel"
        style={{
          opacity: aboutInfoOpacity,
          transform: `translateY(-50%) translateX(${(1 - aboutInfoOpacity) * -35}px)`,
          pointerEvents: aboutInfoOpacity > 0.4 ? 'auto' : 'none',
        }}
      >
        <div className="about-cyber-badge">
          <span className="about-pulse-dot" />
          <span className="about-badge-text">QUANTUM ARCHIVE • ABOUT ANANTYA</span>
        </div>

        <h2 className="about-main-title">
          BEYOND <span className="about-title-highlight">LIMITS</span>
        </h2>

        <div className="about-tagline-pill">
          <span className="about-tagline-gem" />
          <span>INNOVATION • CULTURE • TRANSCENDENCE</span>
        </div>

        <p className="about-description">
          Anantya is PCCOE's premier annual techno-cultural symposium. Channeling the power of the Marvel Multiverse, it provides a high-stakes arena for brilliant minds to conquer national hackathons, competitive gaming, quantum robotics, and theatrical showcases.
        </p>

        {/* About Feature Points */}
        <div className="about-features-list">
          <div className="about-feature-item">
            <span className="about-feature-num">01</span>
            <div className="about-feature-content">
              <h4>Techno-Innovation</h4>
              <p>Hackathons, AI research showdowns, and autonomous robotics leagues.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <span className="about-feature-num">02</span>
            <div className="about-feature-content">
              <h4>Cultural Extravaganza</h4>
              <p>Battle of the Bands, street dancing, theatrical drama, and pro-night concerts.</p>
            </div>
          </div>
          <div className="about-feature-item">
            <span className="about-feature-num">03</span>
            <div className="about-feature-content">
              <h4>National Arena</h4>
              <p>5,000+ collegiate innovators and tech enthusiasts across 50+ institutes.</p>
            </div>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="hero-btn-row">
          <a href="#events" className="hero-btn primary-btn about-primary-btn">
            <span>DISCOVER EVENTS</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </a>
          <a href="#gallery" className="hero-btn secondary-btn">
            <span>PAST HIGHLIGHTS</span>
          </a>
        </div>
      </section>

      {/* Bottom Scroll Prompt (Only visible right after intro, fades out as user scrolls) */}
      <div
        className="bottom-scroll-prompt"
        style={{
          opacity: Math.max(0, 1 - scrollProgress * 5.0),
          pointerEvents: scrollProgress < 0.04 ? 'auto' : 'none',
        }}
      >
        <span className="scroll-prompt-text">SCROLL</span>
        <div className="scroll-prompt-mouse">
          <div className="scroll-prompt-dot" />
        </div>
        <svg
          className="scroll-prompt-arrow"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {/* Scroll track providing smooth scrolling space (850vh across Home & About sections) */}
      <div id="scroll-track" className="scroll-track-container" />

      <style>{`
        .app-main-root {
          width: 100%;
          min-height: 100vh;
          position: relative;
          background: transparent;
        }

        .fixed-3d-canvas-wrap {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          z-index: 1;
          pointer-events: none;
        }

        /* 850vh: navbar morph → Iron Man hero → diagonal wipe → Ant-Man About */
        .scroll-track-container {
          width: 100%;
          height: 850vh;
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
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.15rem;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
          letter-spacing: 0.08em;
          color: #ffffff;
          line-height: 1.05;
          margin: 0;
          text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.35);
        }

        .hero-title-year {
          background: linear-gradient(135deg, #f59e0b 0%, #ef4444 60%, #ec4899 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 18px rgba(239, 68, 68, 0.45));
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
          position: fixed;
          top: 50%;
          left: 6%;
          max-width: 520px;
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.15rem;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          background: radial-gradient(130% 100% at 100% 0%, rgba(15, 23, 42, 0.78) 0%, rgba(8, 14, 26, 0.68) 100%);
          border: 1px solid rgba(244, 63, 94, 0.28);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 35px rgba(244, 63, 94, 0.16);
          border-radius: 18px;
          padding: 2.2rem 2.4rem;
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
        }

        .about-cyber-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.35rem 0.85rem;
          background: rgba(244, 63, 94, 0.12);
          border: 1px solid rgba(244, 63, 94, 0.35);
          border-radius: 9999px;
        }

        .about-pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f43f5e;
          box-shadow: 0 0 10px #f43f5e;
          animation: badgePulse 2s infinite ease-in-out;
        }

        .about-badge-text {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: #fda4af;
          text-transform: uppercase;
        }

        .about-main-title {
          font-size: clamp(2.4rem, 4vw, 3.5rem);
          font-weight: 900;
          letter-spacing: 0.08em;
          color: #ffffff;
          line-height: 1.05;
          margin: 0;
          text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8), 0 0 30px rgba(244, 63, 94, 0.35);
        }

        .about-title-highlight {
          background: linear-gradient(135deg, #fb7185 0%, #e11d48 60%, #be123c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 18px rgba(225, 29, 72, 0.45));
        }

        .about-tagline-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: #cbd5e1;
        }

        .about-tagline-gem {
          width: 8px;
          height: 8px;
          transform: rotate(45deg);
          background: linear-gradient(135deg, #f43f5e, #fb7185);
          box-shadow: 0 0 10px #f43f5e;
        }

        .about-description {
          font-size: 0.94rem;
          line-height: 1.6;
          color: #94a3b8;
          margin: 0;
        }

        .about-features-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          width: 100%;
          margin-top: 0.2rem;
        }

        .about-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          padding: 0.6rem 0.85rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 10px;
        }

        .about-feature-num {
          font-size: 0.75rem;
          font-weight: 800;
          color: #f43f5e;
          font-family: monospace;
          letter-spacing: 0.1em;
          padding-top: 0.1rem;
        }

        .about-feature-content h4 {
          font-size: 0.82rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 0.15rem 0;
          letter-spacing: 0.04em;
        }

        .about-feature-content p {
          font-size: 0.72rem;
          color: #94a3b8;
          margin: 0;
          line-height: 1.38;
        }

        .about-primary-btn {
          background: linear-gradient(135deg, #e11d48 0%, #9f1239 100%);
          border: 1px solid rgba(244, 63, 94, 0.6);
          box-shadow: 0 4px 18px rgba(225, 29, 72, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .about-primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(225, 29, 72, 0.55);
          border-color: #fb7185;
        }

        @media (max-width: 900px) {
          .home-hero-panel {
            right: 4%;
            max-width: 440px;
            padding: 1.6rem 1.8rem;
          }
          .about-info-panel {
            left: 4%;
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
            padding: 1.25rem 1.4rem;
            gap: 0.75rem;
            text-align: center;
            align-items: center;
          }
          .about-features-list {
            display: none;
          }
          .hero-stats-grid {
            gap: 0.5rem;
          }
          .hero-btn-row {
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}
