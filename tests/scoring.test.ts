import { describe, expect, it } from 'vitest';
import {
  baseClearScore,
  isDifficultClear,
  levelForLines,
  ScoreTracker,
} from '../src/core/scoring';

describe('baseClearScore (PRD 4.5 점수표)', () => {
  it('일반 클리어: 싱글~테트리스', () => {
    expect(baseClearScore({ lines: 1, tspin: false }, 1)).toBe(100);
    expect(baseClearScore({ lines: 2, tspin: false }, 1)).toBe(300);
    expect(baseClearScore({ lines: 3, tspin: false }, 1)).toBe(500);
    expect(baseClearScore({ lines: 4, tspin: false }, 1)).toBe(800);
  });

  it('T-스핀 클리어: 싱글/더블/트리플', () => {
    expect(baseClearScore({ lines: 1, tspin: true }, 1)).toBe(800);
    expect(baseClearScore({ lines: 2, tspin: true }, 1)).toBe(1200);
    expect(baseClearScore({ lines: 3, tspin: true }, 1)).toBe(1600);
  });

  it('레벨 배수가 적용된다', () => {
    expect(baseClearScore({ lines: 4, tspin: false }, 5)).toBe(4000);
    expect(baseClearScore({ lines: 2, tspin: true }, 3)).toBe(3600);
  });
});

describe('isDifficultClear (백투백 대상)', () => {
  it('테트리스와 라인을 지운 T-스핀만 해당한다', () => {
    expect(isDifficultClear({ lines: 4, tspin: false })).toBe(true);
    expect(isDifficultClear({ lines: 1, tspin: true })).toBe(true);
    expect(isDifficultClear({ lines: 3, tspin: false })).toBe(false);
    expect(isDifficultClear({ lines: 0, tspin: true })).toBe(false);
  });
});

describe('ScoreTracker — 백투백', () => {
  it('연속 어려운 클리어에 ×1.5가 적용된다', () => {
    const t = new ScoreTracker();
    const first = t.onLock({ lines: 4, tspin: false }, 1);
    expect(first.points).toBe(800);
    expect(first.backToBack).toBe(false); // 첫 번째는 보너스 없음

    // 콤보를 끊기 위해 클리어 없는 고정을 사이에 둔다 (B2B는 유지됨)
    t.onLock({ lines: 0, tspin: false }, 1);

    const second = t.onLock({ lines: 4, tspin: false }, 1);
    expect(second.backToBack).toBe(true);
    expect(second.points).toBe(1200); // 800 × 1.5
  });

  it('T-스핀 더블 → 테트리스도 백투백 체인이다', () => {
    const t = new ScoreTracker();
    t.onLock({ lines: 2, tspin: true }, 1);
    t.onLock({ lines: 0, tspin: false }, 1);
    const result = t.onLock({ lines: 4, tspin: false }, 1);
    expect(result.backToBack).toBe(true);
  });

  it('일반 싱글이 끼면 체인이 끊긴다', () => {
    const t = new ScoreTracker();
    t.onLock({ lines: 4, tspin: false }, 1);
    t.onLock({ lines: 1, tspin: false }, 1); // 체인 끊김
    const result = t.onLock({ lines: 4, tspin: false }, 1);
    expect(result.backToBack).toBe(false);
  });
});

describe('ScoreTracker — 콤보', () => {
  it('연속 클리어마다 50 × 콤보 수 × 레벨이 더해진다', () => {
    const t = new ScoreTracker();
    expect(t.onLock({ lines: 1, tspin: false }, 1).points).toBe(100); // 콤보 0
    expect(t.onLock({ lines: 1, tspin: false }, 1).points).toBe(150); // 100 + 50×1
    expect(t.onLock({ lines: 1, tspin: false }, 1).points).toBe(200); // 100 + 50×2
  });

  it('클리어 없는 고정으로 콤보가 초기화된다', () => {
    const t = new ScoreTracker();
    t.onLock({ lines: 1, tspin: false }, 1);
    t.onLock({ lines: 1, tspin: false }, 1);
    t.onLock({ lines: 0, tspin: false }, 1); // 콤보 끊김
    const result = t.onLock({ lines: 1, tspin: false }, 1);
    expect(result.combo).toBe(0);
    expect(result.points).toBe(100);
  });

  it('점수가 누적된다 (드롭 점수 포함)', () => {
    const t = new ScoreTracker();
    t.onLock({ lines: 1, tspin: false }, 1); // 100
    t.addDropPoints(10, 2); // 하드 드롭 20
    t.addDropPoints(5, 1); // 소프트 드롭 5
    expect(t.score).toBe(125);
  });
});

describe('levelForLines (10라인당 +1)', () => {
  it('레벨 1 시작: 9라인까지 1, 10라인에 2', () => {
    expect(levelForLines(1, 0)).toBe(1);
    expect(levelForLines(1, 9)).toBe(1);
    expect(levelForLines(1, 10)).toBe(2);
    expect(levelForLines(1, 25)).toBe(3);
  });

  it('최대 레벨 20에서 고정된다', () => {
    expect(levelForLines(1, 500)).toBe(20);
    expect(levelForLines(15, 100)).toBe(20);
  });
});
