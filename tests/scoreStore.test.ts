import { describe, expect, it } from 'vitest';
import {
  normalizeTimestamp,
  ScoreStore,
  type KeyValueStorage,
  type SoloRecord,
} from '../src/score/scoreStore';
import { parseLog, serializeLog } from '../src/score/txtFormat';

class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function soloRecord(overrides: Partial<SoloRecord> = {}): SoloRecord {
  return {
    kind: 'solo',
    timestamp: new Date(2026, 6, 12, 21, 0, 0).getTime(),
    player: 'P1',
    score: 1000,
    lines: 10,
    level: 2,
    durationMs: 60_000,
    ...overrides,
  };
}

describe('ScoreStore', () => {
  it('추가한 기록이 스토리지에 저장되어 재로드된다 (새로고침 유지)', () => {
    const storage = new MemoryStorage();
    const store = new ScoreStore(storage);
    store.add(soloRecord());

    const reloaded = new ScoreStore(storage);
    expect(reloaded.all()).toHaveLength(1);
    expect(reloaded.all()[0]).toMatchObject({ kind: 'solo', score: 1000 });
  });

  it('topSolo는 점수 내림차순 상위 N개 (대전 기록 제외)', () => {
    const store = new ScoreStore(new MemoryStorage());
    for (let i = 0; i < 12; i++) {
      store.add(soloRecord({ score: i * 100, timestamp: Date.now() + i * 1000 }));
    }
    store.add({
      kind: 'versus',
      timestamp: Date.now() + 99_000,
      winner: 'P2',
      rounds: '2-0',
      durationMs: 300_000,
    });

    const top = store.topSolo(10);
    expect(top).toHaveLength(10);
    expect(top[0]!.score).toBe(1100);
    expect(top[9]!.score).toBe(200);
  });

  it('all()은 최신순으로 반환한다', () => {
    const store = new ScoreStore(new MemoryStorage());
    store.add(soloRecord({ timestamp: 1_000_000, score: 1 }));
    store.add(soloRecord({ timestamp: 3_000_000, score: 3 }));
    store.add(soloRecord({ timestamp: 2_000_000, score: 2 }));
    expect(store.all().map((r) => (r as SoloRecord).score)).toEqual([3, 2, 1]);
  });

  it('merge는 타임스탬프(초)+모드 기준으로 중복을 제거한다', () => {
    const store = new ScoreStore(new MemoryStorage());
    const record = soloRecord({ timestamp: normalizeTimestamp(Date.now()) });
    store.add(record);

    // txt로 내보냈다가 다시 불러오는 왕복 — 전부 중복이어야 함
    const roundTripped = parseLog(serializeLog(store.chronological())).records;
    expect(store.merge(roundTripped)).toBe(0);

    // 새 기록은 추가됨
    const added = store.merge([soloRecord({ timestamp: record.timestamp + 5_000 })]);
    expect(added).toBe(1);
    expect(store.all()).toHaveLength(2);
  });

  it('밀리초가 달라도 같은 초의 같은 모드는 중복으로 본다', () => {
    const store = new ScoreStore(new MemoryStorage());
    store.add(soloRecord({ timestamp: 1_720_000_000_123 }));
    expect(store.merge([soloRecord({ timestamp: 1_720_000_000_987 })])).toBe(0);
  });
});
