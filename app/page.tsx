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
                  background: 'rgba(255, 107, 53, 0.1)',
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

          {/* Wine Card */}
          <Link href="/wine" style={{ textDecoration: 'none' }}>
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
                  background: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 와인병 아이콘 */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="10" y1="2" x2="14" y2="2" />
                    <line x1="10" y1="2" x2="10" y2="8" />
                    <line x1="14" y1="2" x2="14" y2="8" />
                    <path d="M10 8 L8 10" />
                    <path d="M14 8 L16 10" />
                    <line x1="8" y1="10" x2="8" y2="20" />
                    <line x1="16" y1="10" x2="16" y2="20" />
                    <path d="M8 20 L8 21 L16 21 L16 20" />
                    <path d="M9 14 L15 14" opacity="0.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{ 
                    marginBottom: 'var(--space-2)',
                    fontWeight: 700,
                    fontSize: '1.5rem'
                  }}>
                    Wine Order
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.5
                  }}>
                    거래처와 품목 자동 인식
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* Glass Card */}
          <Link href="/glass" style={{ textDecoration: 'none' }}>
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
                  background: 'rgba(255, 107, 53, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* 와인잔 아이콘 */}
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="18" y2="3" />
                    <path d="M7 3 L7 8 C7 10 8.5 12 12 12 C15.5 12 17 10 17 8 L17 3" />
                    <line x1="12" y1="12" x2="12" y2="19" />
                    <line x1="9" y1="19" x2="15" y2="19" />
                    <path d="M9 19 L9 20 L15 20 L15 19" />
                  </svg>
                </div>
                <div>
                  <h2 className="heading-lg" style={{ 
                    marginBottom: 'var(--space-2)',
                    fontWeight: 700,
                    fontSize: '1.5rem'
                  }}>
                    Glass Order
                  </h2>
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-light)',
                    lineHeight: 1.5
                  }}>
                    와인잔 품목 빠른 발주
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
