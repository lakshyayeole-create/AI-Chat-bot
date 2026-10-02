import React, { useRef, useState } from 'react';
import { gsap, useGSAP } from '../../lib/gsap';

interface IntroOverlayProps {
  onEnter: () => void;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ onEnter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  useGSAP(
    () => {
      // Intro timeline animation
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.intro-logo-wrap', {
        scale: 0.6,
        opacity: 0,
        filter: 'blur(12px)',
        duration: 1.2,
        ease: 'back.out(1.7)',
      })
        .from(
          '.intro-badge',
          {
            y: -20,
            opacity: 0,
            duration: 0.8,
          },
          '-=0.7',
        )
        .from(
          '.intro-title',
          {
            y: 30,
            opacity: 0,
            duration: 1,
          },
          '-=0.6',
        )
        .from(
          '.intro-desc',
          {
            y: 20,
            opacity: 0,
            duration: 0.8,
          },
          '-=0.7',
        )
        .from(
          '.intro-action-btn',
          {
            scale: 0.85,
            opacity: 0,
            duration: 0.7,
            stagger: 0.15,
            ease: 'back.out(2)',
          },
          '-=0.5',
        );
    },
    { scope: containerRef },
  );

  const handleStart = () => {
    if (isExiting) return;
    setIsExiting(true);

    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        scale: 1.05,
        filter: 'blur(8px)',
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          onEnter();
        },
      });
    } else {
      onEnter();
    }
  };

  return (
    <div ref={containerRef} className="intro-container">
      <div className="intro-glow-bg" />

      {/* Center Hero Intro Card */}
      <div className="intro-card">
        {/* Animated Brand Logo */}
        <div className="intro-logo-wrap">
          <img src="/assets/ANANTYA.webp" alt="Anantya Logo" className="intro-logo-svg" />
          <div className="intro-logo-pulse" />
        </div>

        <div className="intro-badge">
          <span className="badge-dot" />
          <span>ANANTYA • 2026</span>
        </div>

        <h1 className="intro-title">
          ANANTYA
        </h1>

        <p className="intro-desc">
          Step into the next-generation interactive 3D dimension.
          Engineered with precision, robotics, and cinematic transitions.
        </p>

        <div className="intro-button-group">
          <button type="button" className="intro-action-btn primary" onClick={handleStart}>
            <span>INITIALIZE ASSEMBLY</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        </div>
      </div>

      {/* Subtle Footer */}
      <footer className="intro-footer">
        <p>Interactive 3D Experience • Click to initialize suit assembly</p>
      </footer>

      <style>{`
        .intro-container {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 45%, #15102a 0%, #06070c 85%);
          overflow: hidden;
          padding: 2rem;
          user-select: none;
        }

        .intro-glow-bg {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(134, 59, 255, 0.22) 0%, rgba(71, 191, 255, 0.08) 50%, transparent 70%);
          filter: blur(60px);
          pointer-events: none;
          animation: slowPulse 6s ease-in-out infinite alternate;
        }

        @keyframes slowPulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          100% { transform: scale(1.15); opacity: 1; }
        }

        .intro-card {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 620px;
        }

        .intro-logo-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .intro-logo-svg {
          width: 84px;
          height: 84px;
          filter: drop-shadow(0 0 25px rgba(134, 59, 255, 0.75));
          animation: floatLogo 4s ease-in-out infinite alternate;
        }

        @keyframes floatLogo {
          0% { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(-8px) rotate(2deg); }
        }

        .intro-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 1rem;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c4b5fd;
          background: rgba(134, 59, 255, 0.15);
          border: 1px solid rgba(167, 139, 250, 0.35);
          border-radius: 9999px;
          backdrop-filter: blur(12px);
          margin-bottom: 1.25rem;
          box-shadow: 0 0 20px rgba(134, 59, 255, 0.2);
        }

        .badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 10px #38bdf8;
          animation: blink 2s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        .intro-title {
          font-size: clamp(2.8rem, 6vw, 4.6rem);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: 0.08em;
          background: linear-gradient(135deg, #ffffff 20%, #c4b5fd 60%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          text-shadow: 0 10px 40px rgba(134, 59, 255, 0.3);
        }

        .intro-desc {
          font-size: clamp(1rem, 1.6vw, 1.15rem);
          line-height: 1.65;
          color: #94a3b8;
          margin-bottom: 2.2rem;
          max-width: 520px;
        }

        .intro-button-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.2rem;
        }

        .intro-action-btn {
          cursor: pointer;
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 0.95rem 2.2rem;
          border-radius: 12px;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
          color: #ffffff;
          box-shadow: 0 4px 25px rgba(124, 58, 237, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.25);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .intro-action-btn:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 8px 35px rgba(124, 58, 237, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.4);
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
        }

        .intro-action-btn:active {
          transform: translateY(-1px) scale(0.99);
        }

        .intro-footer {
          position: absolute;
          bottom: 2rem;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          color: #64748b;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default IntroOverlay;
