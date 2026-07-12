'use client';

import Link from 'next/link';
import { useState } from 'react';
import { HOME_CARDS } from './constants';

export function HomeCards({ mounted }: { mounted: boolean }) {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {HOME_CARDS.map((card, i) => (
        <Link
          key={card.id}
          href={card.href}
          className="home-card-link"
          onMouseEnter={() => setHoveredCard(card.id)}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div
            className="home-card"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(24px)',
              transition: `all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease ${0.3 + i * 0.1}s, transform 0.6s ease ${0.3 + i * 0.1}s`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: hoveredCard === card.id ? 'var(--action)' : 'var(--surface-muted)',
                border: hoveredCard === card.id ? 'none' : '1px solid var(--action-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: hoveredCard === card.id ? '#ffffff' : 'var(--action)',
                transition: 'all 0.35s ease',
                flexShrink: 0,
              }}>
                {card.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h3 style={{
                    fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)',

                    letterSpacing: '-0.01em',
                  }}>
                    {card.title}
                  </h3>
                  <span className="home-card-arrow" style={{ color: 'var(--action)', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </div>
                <p style={{
                  fontSize: '0.8rem', color: 'var(--action)',
                  fontWeight: 500, marginBottom: 4, opacity: 0.7,
                }}>
                  {card.subtitle}
                </p>
                <p style={{
                  fontSize: '0.78rem', color: '#8E8E93', lineHeight: 1.5,
                }}>
                  {card.desc}
                </p>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
