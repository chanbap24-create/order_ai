'use client';

import Link from 'next/link';
import Card from './components/ui/Card';
import Button from './components/ui/Button';

export default function Home() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)'
    }}>
      <div style={{
        maxWidth: '900px',
        width: '100%'
      }}>
        {/* Hero Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-12)'
        }}>
          <h1 className="heading-xl" style={{
            marginBottom: 'var(--space-4)',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #FF6B35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Order AI
          </h1>
          <p style={{
            fontSize: 'var(--text-xl)',
            color: 'var(--color-text-light)',
            fontWeight: 400,
            letterSpacing: '-0.014em'
          }}>
            와인 & 와인잔 발주를 쉽고 빠르게
          </p>
        </div>

        {/* Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-8)'
        }}>
          {/* Wine Card */}
          <Card hover>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-6)'
            }}>
              <div>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                    <path d="M8 2h8l1 9c0 3-2 5-5 5s-5-2-5-5l1-9z" />
                    <path d="M12 16v6" />
                    <path d="M8 22h8" />
                  </svg>
                </div>
                <h2 className="heading-sm" style={{ marginBottom: 'var(--space-2)' }}>
                  와인 발주
                </h2>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-light)',
                  lineHeight: 1.6
                }}>
                  거래처와 품목을 자동으로 인식하고<br />발주 메시지를 생성합니다
                </p>
              </div>
              
              <Link href="/wine" style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ width: '100%' }}>
                  시작하기
                </Button>
              </Link>
            </div>
          </Card>

          {/* Glass Card */}
          <Card hover>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-6)'
            }}>
              <div>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2">
                    <path d="M6 2l6 18h4l6-18z" />
                    <path d="M5 2h14" />
                  </svg>
                </div>
                <h2 className="heading-sm" style={{ marginBottom: 'var(--space-2)' }}>
                  와인잔 발주
                </h2>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-light)',
                  lineHeight: 1.6
                }}>
                  와인잔 품목과 수량을 빠르게<br />확인하고 발주할 수 있습니다
                </p>
              </div>
              
              <Link href="/glass" style={{ textDecoration: 'none' }}>
                <Button variant="outline" style={{ width: '100%' }}>
                  시작하기
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Features */}
        <Card>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-6)'
          }}>
            <div>
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-2)'
              }}>
                자동 인식
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-light)',
                lineHeight: 1.6
              }}>
                거래처명 자동 인식<br />오타 허용 (70% 유사도)
              </p>
            </div>

            <div>
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-2)'
              }}>
                품목 선택
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-light)',
                lineHeight: 1.6
              }}>
                최근 거래 품목<br />빠른 선택 가능
              </p>
            </div>

            <div>
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-2)'
              }}>
                학습 기능
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-light)',
                lineHeight: 1.6
              }}>
                자주 사용하는 거래처<br />자동 학습 및 확정
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
