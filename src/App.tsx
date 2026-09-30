import { useState, useRef, useEffect, useCallback } from 'react';
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
  bgImagePath: '/assets/ant_man_bg.jpeg',
  targetHeight: 1.5,
  lighting: {
    ambientColor: 0xd5e6ff,
    ambientIntensity: 0.8,
    keyColor: 0xfff7e6,
    keyIntensity: 1.8,
    rimColor: 0xff2244,
    rimIntensity: 1.5,
    fillColor: 0x00f0ff,
    fillIntensity: 0.9,
    topColor: 0xffffff,
    topIntensity: 0.8,
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
  const [rotationY, setRotationY] = useState(0);
  const [positionX, setPositionX] = useState(0);
  const [heroInfoOpacity, setHeroInfoOpacity] = useState(0);

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
  // Phase 1 (0.00 -> 0.18): Logo morphs to top Navigation Bar (Mask hidden).
  // Phase 2 (0.18 -> 0.44): Iron Man mask assembles piece-by-piece; as it finishes, glides to left & looks right.
  // Phase 3 (0.44 -> 0.72): HOME PAGE HERO SECTION in full display (Helmet on left looking right, Info on right).
  // Phase 4 (0.72 -> 1.00): Transition towards next model.
  useEffect(() => {
    if (!hasEntered) return;

    window.scrollTo(0, 0);
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    }
    ScrollTrigger.clearScrollMemory?.('manual');

    const track = document.getElementById('scroll-track');
    if (!track) return;

    const NAV_END      = 0.18;  // navbar fully formed
    const IRON_END     = 0.44;  // Iron Man fully assembled
    const HERO_HOLD    = 0.72;  // Home page hero section in full focus
    const WIPE_END     = 0.94;  // diagonal laser wipe complete

    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress; // 0.0 to 1.0
        setScrollProgress(p);

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const targetX = isMobile ? 0 : -0.65;
        const targetRot = isMobile ? 0 : 0.38;

        // Phase 1 — Logo-to-Navbar Morph
        const navP = Math.min(1, p / NAV_END);
        setMorphProgress(navP);

        if (p <= NAV_END) {
          setAssemblyProgress(0);
          setTransitionProgress(0);
          setPositionX(0);
          setRotationY(0);
          setHeroInfoOpacity(0);
        } else if (p <= IRON_END) {
          const maskP = (p - NAV_END) / (IRON_END - NAV_END);
          const clampedMaskP = Math.min(1, Math.max(0, maskP));
          setAssemblyProgress(clampedMaskP);
          setTransitionProgress(0);

          // As assembly reaches completion, smoothly glide to the left and turn gaze to the right
          if (clampedMaskP > 0.60) {
            const slideT = (clampedMaskP - 0.60) / 0.40;
            setPositionX(targetX * slideT);
            setRotationY(targetRot * slideT);
            setHeroInfoOpacity(slideT);
          } else {
            setPositionX(0);
            setRotationY(0);
            setHeroInfoOpacity(0);
          }
        } else if (p <= HERO_HOLD) {
          // Home Page Hero Section in full focus
          setAssemblyProgress(1);
          setTransitionProgress(0);
          setPositionX(targetX);
          setRotationY(targetRot);
          setHeroInfoOpacity(1);
        } else {
          // Phase 4 — Transition to next phase
          setAssemblyProgress(1);
          const exitT = (p - HERO_HOLD) / (1.0 - HERO_HOLD);
          setHeroInfoOpacity(Math.max(0, 1 - exitT * 2.5));
          setPositionX(targetX * Math.max(0, 1 - exitT * 1.5));
          setRotationY(targetRot + exitT * Math.PI * 1.5);

          const wipeP = (p - 0.78) / (WIPE_END - 0.78);
          setTransitionProgress(Math.min(1, Math.max(0, wipeP)));
        }
      },
    });

    return () => {
      st.kill();
    };
  }, [hasEntered]);

  return (
    <main className="app-main-root">
      {/* Cinematic Logo Introduction */}
      {!hasEntered && <AvengersIntro onComplete={handleEnter} />}

      {/* Floating Navigation Bar with Scroll Morphing Animation */}
      <Navbar
        logoSrc="/assets/ANANTYA.png"
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
          rotationY={rotationY}
          positionX={positionX}
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

      {/* Scroll track providing smooth scrolling space (No cards, no clutter) */}
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

        /* 700vh: navbar morph → Iron Man assembly → diagonal wipe → Ant-Man */
        .scroll-track-container {
          width: 100%;
          height: 700vh;
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

        @media (max-width: 900px) {
          .home-hero-panel {
            right: 4%;
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
