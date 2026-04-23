/**
 * 서버리스 환경용 단순 인메모리 rate limit.
 *
 * 한계:
 *  - Vercel은 각 serverless 인스턴스가 독립적이라 완벽한 분산 rate limit은 불가능.
 *  - 하지만 warm 인스턴스에서는 단일 IP의 단기 스팸은 효과적으로 막음.
 *  - 진짜 방어는 Vercel KV / Upstash Redis 같은 외부 저장소 필요.
 *
 * 사용: Edge Runtime (middleware)에서도 동작하도록 globalThis로 공유.
 */

type Bucket = { count: number; resetAt: number };

// 전역 맵 재사용 (module hot reload 대응)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
const buckets: Map<string, Bucket> = g.__rateLimitBuckets ?? new Map();
g.__rateLimitBuckets = buckets;

/**
 * @returns true = 허용, false = 차단
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetIn: bucket.resetAt - now };
}

/**
 * 주기적으로 만료된 버킷 정리 (메모리 누수 방지).
 * middleware는 매 요청마다 호출하므로 일정 확률로만 수행.
 */
export function maybeCleanup(probability = 0.01) {
  if (Math.random() > probability) return;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}
