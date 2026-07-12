import { describe, expect, it } from 'vitest';
import { SevenBag } from '../src/core/bag';
import { PIECE_TYPES } from '../src/core/piece';

// 테스트 재현성을 위한 결정적 rng (mulberry32)
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('SevenBag', () => {
  it('매 7개 단위로 7종이 중복 없이 지급된다', () => {
    const bag = new SevenBag(seededRng(42));
    for (let chunk = 0; chunk < 100; chunk++) {
      const pieces = Array.from({ length: 7 }, () => bag.next());
      expect(new Set(pieces).size).toBe(7);
    }
  });

  it('같은 블록의 재등장 간격이 12개를 넘지 않는다 (PRD 수용 기준)', () => {
    const bag = new SevenBag(seededRng(7));
    const lastSeen = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const piece = bag.next();
      const prev = lastSeen.get(piece);
      if (prev !== undefined) {
        expect(i - prev - 1).toBeLessThanOrEqual(12); // 사이에 낀 블록 수 ≤ 12
      }
      lastSeen.set(piece, i);
    }
  });

  it('preview는 소비하지 않고 다음 지급 순서와 일치한다', () => {
    const bag = new SevenBag(seededRng(123));
    const previewed = bag.preview(5);
    expect(previewed).toHaveLength(5);
    const drawn = Array.from({ length: 5 }, () => bag.next());
    expect(drawn).toEqual(previewed);
  });

  it('preview가 가방 경계(7개)를 넘어도 동작한다', () => {
    const bag = new SevenBag(seededRng(99));
    for (let i = 0; i < 5; i++) bag.next(); // 가방에 2개 남김
    const previewed = bag.preview(5); // 다음 가방까지 미리 봐야 함
    expect(previewed).toHaveLength(5);
    const drawn = Array.from({ length: 5 }, () => bag.next());
    expect(drawn).toEqual(previewed);
  });

  it('지급되는 블록은 모두 유효한 타입이다', () => {
    const bag = new SevenBag(seededRng(1));
    for (let i = 0; i < 70; i++) {
      expect(PIECE_TYPES).toContain(bag.next());
    }
  });
});
