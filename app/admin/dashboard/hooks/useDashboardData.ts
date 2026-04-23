'use client';

import { useEffect, useState } from 'react';
import type { DashboardStats } from '@/app/types/wine';
import type { AnalysisData } from '../types';

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [glassAnalysis, setGlassAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = new Date().toISOString().slice(0, 10);

    Promise.all([
      fetch('/api/admin/dashboard').then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=wine&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
      fetch(`/api/admin/client-analysis?type=glass&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
    ])
      .then(([dashRes, wineRes, glassRes]) => {
        if (dashRes.success) setStats(dashRes.data);
        if (wineRes.success) setAnalysis(wineRes);
        if (glassRes.success) setGlassAnalysis(glassRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { stats, analysis, glassAnalysis, loading };
}
