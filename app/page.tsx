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
            background: 'linear-gradient(135deg, #1A1A1A 0%, #FF6B35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '3rem',
            fontWeight: 800
          }}>
            Sales Desk
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
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-8)',
          marginBottom: 'var(--space-16)',
          flexWrap: 'wrap'
        }}>
          {/* Wine Card */}
          <Link href="/wine" style={{ textDecoration: 'none', width: '380px' }}>
            <Card hover>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 'var(--space-8)',
                gap: 'var(--space-6)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 와인병 아이콘 - 실제 병 형태 */}
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {/* 병 입구 */}
                    <line x1="10" y1="2" x2="14" y2="2" />
                    {/* 병 목 */}
                    <line x1="10" y1="2" x2="10" y2="8" />
                    <line x1="14" y1="2" x2="14" y2="8" />
                    {/* 병 어깨 */}
                    <path d="M10 8 L8 10" />
                    <path d="M14 8 L16 10" />
                    {/* 병 몸통 */}
                    <line x1="8" y1="10" x2="8" y2="20" />
                    <line x1="16" y1="10" x2="16" y2="20" />
                    {/* 병 바닥 */}
                    <path d="M8 20 L8 21 L16 21 L16 20" />
                    {/* 병 내부 액체 표시 */}
                    <path d="M9 14 L15 14" opacity="0.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{ 
                    marginBottom: 'var(--space-3)',
                    fontWeight: 700,
                    fontSize: '1.75rem'
                  }}>
                    Wine Order
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.6,
                    maxWidth: '280px',
                    margin: '0 auto'
                  }}>
                    거래처와 품목을 자동으로 인식하고<br />발주 메시지를 생성합니다
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* Glass Card */}
          <Link href="/glass" style={{ textDecoration: 'none', width: '380px' }}>
            <Card hover>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: 'var(--space-8)',
                gap: 'var(--space-6)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 와인잔 아이콘 - 명확한 보울+스템+베이스 */}
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {/* 잔 테두리 */}
                    <line x1="6" y1="3" x2="18" y2="3" />
                    {/* 잔 보울 (볼) */}
                    <path d="M7 3 L7 8 C7 10 8.5 12 12 12 C15.5 12 17 10 17 8 L17 3" />
                    {/* 스템 (줄기) */}
                    <line x1="12" y1="12" x2="12" y2="19" />
                    {/* 베이스 (받침) */}
                    <line x1="9" y1="19" x2="15" y2="19" />
                    <path d="M9 19 L9 20 L15 20 L15 19" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{ 
                    marginBottom: 'var(--space-3)',
                    fontWeight: 700,
                    fontSize: '1.75rem'
                  }}>
                    Glass Order
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.6,
                    maxWidth: '280px',
                    margin: '0 auto'
                  }}>
                    와인잔 품목과 수량을 빠르게<br />확인하고 발주할 수 있습니다
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Features Section */}
        <Card>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-8)',
            padding: 'var(--space-4)'
          }}>
            {/* 자동 인식 */}
            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-3)'
              }}>
                자동 인식
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-light)',
                lineHeight: 1.6,
                maxWidth: '200px'
              }}>
                거래처명 자동 인식<br />오타 허용 (70% 유사도)
              </p>
            </div>

            {/* 품목 선택 */}
            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-3)'
              }}>
                품목 선택
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-light)',
                lineHeight: 1.6,
                maxWidth: '200px'
              }}>
                최근 거래 품목<br />빠른 선택 가능
              </p>
            </div>

            {/* 학습 기능 */}
            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: 600,
                color: 'var(--color-primary)',
                marginBottom: 'var(--space-3)'
              }}>
                학습 기능
              </div>
              <p style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-light)',
                lineHeight: 1.6,
                maxWidth: '200px'
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
