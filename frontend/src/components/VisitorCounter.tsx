import React, { useState, useEffect } from 'react';
import './VisitorCounter.css';

interface VisitorCounterProps {
  isVisible?: boolean;
}

const STORAGE_KEY = 'anantya_site_visitor_count';
const VISITOR_ID_KEY = 'anantya_visitor_uuid';

function getOrCreateVisitorId(): string {
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    return vid;
  } catch {
    return 'v_temp_' + Math.random().toString(36).substring(2, 12);
  }
}

export const VisitorCounter: React.FC<VisitorCounterProps> = ({ isVisible = true }) => {
  const [displayCount, setDisplayCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const visitorId = getOrCreateVisitorId();
    const backendUrl =
      (typeof window !== 'undefined' && (window as any).__BACKEND_URL__) ||
      'http://localhost:8001';

    // Local cached count as instant placeholder
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const val = parseInt(stored, 10);
        if (!isNaN(val) && val > 0) setDisplayCount(val);
      }
    } catch {}

    // Send tracking ping to MongoDB backend
    async function trackVisit() {
      try {
        const res = await fetch(`${backendUrl}/api/visitors/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            visitor_id: visitorId,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            screen_resolution:
              typeof window !== 'undefined'
                ? `${window.screen.width}x${window.screen.height}`
                : '',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.total_visitors === 'number') {
            setDisplayCount(data.total_visitors);
            try {
              localStorage.setItem(STORAGE_KEY, data.total_visitors.toString());
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Visitor telemetry ping fallback:', err);
      }
    }

    trackVisit();

    return () => {
      isMounted = false;
    };
  }, []);


  return (
    <aside
      className={`visitor-counter-root ${isVisible ? 'is-visible' : ''}`}
      aria-label="Website visitor count"
    >
      <div className="visitor-hud-pill">
        {/* Glowing Radar Beacon */}
        <div className="visitor-beacon-wrap" title="Live telemetry active">
          <span className="beacon-ping" />
          <span className="beacon-core" />
        </div>

        {/* User Icon */}
        <div className="visitor-icon-wrap" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>

        {/* Counter Number Only */}
        <span className="visitor-number">
          {displayCount.toLocaleString()}
        </span>
      </div>
    </aside>
  );
};

export default VisitorCounter;
