/**
 * @deprecated app/lib/sessionCache.ts 로 이동. 기존 import 호환을 위해 re-export 유지.
 */
export {
  getCached, setCached, CACHE_TTL,
  subscribeDataInvalidation, clearCacheByPrefix,
} from "@/app/lib/sessionCache";
