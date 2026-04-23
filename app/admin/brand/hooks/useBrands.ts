import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BrandWithWineCount } from "@/app/types/wine";

/** 브랜드 목록 + 검색 (debounced) + 국가 필터 */
export function useBrands() {
  const [brands, setBrands] = useState<BrandWithWineCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // search 300ms debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (countryFilter) params.set("country", countryFilter);
    const res = await fetch(`/api/admin/brands?${params}`);
    if (res.ok) setBrands(await res.json());
    setLoading(false);
  }, [debouncedSearch, countryFilter]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const countries = useMemo(
    () => [...new Set(brands.map((b) => b.country).filter(Boolean))] as string[],
    [brands],
  );

  return {
    brands, loading,
    searchQuery, setSearchQuery,
    countryFilter, setCountryFilter,
    countries, loadBrands,
  };
}
