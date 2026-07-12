// 레벨별 낙하 속도와 락 딜레이 (PRD 4.4, 4.6) — 튜닝값은 전부 여기서 관리

export const MAX_LEVEL = 20;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const SOFT_DROP_MULTIPLIER = 20;
// PRD: 레벨 20 ≈ 0.02초/칸 — 가이드라인 곡선의 하한으로 사용
export const MIN_FALL_INTERVAL_MS = 20;

/**
 * 레벨별 낙하 간격(ms/칸).
 * 표준 가이드라인 곡선 (0.8 - (level-1) * 0.007)^(level-1) 초를 따르며,
 * 레벨 1 = 1000ms, 하한 20ms로 클램프한다.
 */
export function fallIntervalMs(level: number): number {
  const l = Math.min(Math.max(level, 1), MAX_LEVEL);
  const seconds = Math.pow(0.8 - (l - 1) * 0.007, l - 1);
  return Math.max(MIN_FALL_INTERVAL_MS, Math.round(seconds * 1000));
}
