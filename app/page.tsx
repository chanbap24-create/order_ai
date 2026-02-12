'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const cards = [
    {
      id: 'inventory',
      href: '/inventory',
      title: 'Inventory',
      subtitle: '재고 및 공급가 확인',
      desc: 'CDV · DL 실시간 재고 조회, 공급가/소비자가 확인',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      id: 'quote',
      href: '/quote',
      title: 'Quote',
      subtitle: '견적서 작성',
      desc: '거래처별 맞춤 견적서 생성 및 엑셀 출력',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: 'order',
      href: '/order',
      title: 'Order',
      subtitle: '와인 / 리델 발주',
      desc: 'AI 파싱 기반 자동 발주서 생성 시스템',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="9" y1="14" x2="15" y2="14" />
          <line x1="9" y1="18" x2="13" y2="18" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -10%); }
          30% { transform: translate(3%, -15%); }
          50% { transform: translate(12%, 9%); }
          70% { transform: translate(9%, 4%); }
          90% { transform: translate(-1%, 7%); }
        }
        .home-card-link {
          text-decoration: none;
          display: block;
        }
        .home-card {
          position: relative;
          padding: 32px 28px;
          border-radius: 16px;
          border: 1px solid rgba(90, 21, 21, 0.08);
          background: #ffffff;
          transition: all 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          overflow: hidden;
        }
        .home-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #5A1515, transparent);
          opacity: 0;
          transition: opacity 0.35s ease;
        }
        .home-card:hover {
          border-color: rgba(90, 21, 21, 0.18);
          box-shadow: 0 8px 32px -8px rgba(90, 21, 21, 0.12), 0 2px 8px -2px rgba(0,0,0,0.04);
          transform: translateY(-3px);
        }
        .home-card:hover::before {
          opacity: 1;
        }
        .home-card:hover .home-card-arrow {
          opacity: 1;
          transform: translateX(0);
        }
        .home-card-arrow {
          opacity: 0;
          transform: translateX(-6px);
          transition: all 0.3s ease;
        }
      `}</style>

      <div style={{
        display: 'flex',
        minHeight: 'calc(100vh - 80px)',
        fontFamily: "'DM Sans', -apple-system, sans-serif",
      }}>
        {/* ─── Dark Sidebar ─── */}
        <div style={{
          width: 360,
          minWidth: 360,
          background: '#1a1a2e',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 40px 40px',
        }}>
          {/* Grain overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            pointerEvents: 'none',
          }} />

          {/* Gradient accent */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
            background: 'radial-gradient(ellipse at 20% 20%, rgba(90, 21, 21, 0.15) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          {/* Branding */}
          <div style={{
            position: 'relative', zIndex: 1,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateX(0)' : 'translateX(-20px)',
            transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {/* Decorative line */}
            <div style={{
              width: 32, height: 1,
              background: 'linear-gradient(90deg, #5A1515, rgba(90,21,21,0.3))',
              marginBottom: 32,
            }} />

            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '2.6rem',
              fontWeight: 300,
              color: '#f0ece6',
              letterSpacing: '0.12em',
              lineHeight: 1.1,
              marginBottom: 12,
            }}>
              CAVE<br />DE VIN
            </h1>

            <div style={{
              width: 48, height: 1,
              background: 'linear-gradient(90deg, rgba(90,21,21,0.6), transparent)',
              marginBottom: 20,
            }} />

            <p style={{
              fontSize: '0.75rem',
              color: 'rgba(240, 236, 230, 0.4)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              Sales Automation
            </p>
          </div>

          {/* Bottom area */}
          <div style={{
            position: 'relative', zIndex: 1,
            opacity: mounted ? 1 : 0,
            transition: 'opacity 1s ease 0.4s',
          }}>
            <Link href="/admin" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.7rem',
              color: 'rgba(240, 236, 230, 0.25)',
              textDecoration: 'none',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 500,
              padding: '8px 0',
              transition: 'color 0.3s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(240, 236, 230, 0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240, 236, 230, 0.25)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Admin Console
            </Link>

            <div style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: '1px solid rgba(240, 236, 230, 0.06)',
              fontSize: '0.65rem',
              color: 'rgba(240, 236, 230, 0.15)',
              letterSpacing: '0.05em',
            }}>
              v2.0 &middot; Powered by AI
            </div>
          </div>
        </div>

        {/* ─── Bright Content Area ─── */}
        <div style={{
          flex: 1,
          background: '#fafaf8',
          padding: '60px 56px',
          overflowY: 'auto',
          position: 'relative',
        }}>
          {/* Subtle top gradient */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 200,
            background: 'linear-gradient(180deg, rgba(90, 21, 21, 0.02) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            maxWidth: 640,
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Section header */}
            <div style={{
              marginBottom: 48,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s',
            }}>
              <p style={{
                fontSize: '0.7rem',
                color: '#5A1515',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginBottom: 12,
              }}>
                Dashboard
              </p>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '1.8rem',
                fontWeight: 400,
                color: '#1a1a2e',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                marginBottom: 8,
              }}>
                무엇을 도와드릴까요?
              </h2>
              <p style={{
                fontSize: '0.85rem',
                color: '#8E8E93',
                lineHeight: 1.6,
              }}>
                재고 확인, 견적 작성, 발주 생성 중 선택하세요.
              </p>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {cards.map((card, i) => (
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
                      {/* Icon */}
                      <div style={{
                        width: 48, height: 48,
                        borderRadius: 12,
                        background: hoveredCard === card.id ? '#5A1515' : '#faf5f5',
                        border: hoveredCard === card.id ? 'none' : '1px solid rgba(90, 21, 21, 0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: hoveredCard === card.id ? '#f0ece6' : '#5A1515',
                        transition: 'all 0.35s ease',
                        flexShrink: 0,
                      }}>
                        {card.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <h3 style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#1a1a2e',
                            letterSpacing: '0.01em',
                          }}>
                            {card.title}
                          </h3>
                          <span className="home-card-arrow" style={{ color: '#5A1515', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </span>
                        </div>
                        <p style={{
                          fontSize: '0.8rem',
                          color: '#5A1515',
                          fontWeight: 500,
                          marginBottom: 4,
                          opacity: 0.7,
                        }}>
                          {card.subtitle}
                        </p>
                        <p style={{
                          fontSize: '0.78rem',
                          color: '#8E8E93',
                          lineHeight: 1.5,
                        }}>
                          {card.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Wine profile link */}
            <div style={{
              marginTop: 40,
              paddingTop: 24,
              borderTop: '1px solid rgba(26, 26, 46, 0.06)',
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.8s ease 0.7s',
            }}>
              <Link href="/wine" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.78rem',
                color: '#8E8E93',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#5A1515')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8E8E93')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 8l4 4-4 4" />
                  <path d="M3 12h18" />
                </svg>
                Wine Profiles
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
