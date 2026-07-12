import { describe, expect, it } from 'vitest';
import {
  PIECE_TYPES,
  getShape,
  getSpawnPosition,
  nextRotation,
  type Rotation,
} from '../src/core/piece';

function countCells(shape: readonly (readonly number[])[]): number {
  return shape.flat().filter(Boolean).length;
}

describe('piece', () => {
  it('7종 모두 정의되어 있다', () => {
    expect(PIECE_TYPES).toHaveLength(7);
    expect(new Set(PIECE_TYPES).size).toBe(7);
  });

  it('모든 타입의 모든 회전 상태는 정확히 4칸을 차지한다', () => {
    for (const type of PIECE_TYPES) {
      for (const rotation of [0, 1, 2, 3] as const) {
        expect(countCells(getShape(type, rotation))).toBe(4);
      }
    }
  });

  it('T의 시계 회전(0→R) 형태가 올바르다', () => {
    expect(getShape('T', 1)).toEqual([
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ]);
  });

  it('O는 회전해도 형태가 같다', () => {
    const base = getShape('O', 0);
    for (const rotation of [1, 2, 3] as const) {
      expect(getShape('O', rotation)).toEqual(base);
    }
  });

  it('시계 4회 회전하면 원래 상태로 돌아온다', () => {
    let r: Rotation = 0;
    for (let i = 0; i < 4; i++) r = nextRotation(r, 1);
    expect(r).toBe(0);
    expect(nextRotation(0, -1)).toBe(3);
  });

  it('스폰 위치: 모든 블록이 중앙 상단(버퍼 영역)에서 시작한다', () => {
    for (const type of PIECE_TYPES) {
      const { x, y } = getSpawnPosition(type);
      expect(y).toBe(0);
      expect(x).toBe(type === 'O' ? 4 : 3);
    }
  });
});
