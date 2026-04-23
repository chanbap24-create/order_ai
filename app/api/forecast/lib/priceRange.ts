export function getPriceRange(price: number) {
  if (price < 10000) return { label: '~1만', min: 0, max: 10000 };
  if (price < 20000) return { label: '1~2만', min: 10000, max: 20000 };
  if (price < 30000) return { label: '2~3만', min: 20000, max: 30000 };
  if (price < 50000) return { label: '3~5만', min: 30000, max: 50000 };
  if (price < 100000) return { label: '5~10만', min: 50000, max: 100000 };
  return { label: '10만~', min: 100000, max: 999999999 };
}
