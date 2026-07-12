import { describe, expect, it } from 'vitest';
import { fallIntervalMs, MIN_FALL_INTERVAL_MS } from '../src/core/gravity';

describe('fallIntervalMs', () => {
  it('레벨 1은 1000ms/칸이다', () => {
    expect(fallIntervalMs(1)).toBe(1000);
  });

  it('레벨 2는 가이드라인 곡선을 따른다 (793ms)', () => {
    expect(fallIntervalMs(2)).toBe(793);
  });

  it('레벨 20은 하한 20ms(≈0.02초/칸)로 클램프된다', () => {
    expect(fallIntervalMs(20)).toBe(MIN_FALL_INTERVAL_MS);
  });

  it('레벨이 오를수록 간격이 늘어나지 않는다 (단조 감소)', () => {
    for (let level = 2; level <= 20; level++) {
      expect(fallIntervalMs(level)).toBeLessThanOrEqual(fallIntervalMs(level - 1));
    }
  });

  it('범위 밖 레벨은 1~20으로 클램프된다', () => {
    expect(fallIntervalMs(0)).toBe(1000);
    expect(fallIntervalMs(99)).toBe(fallIntervalMs(20));
  });
});
