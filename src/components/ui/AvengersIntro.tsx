import React, { useEffect, useRef } from 'react';
import { gsap } from '../../lib/gsap';
import anantyaLogo from '../../../assets/ANANTYA.png';

interface AvengersIntroProps {
  onComplete: () => void;
}

export const AvengersIntro: React.FC<AvengersIntroProps> = ({ onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const flareRef = useRef<HTMLDivElement>(null);
  const shockwaveRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Background floating embers / particles
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

    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.2 + 0.6,
        speedY: -(Math.random() * 0.7 + 0.3),
        speedX: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.7 + 0.2,
        hue: Math.random() > 0.5 ? 270 : 190, // Cyan & Purple
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 65%, ${p.opacity})`;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, 0.8)`;
        ctx.shadowBlur = 10;
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

  // Avengers-style Cinematic Logo Timeline
  useEffect(() => {
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        // Dramatic fade out to reveal helmet
        gsap.to(containerRef.current, {
          opacity: 0,
          scale: 1.08,
          filter: 'blur(10px)',
          duration: 0.9,
          ease: 'power2.inOut',
          onComplete: () => {
            onComplete();
          },
        });
      },
    });

    // 1. Initial State: Deep in cinematic shadows, tilted in 3D perspective
    gsap.set(logoRef.current, {
      scale: 1.55,
      opacity: 0,
      filter: 'blur(20px) brightness(0.2)',
      rotateX: 18,
      rotateY: -12,
      transformPerspective: 1200,
    });

    gsap.set(shockwaveRef.current, {
      scale: 0.2,
      opacity: 0,
    });

    gsap.set(flareRef.current, {
      xPercent: -150,
      opacity: 0,
    });

    // 2. Cinematic Entrance: Camera slow pushback, logo emerging from darkness
    tl.to(
      logoRef.current,
      {
        opacity: 0.85,
        filter: 'blur(6px) brightness(0.8)',
        duration: 1.4,
        ease: 'power2.out',
      },
      '+=0.2',
    )
      // Metallic Gleam / Specular Flare sweep across the emblem
      .to(
        flareRef.current,
        {
          xPercent: 180,
          opacity: 0.95,
          duration: 1.2,
          ease: 'power1.inOut',
        },
        '-=0.8',
      )
      // 3. Final Snap & Perspective Lock-In (Avengers impact)
      .to(
        logoRef.current,
        {
          scale: 1.0,
          rotateX: 0,
          rotateY: 0,
          opacity: 1,
          filter: 'blur(0px) brightness(1.25) drop-shadow(0 0 35px rgba(134, 59, 255, 0.9))',
          duration: 1.2,
          ease: 'expo.out',
        },
        '-=0.4',
      )
      // Shockwave burst on lock-in
      .to(
        shockwaveRef.current,
        {
          scale: 2.2,
          opacity: 0.8,
          duration: 0.6,
          ease: 'power2.out',
        },
        '-=1.0',
      )
      .to(
        shockwaveRef.current,
        {
          opacity: 0,
          scale: 3.0,
          duration: 0.6,
          ease: 'power2.in',
        },
        '-=0.4',
      )
      // Dramatic pulse / reactor flash
      .to(
        logoRef.current,
        {
          filter: 'blur(0px) brightness(1.6) drop-shadow(0 0 60px rgba(56, 189, 248, 1))',
          duration: 0.25,
          yoyo: true,
          repeat: 1,
          ease: 'power2.inOut',
        },
        '-=0.3',
      )
      // Hold for dramatic awe
      .to({}, { duration: 1.0 });

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  const handleSkip = () => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        scale: 1.05,
        duration: 0.5,
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
      {/* Background Canvas for Cosmic Floating Embers */}
      <canvas ref={canvasRef} className="avengers-bg-canvas" />

      {/* Atmospheric Vignette & Radial Reactor Glow */}
      <div className="avengers-radial-glow" />
      <div className="avengers-vignette" />

      {/* Shockwave Ring */}
      <div ref={shockwaveRef} className="avengers-shockwave" />

      {/* Center 3D Logo Container */}
      <div className="avengers-logo-stage">
        <div ref={logoRef} className="avengers-logo-wrap">
          <img src={anantyaLogo} alt="ANANTYA" className="avengers-logo-img" />

          {/* Diagonal Metallic Shimmer Flare Overlay */}
          <div ref={flareRef} className="avengers-specular-flare" />
        </div>
      </div>

      {/* Skip Button in Bottom Corner */}
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

        .avengers-bg-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        .avengers-radial-glow {
          position: absolute;
          width: 800px;
          height: 800px;
          background: radial-gradient(circle at center, rgba(124, 58, 237, 0.28) 0%, rgba(56, 189, 248, 0.12) 40%, transparent 70%);
          filter: blur(80px);
          pointer-events: none;
          z-index: 2;
          animation: corePulse 5s ease-in-out infinite alternate;
        }

        @keyframes corePulse {
          0% { transform: scale(0.85); opacity: 0.6; }
          100% { transform: scale(1.15); opacity: 1; }
        }

        .avengers-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.85) 100%);
          pointer-events: none;
          z-index: 3;
        }

        .avengers-shockwave {
          position: absolute;
          width: 380px;
          height: 380px;
          border-radius: 50%;
          border: 2px solid rgba(56, 189, 248, 0.8);
          box-shadow: 0 0 40px rgba(134, 59, 255, 0.7), inset 0 0 20px rgba(56, 189, 248, 0.5);
          pointer-events: none;
          z-index: 4;
        }

        .avengers-logo-stage {
          position: relative;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          perspective: 1200px;
        }

        .avengers-logo-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-style: preserve-3d;
          overflow: hidden;
          border-radius: 12px;
          padding: 1rem;
        }

        .avengers-logo-img {
          width: min(85vw, 680px);
          height: auto;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 15px 35px rgba(0, 0, 0, 0.9));
        }

        /* Metallic shine sweep across the logo */
        .avengers-specular-flare {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            115deg,
            transparent 35%,
            rgba(255, 255, 255, 0.45) 48%,
            rgba(165, 243, 252, 0.95) 50%,
            rgba(255, 255, 255, 0.45) 52%,
            transparent 65%
          );
          pointer-events: none;
          mix-blend-mode: color-dodge;
        }

        .avengers-skip-btn {
          position: absolute;
          bottom: 2.2rem;
          right: 2.5rem;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #94a3b8;
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 0.55rem 1.1rem;
          border-radius: 9999px;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: all 0.25s ease;
        }

        .avengers-skip-btn:hover {
          color: #ffffff;
          background: rgba(134, 59, 255, 0.25);
          border-color: rgba(167, 139, 250, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 0 15px rgba(134, 59, 255, 0.4);
        }
      `}</style>
    </div>
  );
};

export default AvengersIntro;
