import React, { useState } from 'react';

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  year: string;
  image: string;
  tag: string;
  stats?: string;
}

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: 'g1',
    title: 'EDM Pro-Night & Laser Arena',
    category: 'concerts',
    year: '2025',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1000&q=80',
    tag: 'PRO-NIGHT',
    stats: '5,000+ Attendees',
  },
  {
    id: 'g2',
    title: 'Autonomous Robotics Grand Prix',
    category: 'robotics',
    year: '2025',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1000&q=80',
    tag: 'ROBOTICS',
    stats: '48 Battling Bots',
  },
  {
    id: 'g3',
    title: '36-Hour Hackathon Showdown',
    category: 'hackathons',
    year: '2025',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1000&q=80',
    tag: 'HACKATHON',
    stats: '120+ Teams',
  },
  {
    id: 'g4',
    title: 'Battle of the Bands Finale',
    category: 'concerts',
    year: '2024',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1000&q=80',
    tag: 'MUSIC',
    stats: '16 Rock Bands',
  },
  {
    id: 'g5',
    title: 'National Street Dance Clash',
    category: 'cultural',
    year: '2024',
    image: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1000&q=80',
    tag: 'DANCE',
    stats: '24 Dance Crews',
  },
  {
    id: 'g6',
    title: 'Cybersecurity Capture The Flag',
    category: 'hackathons',
    year: '2024',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1000&q=80',
    tag: 'CYBERSECURITY',
    stats: '300+ Hackers',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'ALL HIGHLIGHTS' },
  { id: 'concerts', label: 'PRO-NIGHTS' },
  { id: 'robotics', label: 'ROBOTICS' },
  { id: 'hackathons', label: 'HACKATHONS' },
  { id: 'cultural', label: 'CULTURAL' },
];

export const GallerySection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredItems =
    activeCategory === 'all'
      ? GALLERY_ITEMS
      : GALLERY_ITEMS.filter((item) => item.category === activeCategory);

  return (
    <div className="gallery-inner-container">
      {/* ── Section Header ── */}
      <div className="gallery-header">
        <div className="gallery-badge">
          <span className="gallery-pulse-dot" />
          <span className="gallery-badge-text">QUANTUM ARCHIVES • MULTIVERSE VAULT</span>
        </div>

        <h2 className="gallery-title">
          CHRONICLES OF <span className="gallery-highlight">GLORY</span>
        </h2>

        <p className="gallery-subtitle">
          Immortalized moments from the proving grounds of Anantya. From 36-hour hackathons and crushing combat robots to electrifying pro-nights under Asgardian skies.
        </p>

        {/* ── Category Filters ── */}
        <div className="gallery-filter-bar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`gallery-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Image / Card Showcase Grid ── */}
      <div className="gallery-grid">
        {filteredItems.map((item) => (
          <div key={item.id} className="gallery-card">
            <div className="gallery-card-img-wrap">
              <img src={item.image} alt={item.title} className="gallery-card-img" loading="lazy" />
              <div className="gallery-card-overlay" />
              <div className="gallery-tag-pill">{item.tag}</div>
              <div className="gallery-year-badge">{item.year}</div>
            </div>

            <div className="gallery-card-info">
              <h3 className="gallery-card-title">{item.title}</h3>
              {item.stats && <span className="gallery-card-stats">{item.stats}</span>}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .gallery-inner-container {
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
          padding: clamp(3rem, 7vh, 6rem) clamp(1.2rem, 3.5vw, 3.5rem);
          position: relative;
          z-index: 10;
          color: #ffffff;
        }

        .gallery-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: clamp(2.5rem, 5vh, 4rem);
        }

        .gallery-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.35rem 0.95rem;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 9999px;
          margin-bottom: 1.2rem;
        }

        .gallery-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: pulseGreen 1.8s infinite;
        }

        @keyframes pulseGreen {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }

        .gallery-badge-text {
          font-family: 'Inter', monospace;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: #6ee7b7;
        }

        .gallery-title {
          font-size: clamp(2.2rem, 4.5vw, 3.8rem);
          font-weight: 900;
          letter-spacing: -0.02em;
          margin: 0 0 1rem 0;
          text-shadow: 0 0 40px rgba(16, 185, 129, 0.25);
        }

        .gallery-highlight {
          background: linear-gradient(135deg, #10b981 0%, #34d399 50%, #fbbf24 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gallery-subtitle {
          font-size: clamp(0.92rem, 1.1vw, 1.05rem);
          max-width: 680px;
          color: #94a3b8;
          line-height: 1.65;
          margin: 0 0 2rem 0;
        }

        .gallery-filter-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .gallery-filter-btn {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 0.55rem 1.15rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .gallery-filter-btn:hover {
          color: #ffffff;
          border-color: rgba(16, 185, 129, 0.45);
          transform: translateY(-2px);
        }

        .gallery-filter-btn.active {
          color: #10b981;
          background: rgba(16, 185, 129, 0.16);
          border-color: rgba(16, 185, 129, 0.6);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.22);
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
          gap: 1.8rem;
        }

        .gallery-card {
          background: rgba(8, 14, 28, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.35s ease;
          position: relative;
        }

        .gallery-card:hover {
          transform: translateY(-6px);
          border-color: rgba(16, 185, 129, 0.45);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.75), 0 0 30px rgba(16, 185, 129, 0.18);
        }

        .gallery-card-img-wrap {
          position: relative;
          width: 100%;
          height: 220px;
          overflow: hidden;
        }

        .gallery-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
        }

        .gallery-card:hover .gallery-card-img {
          transform: scale(1.06);
        }

        .gallery-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 40%, rgba(8, 14, 28, 0.95) 100%);
        }

        .gallery-tag-pill {
          position: absolute;
          top: 14px;
          left: 14px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          background: rgba(8, 14, 28, 0.85);
          border: 1px solid rgba(16, 185, 129, 0.45);
          color: #6ee7b7;
          backdrop-filter: blur(8px);
        }

        .gallery-year-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.1);
          color: #f1f5f9;
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(8px);
        }

        .gallery-card-info {
          padding: 1.25rem 1.4rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .gallery-card-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0;
          color: #f8fafc;
        }

        .gallery-card-stats {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .gallery-inner-container {
            padding: 3.5rem 1.1rem 5rem;
          }
          .gallery-grid {
            grid-template-columns: 1fr;
            gap: 1.25rem;
          }
          .gallery-card-img-wrap {
            height: 195px;
          }
          .gallery-title {
            font-size: clamp(1.85rem, 6.5vw, 2.5rem);
          }
          .gallery-filter-bar {
            display: flex;
            flex-wrap: nowrap;
            justify-content: flex-start;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            width: calc(100% + 2.2rem);
            margin-left: -1.1rem;
            padding: 0 1.1rem 0.5rem;
            gap: 0.5rem;
          }
          .gallery-filter-bar::-webkit-scrollbar {
            display: none;
          }
          .gallery-filter-btn {
            flex-shrink: 0;
            white-space: nowrap;
            padding: 0.55rem 1.05rem;
            min-height: 40px;
            font-size: 0.72rem;
            touch-action: manipulation;
          }
          .gallery-filter-btn:active {
            transform: scale(0.96);
          }
        }
      `}</style>
    </div>
  );
};

export default GallerySection;
