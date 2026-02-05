'use client';

import { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AdminPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSync = async () => {
    if (!confirm('재고 DB를 동기화하시겠습니까?\n\n이 작업은 약 10-20초 정도 소요됩니다.')) {
      return;
    }

    setIsSyncing(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/sync-inventory', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '동기화 실패');
      }

      setResult(data);
      alert('✅ 동기화 완료!\n\nCDV: ' + data.stats.cdv_items + '개\nDL: ' + data.stats.dl_items + '개');
    } catch (err) {
      const message = err instanceof Error ? err.message : '동기화 중 오류 발생';
      setError(message);
      alert('❌ ' + message);
    } finally {
      setIsSyncing(false);
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/sync-inventory');
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 확인 실패');
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 70px)',
      padding: 'var(--space-6)',
      background: 'var(--color-background)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <div style={{
          marginBottom: 'var(--space-8)'
        }}>
          <h1 className="heading-xl" style={{
            marginBottom: 'var(--space-3)',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #FF6B35 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '2.5rem',
            fontWeight: 800
          }}>
            관리자
          </h1>
        </div>

        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            marginBottom: 'var(--space-4)'
          }}>
            📦 재고 DB 동기화
          </h2>
          
          <p style={{
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-light)',
            marginBottom: 'var(--space-6)',
            lineHeight: 1.6
          }}>
            Excel 파일의 데이터를 데이터베이스에 동기화합니다.
          </p>

          <div style={{
            display: 'flex',
            gap: 'var(--space-4)'
          }}>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? '🔄 동기화 중...' : '🔄 동기화 실행'}
            </Button>

            <Button
              onClick={checkStatus}
              disabled={isSyncing}
              style={{
                background: 'transparent',
                border: '2px solid var(--color-primary)',
                color: 'var(--color-primary)'
              }}
            >
              📊 상태 확인
            </Button>
          </div>
        </Card>

        {error && (
          <Card style={{ 
            marginBottom: 'var(--space-6)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{ color: '#ef4444' }}>❌ {error}</div>
          </Card>
        )}

        {result && (
          <Card>
            <h3 style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              marginBottom: 'var(--space-4)'
            }}>
              📊 결과
            </h3>

            {result.stats && (
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>CDV (와인)</span>
                  <span style={{ fontWeight: 700 }}>
                    {result.stats.cdv_items?.toLocaleString()}개
                  </span>
                </div>

                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>DL (글라스)</span>
                  <span style={{ fontWeight: 700 }}>
                    {result.stats.dl_items?.toLocaleString()}개
                  </span>
                </div>

                <div style={{
                  padding: 'var(--space-4)',
                  background: 'rgba(255, 107, 53, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  border: '2px solid var(--color-primary)'
                }}>
                  <span style={{ fontWeight: 600 }}>총 품목</span>
                  <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)' }}>
                    {result.stats.total?.toLocaleString()}개
                  </span>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
