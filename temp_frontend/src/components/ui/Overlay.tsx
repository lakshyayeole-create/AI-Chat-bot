import { useRef } from 'react';
import { gsap, useGSAP } from '../../lib/gsap';

interface OverlayProps {
  onAnimateCube?: () => void;
  onEnterExperience?: () => void;
}

export function Overlay({ onAnimateCube, onEnterExperience }: OverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.badge', {
        y: -20,
        opacity: 0,
        duration: 0.8,
        delay: 0.2,
      })
        .from(
          '.title',
          {
            y: 30,
            opacity: 0,
            duration: 1,
          },
          '-=0.5',
        )
        .from(
          '.description',
          {
            y: 20,
            opacity: 0,
            duration: 0.8,
          },
          '-=0.6',
        )
        .from(
          '.action-btn',
          {
            scale: 0.9,
            opacity: 0,
            duration: 0.6,
            stagger: 0.15,
          },
          '-=0.5',
        );
    },
    { scope: containerRef },
  );

  const handlePulse = () => {
    gsap.to('.action-btn', {
      scale: 1.05,
      yoyo: true,
      repeat: 1,
      duration: 0.2,
      ease: 'power2.inOut',
    });
    onAnimateCube?.();
  };

  return (
    <div ref={containerRef} className="overlay">
      <header className="overlay-header">
        <span className="badge">React + Three.js + GSAP</span>
      </header>

      <main className="overlay-content">
        <h1 className="title">
          Modern 3D & Animation <br /> Boilerplate
        </h1>
        <p className="description">
          A lightweight, high-performance foundation built with React, Three.js, and GSAP for fluid web experiences.
        </p>

        <div className="button-group">
          <button type="button" className="action-btn primary" onClick={onEnterExperience || handlePulse}>
            {onEnterExperience ? 'Enter 3D Experience' : 'Trigger GSAP Pulse'}
          </button>
        </div>
      </main>

      <footer className="overlay-footer">
        <p>Interactive 3D • Built for creative web development</p>
      </footer>
    </div>
  );
}

export default Overlay;
