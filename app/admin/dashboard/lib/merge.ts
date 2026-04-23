import type { NamedRev, NamedVal } from '../types';

export function mergeRevArrays(a: NamedRev[], b: NamedRev[]): NamedRev[] {
  const m = new Map<string, number>();
  for (const x of a) m.set(x.name, (m.get(x.name) || 0) + x.revenue);
  for (const x of b) m.set(x.name, (m.get(x.name) || 0) + x.revenue);
  return Array.from(m.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a2, b2) => b2.revenue - a2.revenue);
}

export function mergeValArrays(a: NamedVal[], b: NamedVal[]): NamedVal[] {
  const m = new Map<string, number>();
  for (const x of a) m.set(x.name, (m.get(x.name) || 0) + x.value);
  for (const x of b) m.set(x.name, (m.get(x.name) || 0) + x.value);
  return Array.from(m.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a2, b2) => b2.value - a2.value);
}
