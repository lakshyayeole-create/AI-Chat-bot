import { useState, useRef, useEffect, useCallback } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './lib/gsap';
import Transition, { ModelConfig, TransitionHandle } from './components/Transition';
import Navbar from './components/Navbar';
import AvengersIntro from './components/ui/AvengersIntro';

const ironManConfig: ModelConfig = {
  modelPath: '/assets/iron_man_detailed_web.glb',
  bgImagePath: '/assets/iron_man_background.jpeg',
  rotationX: 0,
  targetHeight: 1.5,
  assemblyAnimation: true,
  autoStartAssembly: false, // Driven strictly by scroll
  lighting: {
    ambientColor: 0xd5e6ff,
    ambientIntensity: 0.8,
    keyColor: 0xfff7e6,
    keyIntensity: 1.8,
    rimColor: 0x00f0ff,
    rimIntensity: 1.5,
    fillColor: 0xff2244,
    fillIntensity: 0.9,
    topColor: 0xffffff,
    topIntensity: 0.8,
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

export default function App() {
  const transitionRef = useRef<TransitionHandle>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [morphProgress, setMorphProgress] = useState(0);
  const [assemblyProgress, setAssemblyProgress] = useState(0);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [assemblyPhaseProgress, setAssemblyPhaseProgress] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  // Initialize Lenis Smooth Scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.25,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 1.8,
    });

    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    // Lock scrolling while introduction is playing
    if (!hasEntered) {
      lenis.stop();
    }

    return () => {
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [hasEntered]);

  // Handle Intro Completion
  const handleEnter = useCallback(() => {
    setHasEntered(true);
    if (lenisRef.current) {
      lenisRef.current.start();
    }
  }, []);

  // Configure ScrollTrigger — sequential phases:
  // Phase 1 (0.00 -> 0.20): Logo morphs to top Navigation Bar (Mask hidden).
  // Phase 2 (0.20 -> 0.50): Iron Man mask assembles piece-by-piece on scroll.
  // Phase 3 (0.50 -> 0.82): Mask rotates along Y axis while diagonal laser seam wipes to Ant-Man.
  // Phase 4 (0.82 -> 1.00): Ant-Man mask fully revealed with smooth rotation.
  useEffect(() => {
    if (!hasEntered) return;

    const track = document.getElementById('scroll-track');
    if (!track) return;

    const NAV_END      = 0.20;  // navbar fully formed
    const IRON_END     = 0.50;  // Iron Man fully assembled
    const WIPE_END     = 0.82;  // diagonal laser wipe complete

    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress; // 0.0 to 1.0
        setScrollProgress(p);

        // Phase 1 — Logo-to-Navbar Morph
        const navP = Math.min(1, p / NAV_END);
        setMorphProgress(navP);

        // Phase 2 — Iron Man Assembly
        if (p <= NAV_END) {
          setAssemblyProgress(0);
          setAssemblyPhaseProgress(0);
          setTransitionProgress(0);
          setRotationY(0);
        } else if (p <= IRON_END) {
          const maskP = (p - NAV_END) / (IRON_END - NAV_END);
          const clampedMaskP = Math.min(1, Math.max(0, maskP));
          setAssemblyProgress(clampedMaskP);
          setAssemblyPhaseProgress(clampedMaskP);
          setTransitionProgress(0);
          setRotationY(0);

        } else {
          // Phase 3 & 4 — Mask Assembled: Rotate on Y axis + Diagonal Wipe
          setAssemblyProgress(1);
          setAssemblyPhaseProgress(1);

          // Smooth Y-axis rotation as user continues scrolling
          const rotP = (p - IRON_END) / (1.0 - IRON_END);
          const targetRotY = rotP * Math.PI * 1.5;
          setRotationY(targetRotY);

          // Diagonal laser seam wipe across rotated mask
          const wipeP = (p - 0.54) / (WIPE_END - 0.54);
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
          enableScroll={false}
        />
      </div>

      {/* ── Cinematic Atmospheric Overlays (assembly phase only) ────────────── */}

      {/* Vignette intensifier: deepens during mask assembly for dramatic focus */}
      <div
        className="assembly-vignette"
        style={{
          opacity: assemblyPhaseProgress < 0.05
            ? 0
            : assemblyPhaseProgress < 0.15
              ? (assemblyPhaseProgress - 0.05) / 0.1
              : assemblyPhaseProgress > 0.9
                ? 1 - (assemblyPhaseProgress - 0.9) / 0.1
                : 1,
          pointerEvents: 'none',
        }}
      />

      {/* HUD Scanline overlay: subtle tech grid during Iron Man assembly */}
      <div
        className="hud-scanlines"
        style={{
          opacity: assemblyPhaseProgress < 0.1
            ? 0
            : assemblyPhaseProgress < 0.2
              ? (assemblyPhaseProgress - 0.1) / 0.1 * 0.4
              : assemblyPhaseProgress > 0.85
                ? (1 - (assemblyPhaseProgress - 0.85) / 0.15) * 0.4
                : 0.4,
          pointerEvents: 'none',
        }}
      />

      {/* Assembly Progress Energy Arc — bottom center */}
      <div
        className="energy-arc-wrap"
        style={{
          opacity: assemblyPhaseProgress > 0.02 && assemblyPhaseProgress < 0.98 ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <svg className="energy-arc-svg" viewBox="0 0 240 130" fill="none">
          {/* Track arc */}
          <path
            d="M 20 120 A 100 100 0 0 1 220 120"
            stroke="rgba(56,189,248,0.15)"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          {/* Filled progress arc */}
          <path
            d="M 20 120 A 100 100 0 0 1 220 120"
            stroke="url(#arcGrad)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * 100 * assemblyPhaseProgress} ${Math.PI * 100}`}
          />
          {/* Glowing tip dot — traces the arc from left (progress=0) to right (progress=1) */}
          <circle
            cx={120 + Math.cos(Math.PI * (1 - assemblyPhaseProgress)) * 100}
            cy={120 - Math.sin(Math.PI * (1 - assemblyPhaseProgress)) * 100}
            r="3.5"
            fill="#38bdf8"
            style={{ filter: 'drop-shadow(0 0 6px #38bdf8)' }}
          />
          <defs>
            <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="rgba(134,59,255,0.9)" />
              <stop offset="100%" stopColor="rgba(56,189,248,1)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="energy-arc-label">
          MARK LXXXV &nbsp;·&nbsp; {Math.round(assemblyPhaseProgress * 100)}%
        </div>
      </div>

      {/* Corner energy brackets (top-left & bottom-right) during assembly */}
      <div
        className="hud-brackets"
        style={{
          opacity: assemblyPhaseProgress > 0.05 && assemblyPhaseProgress < 0.95 ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <div className="bracket bracket-tl" />
        <div className="bracket bracket-br" />
      </div>

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

        /* ── Atmospheric Vignette (deepens during assembly) ── */
        .assembly-vignette {
          position: fixed;
          inset: 0;
          z-index: 2;
          background: radial-gradient(
            ellipse 70% 60% at 50% 50%,
            transparent 30%,
            rgba(3, 5, 12, 0.55) 70%,
            rgba(3, 5, 12, 0.85) 100%
          );
          transition: opacity 0.3s ease;
        }

        /* ── HUD Scanline Tech Grid ── */
        .hud-scanlines {
          position: fixed;
          inset: 0;
          z-index: 3;
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 3px,
              rgba(56, 189, 248, 0.025) 3px,
              rgba(56, 189, 248, 0.025) 4px
            );
          pointer-events: none;
          transition: opacity 0.4s ease;
        }

        /* ── Energy Arc Progress Ring ── */
        .energy-arc-wrap {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          transition: opacity 0.4s ease;
        }

        .energy-arc-svg {
          width: 160px;
          height: 90px;
          overflow: visible;
        }

        .energy-arc-label {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.22em;
          color: rgba(56, 189, 248, 0.75);
          text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
          white-space: nowrap;
          text-transform: uppercase;
        }

        /* ── Corner HUD Brackets ── */
        .hud-brackets {
          position: fixed;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          transition: opacity 0.5s ease;
        }

        .bracket {
          position: absolute;
          width: 36px;
          height: 36px;
        }

        .bracket-tl {
          top: 84px;
          left: 1.8rem;
          border-top: 2px solid rgba(56, 189, 248, 0.55);
          border-left: 2px solid rgba(56, 189, 248, 0.55);
          box-shadow: -2px -2px 12px rgba(56, 189, 248, 0.25);
          animation: bracketPulse 2.4s ease-in-out infinite;
        }

        .bracket-br {
          bottom: 1.8rem;
          right: 1.8rem;
          border-bottom: 2px solid rgba(134, 59, 255, 0.55);
          border-right: 2px solid rgba(134, 59, 255, 0.55);
          box-shadow: 2px 2px 12px rgba(134, 59, 255, 0.25);
          animation: bracketPulse 2.4s ease-in-out infinite reverse;
        }

        @keyframes bracketPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
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
      `}</style>
    </main>
  );
}
