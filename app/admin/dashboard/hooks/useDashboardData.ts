'use client';

import { useEffect, useState } from 'react';
import type { DashboardStats } from '@/app/types/wine';
import type { AnalysisData } from '../types';
import { getCached, setCached, CACHE_TTL } from '@/app/lib/sessionCache';
import { thisYear } from '@/app/lib/dateRangePresets';

type Cached = {
  stats: DashboardStats | null;
  analysis: AnalysisData | null;
  glassAnalysis: AnalysisData | null;
};

/**
 * 재고분석 대시보드 데이터 훅.
 *  - stats (재고 스냅샷) 는 날짜 무관
 *  - analysis / glassAnalysis (매출) 는 startDate/endDate 구간에 의존
 *  - 기본값: 올해 1/1 ~ 오늘 (YTD)
 *  - sessionStorage 캐시 60초, 날짜별 key
 */
export function useDashboardData(startDate?: string, endDate?: string) {
  const defaults = thisYear();
  const sd = startDate || defaults.startDate;
  const ed = endDate || defaults.endDate;
  const cacheKey = `admin_dashboard:${sd}|${ed}`;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [glassAnalysis, setGlassAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 캐시 hit 시 즉시 표시 + 백그라운드 refresh
    const cached = getCached<Cached>(cacheKey, CACHE_TTL.ADMIN_DASHBOARD);
    if (cached) {
      setStats(cached.stats);
      setAnalysis(cached.analysis);
      setGlassAnalysis(cached.glassAnalysis);
      setLoading(false);
    } else {
      setLoading(true);
    }

    Promise.all([
      fetch('/api/admin/dashboard').then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=wine&startDate=${sd}&endDate=${ed}`).then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=glass&startDate=${sd}&endDate=${ed}`).then(r => r.json()),
    ])
      .then(([dashRes, wineRes, glassRes]) => {
        const next: Cached = {
          stats: dashRes.success ? dashRes.data : cached?.stats ?? null,
          analysis: wineRes.success ? wineRes : cached?.analysis ?? null,
          glassAnalysis: glassRes.success ? glassRes : cached?.glassAnalysis ?? null,
        };
        setStats(next.stats);
        setAnalysis(next.analysis);
        setGlassAnalysis(next.glassAnalysis);
        setCached(cacheKey, next);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sd, ed, cacheKey]);

  return { stats, analysis, glassAnalysis, loading };
}
