import React, { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';
import { ANANTYA_LOGO_PATHS } from './anantyaLogoPaths';

const anantyaLogo = '/assets/ANANTYA.png';

interface AvengersIntroProps {
  onComplete: () => void;
}

export const AvengersIntro: React.FC<AvengersIntroProps> = ({ onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoWrapperRef = useRef<HTMLDivElement>(null);
  const pngLogoRef = useRef<HTMLImageElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgLayersRef = useRef<HTMLDivElement>(null);
  const isFinishedRef = useRef(false);

  // Background floating cosmic embers / particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      hue: number;
    }> = [];

    for (let i = 0; i < 55; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.2 + 0.6,
        speedY: -(Math.random() * 0.8 + 0.3),
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.75 + 0.2,
        hue: Math.random() > 0.4 ? 35 : 210, // Warm Gold & Cosmic Cyan
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.opacity})`;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, 0.9)`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // 470-Path Vector Stroke Drawing -> Reveal PNG -> Handoff to Navbar
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const svgEl = svgRef.current;
    const pngEl = pngLogoRef.current;
    const wrapperEl = logoWrapperRef.current;
    if (!svgEl || !pngEl || !wrapperEl) return;

    // Timing constants
    const DRAW_DURATION = 1.9;    // seconds each path takes to draw
    const MAX_STAGGER = 1.3;      // max stagger spread (left-to-right)
    const PNG_FADE_START = 1.6;   // when PNG starts fading in
    const BORDER_FADE_START = 2.2; // when SVG borders fade out
    const BORDER_FADE_DUR = 0.9;
    const GLOW_APPLY_AT = (DRAW_DURATION + MAX_STAGGER) * 1000 + 60;
    const HANDOFF_START = 3.3;    // when to start handoff transition to main page

    // 1. Initial 3D state
    gsap.set(wrapperEl, {
      scale: 1.25,
      rotateY: -12,
      rotateX: 6,
      transformPerspective: 1200,
      filter: 'drop-shadow(0 0 20px rgba(255, 68, 0, 0.4)) brightness(0.9)',
      transformOrigin: 'center center',
    });

    gsap.set(pngEl, { opacity: 0 });

    // 2. Measure & setup stroke dashes on all 470 paths
    const allPaths = svgEl.querySelectorAll<SVGPathElement>('.logo-trace-path');
    const pathData: Array<{ el: SVGPathElement; length: number; tx: number }> = [];
    let minTx = Infinity;
    let maxTx = -Infinity;

    allPaths.forEach((path) => {
      let length: number;
      try {
        length = path.getTotalLength();
      } catch (_) {
        length = 500;
      }
      const tx = parseFloat(path.dataset.tx || '0');
      if (tx < minTx) minTx = tx;
      if (tx > maxTx) maxTx = tx;

      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      path.style.willChange = 'stroke-dashoffset';

      pathData.push({ el: path, length, tx });
    });

    if (!isFinite(minTx)) minTx = 0;
    if (!isFinite(maxTx)) maxTx = 0;

    // 3. Assign each path a CSS transition delay based on horizontal position
    const range = maxTx - minTx;
    pathData.forEach((pd) => {
      const ratio = range > 0 ? (pd.tx - minTx) / range : 0;
      const delay = ratio * MAX_STAGGER;
      pd.el.style.transition = `stroke-dashoffset ${DRAW_DURATION}s cubic-bezier(.4,0,.2,1) ${delay.toFixed(3)}s`;
    });

    // 4. Force reflow, then trigger stroke draw
    svgEl.getBoundingClientRect();

    requestAnimationFrame(() => {
      pathData.forEach((pd) => {
        pd.el.style.strokeDashoffset = '0';
      });
    });

    // 5. 3D Camera Drift to level eye-line
    gsap.to(wrapperEl, {
      scale: 1.0,
      rotateY: 0,
      rotateX: 0,
      duration: 2.2,
      ease: 'power3.out',
    });

    // 6. Apply neon glow after stroke drawing finishes
    const glowTimer = setTimeout(() => {
      pathData.forEach((pd) => {
        pd.el.style.filter = 'url(#neon-glow)';
        pd.el.style.willChange = 'auto';
      });
    }, GLOW_APPLY_AT);

    // 7. Fade in PNG logo (full illumination)
    const pngTimer = setTimeout(() => {
      gsap.to(pngEl, {
        opacity: 1,
        duration: 1.1,
        ease: 'power2.out',
      });
    }, PNG_FADE_START * 1000);

    // 8. Fade out SVG borders
    const borderFadeTimer = setTimeout(() => {
      gsap.to(svgEl, {
        opacity: 0,
        duration: BORDER_FADE_DUR,
        ease: 'power2.inOut',
      });
    }, BORDER_FADE_START * 1000);

    // 9. Reactor Energy Surge pulse on the fully lit emblem
    const surgeTimer = setTimeout(() => {
      gsap.to(wrapperEl, {
        scale: 1.05,
        duration: 0.35,
        yoyo: true,
        repeat: 1,
        ease: 'power2.inOut',
        filter:
          'brightness(1.3) contrast(1.1) drop-shadow(0 0 50px rgba(255, 120, 0, 0.95)) drop-shadow(0 0 80px rgba(255, 60, 0, 0.75))',
      });
    }, 2.8 * 1000);

    // 10. Seamless handoff to main page's centered Navbar state
    const handoffTimer = setTimeout(() => {
      if (isFinishedRef.current) return;

      // Dissolve dark intro background to reveal the main 3D canvas and navbar behind it
      if (bgLayersRef.current) {
        gsap.to(bgLayersRef.current, {
          opacity: 0,
          duration: 0.6,
          ease: 'power2.inOut',
        });
      }

      if (containerRef.current) {
        gsap.to(containerRef.current, {
          backgroundColor: 'rgba(3, 4, 8, 0)',
          duration: 0.65,
          ease: 'power2.inOut',
        });
      }

      // Smoothly morph logo size to match the Navbar's centered logo size (height ~110px)
      gsap.to(wrapperEl, {
        scale: 0.32,
        duration: 0.85,
        ease: 'power3.inOut',
        onComplete: () => {
          if (containerRef.current && !isFinishedRef.current) {
            gsap.to(containerRef.current, {
              opacity: 0,
              duration: 0.35,
              ease: 'power2.out',
              onComplete: () => {
                isFinishedRef.current = true;
                onComplete();
              },
            });
          }
        },
      });
    }, HANDOFF_START * 1000);

    return () => {
      clearTimeout(glowTimer);
      clearTimeout(pngTimer);
      clearTimeout(borderFadeTimer);
      clearTimeout(surgeTimer);
      clearTimeout(handoffTimer);
    };
  }, [onComplete]);

  // Fast-forward on Skip button click
  const handleSkip = () => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: () => {
          onComplete();
        },
      });
    } else {
      onComplete();
    }
  };

  return (
    <div ref={containerRef} className="avengers-intro-root">
      {/* Decorative background layers */}
      <div ref={bgLayersRef} className="avengers-bg-layers">
        {/* Floating cosmic particles canvas */}
        <canvas ref={canvasRef} className="avengers-bg-canvas" />

        {/* Reactor Core Radial Glow */}
        <div className="avengers-radial-core" />
        <div className="avengers-vignette" />
      </div>

      {/* Center 3D Logo Stage */}
      <div className="avengers-logo-stage">
        <div ref={logoWrapperRef} className="avengers-logo-wrapper">
          {/* Layer 1: High-Resolution Full-Color Official PNG Logo */}
          <img
            ref={pngLogoRef}
            src={anantyaLogo}
            alt="ANANTYA"
            className="avengers-png-logo"
          />

          {/* Layer 2: 470-Path Vector Laser Tracing SVG Overlay */}
          <div className="avengers-svg-overlay">
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 707 353"
              preserveAspectRatio="none"
              className="avengers-laser-svg"
            >
              <defs>
                {/* Vibrant Cyberpunk Laser Gradient */}
                <linearGradient id="logo-laser-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffea00" />
                  <stop offset="50%" stopColor="#ff5500" />
                  <stop offset="100%" stopColor="#ff0055" />
                </linearGradient>

                {/* Neon Glow Filter */}
                <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* All 470 ANANTYA logo vector paths */}
              {ANANTYA_LOGO_PATHS.map((p, i) => (
                <path
                  key={i}
                  className="logo-trace-path"
                  d={p.d}
                  data-tx={String(p.tx)}
                  transform={p.transform}
                />
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Skip Button */}
      <button type="button" className="avengers-skip-btn" onClick={handleSkip}>
        <span>SKIP INTRO</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="5 4 15 12 5 20 5 4"></polygon>
          <line x1="19" y1="5" x2="19" y2="19"></line>
        </svg>
      </button>

      <style>{`
        .avengers-intro-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #030408;
          overflow: hidden;
          user-select: none;
          pointer-events: auto;
        }

        .avengers-bg-layers {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .avengers-bg-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .avengers-radial-core {
          position: absolute;
          width: 900px;
          height: 900px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(
            circle at center,
            rgba(255, 85, 0, 0.22) 0%,
            rgba(255, 150, 0, 0.12) 45%,
            transparent 75%
          );
          filter: blur(85px);
          pointer-events: none;
          z-index: 2;
          animation: corePulse 5s ease-in-out infinite alternate;
        }

        @keyframes corePulse {
          0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
        }

        .avengers-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.1) 40%, rgba(0, 0, 0, 0.85) 100%);
          pointer-events: none;
          z-index: 3;
        }

        .avengers-logo-stage {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 1200px;
          width: min(85vw, 680px);
        }

        .avengers-logo-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
          width: 100%;
          aspect-ratio: 1774 / 887;
          will-change: transform, filter;
        }

        .avengers-png-logo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          opacity: 0;
          will-change: opacity, filter;
          transform: translateZ(0);
          filter: brightness(1.12) contrast(1.06)
                  drop-shadow(0 0 35px rgba(255, 85, 0, 0.75))
                  drop-shadow(0 0 70px rgba(255, 50, 0, 0.45));
          z-index: 1;
        }

        .avengers-svg-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 2;
          pointer-events: none;
          transform: translateZ(0);
        }

        .avengers-laser-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        /* 470 vector stroke paths */
        .logo-trace-path {
          fill: none;
          stroke: url(#logo-laser-gradient);
          stroke-width: 1.0;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .avengers-skip-btn {
          position: absolute;
          bottom: 2.2rem;
          right: 2.5rem;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(8, 14, 26, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 0.55rem 1.15rem;
          border-radius: 9999px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: all 0.25s ease;
        }

        .avengers-skip-btn:hover {
          color: #ffffff;
          background: rgba(255, 100, 0, 0.25);
          border-color: rgba(255, 160, 0, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 0 15px rgba(255, 100, 0, 0.4);
        }
      `}</style>
    </div>
  );
};

export default AvengersIntro;
