'use client';

import { useEffect, useState } from 'react';
import type { DashboardStats } from '@/app/types/wine';
import type { AnalysisData } from '../types';
import { getCached, setCached, CACHE_TTL } from '@/app/lib/sessionCache';

type Cached = {
  stats: DashboardStats | null;
  analysis: AnalysisData | null;
  glassAnalysis: AnalysisData | null;
};

const CACHE_KEY = 'admin_dashboard:v1';

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [glassAnalysis, setGlassAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = new Date().toISOString().slice(0, 10);

    // 캐시 hit 시 즉시 표시 + 백그라운드 refresh
    const cached = getCached<Cached>(CACHE_KEY, CACHE_TTL.ADMIN_DASHBOARD);
    if (cached) {
      setStats(cached.stats);
      setAnalysis(cached.analysis);
      setGlassAnalysis(cached.glassAnalysis);
      setLoading(false);
    }

    Promise.all([
      fetch('/api/admin/dashboard').then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=wine&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=glass&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
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
        setCached(CACHE_KEY, next);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { stats, analysis, glassAnalysis, loading };
}
