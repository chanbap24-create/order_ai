import { useCallback, useEffect, useState } from "react";
import type { BrandWithWineCount } from "@/app/types/wine";

/** 브랜드 목록 + 검색 + 국가 필터 */
export function useBrands() {
  const [brands, setBrands] = useState<BrandWithWineCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const loadBrands = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (countryFilter) params.set("country", countryFilter);
    const res = await fetch(`/api/admin/brands?${params}`);
    if (res.ok) setBrands(await res.json());
    setLoading(false);
  }, [searchQuery, countryFilter]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const countries = [...new Set(brands.map((b) => b.country).filter(Boolean))] as string[];

  return {
    brands, loading,
    searchQuery, setSearchQuery,
    countryFilter, setCountryFilter,
    countries, loadBrands,
  };
}
