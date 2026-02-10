'use client';

import Link from 'next/link';
import Card from './components/ui/Card';

export default function Home() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      background: 'var(--color-background)'
    }}>
      <div style={{
        maxWidth: '1100px',
        width: '100%'
      }}>
        {/* Hero Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-16)'
        }}>
          <h1 className="heading-xl" style={{
            marginBottom: 'var(--space-4)',
            color: '#8B4049',
            fontSize: '3rem',
            fontWeight: 700,
            letterSpacing: '0.05em'
          }}>
            CAVE DE VIN
          </h1>
          <p style={{
            fontSize: 'var(--text-xl)',
            color: 'var(--color-text-light)',
            fontWeight: 400,
            letterSpacing: '-0.014em'
          }}>
            Internal Sales Automation Tool
          </p>
        </div>

        {/* Main Action Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-6)',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Inventory Card */}
          <Link href="/inventory" style={{ textDecoration: 'none' }}>
            <Card hover>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 'var(--space-6)',
                gap: 'var(--space-4)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(139, 21, 56, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 재고 박스 아이콘 */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{ 
                    marginBottom: 'var(--space-2)',
                    fontWeight: 700,
                    fontSize: '1.5rem'
                  }}>
                    Inventory
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.5
                  }}>
                    재고 및 공급가 확인
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* Quote Card */}
          <Link href="/quote" style={{ textDecoration: 'none' }}>
            <Card hover>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 'var(--space-6)',
                gap: 'var(--space-4)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(139, 21, 56, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 견적서 아이콘 */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{
                    marginBottom: 'var(--space-2)',
                    fontWeight: 700,
                    fontSize: '1.5rem'
                  }}>
                    Quote
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.5
                  }}>
                    견적서 작성
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* Order Card */}
          <Link href="/order" style={{ textDecoration: 'none' }}>
            <Card hover>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 'var(--space-6)',
                gap: 'var(--space-4)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(139, 21, 56, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 클립보드 발주 아이콘 */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    <line x1="9" y1="10" x2="15" y2="10" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                    <line x1="9" y1="18" x2="13" y2="18" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{
                    marginBottom: 'var(--space-2)',
                    fontWeight: 700,
                    fontSize: '1.5rem'
                  }}>
                    Order
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.5
                  }}>
                    와인 / 리델 발주
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Admin Link */}
        <div style={{
          textAlign: 'center',
          marginTop: 'var(--space-16)',
        }}>
          <Link href="/admin" style={{
            fontSize: 'var(--text-xs)',
            color: '#999',
            textDecoration: 'none',
            letterSpacing: '0.05em',
          }}>
            ADMIN
          </Link>
        </div>
      </div>
    </div>
  );
}
