import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, createBoard, type Board } from '../src/core/board';
import { tryRotate } from '../src/core/srs';

function fullBoardExcept(cells: Array<[number, number]>): Board {
  const board = createBoard();
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y]!.length; x++) {
      board[y]![x] = 'G';
    }
  }
  for (const [x, y] of cells) board[y]![x] = null;
  return board;
}

describe('tryRotate — 기본 회전', () => {
  it('빈 공간에서는 킥 없이(kickIndex 0) 제자리 회전한다', () => {
    const result = tryRotate(createBoard(), { type: 'T', rotation: 0, x: 4, y: 10 }, 1);
    expect(result).toEqual({ x: 4, y: 10, rotation: 1, kickIndex: 0 });
  });

  it('반시계 회전은 0→L(3)로 전이한다', () => {
    const result = tryRotate(createBoard(), { type: 'T', rotation: 0, x: 4, y: 10 }, -1);
    expect(result).toEqual({ x: 4, y: 10, rotation: 3, kickIndex: 0 });
  });

  it('O는 회전해도 위치가 변하지 않고 항상 성공한다', () => {
    const result = tryRotate(createBoard(), { type: 'O', rotation: 0, x: 4, y: 10 }, 1);
    expect(result).toEqual({ x: 4, y: 10, rotation: 1, kickIndex: 0 });
  });
});

describe('tryRotate — 벽킥 (JLSTZ 테이블)', () => {
  it('T 왼쪽 벽킥: R→0 회전 시 (+1,0) 킥이 적용된다', () => {
    // R 상태의 T는 x=-1에서도 유효(왼쪽 열이 비어 있음)
    const result = tryRotate(createBoard(), { type: 'T', rotation: 1, x: -1, y: 10 }, -1);
    expect(result).toEqual({ x: 0, y: 10, rotation: 0, kickIndex: 1 });
  });

  it('T 바닥킥: 접지 상태에서 0→R 회전 시 (-1,-1) 킥으로 한 칸 떠오른다', () => {
    const y = BOARD_HEIGHT - 2; // 바닥에 접지한 T
    const result = tryRotate(createBoard(), { type: 'T', rotation: 0, x: 4, y }, 1);
    expect(result).toEqual({ x: 3, y: y - 1, rotation: 1, kickIndex: 2 });
  });

  it('장애물이 있으면 다음 킥 후보로 넘어간다', () => {
    const board = createBoard();
    board[12]![5] = 'G'; // (0,0) 킥 위치만 막는 셀
    const result = tryRotate(board, { type: 'T', rotation: 0, x: 4, y: 10 }, 1);
    expect(result).toEqual({ x: 3, y: 10, rotation: 1, kickIndex: 1 });
  });
});

describe('tryRotate — 벽킥 (I 전용 테이블)', () => {
  it('I 오른쪽 벽킥: R→2 회전 시 (-1,0) 킥이 적용된다', () => {
    // 세로 I가 오른쪽 벽(열 9)에 붙은 상태
    const result = tryRotate(createBoard(), { type: 'I', rotation: 1, x: 7, y: 5 }, 1);
    expect(result).toEqual({ x: 6, y: 5, rotation: 2, kickIndex: 1 });
  });

  it('I 왼쪽 벽킥: R→0 회전 시 (+2,0) 킥이 적용된다', () => {
    // 세로 I가 왼쪽 벽(열 0)에 붙은 상태
    const result = tryRotate(createBoard(), { type: 'I', rotation: 1, x: -2, y: 5 }, -1);
    expect(result).toEqual({ x: 0, y: 5, rotation: 0, kickIndex: 1 });
  });
});

describe('tryRotate — 회전 불가', () => {
  it('모든 킥 위치가 막혀 있으면 null을 반환한다', () => {
    // T 기본 형태 셀만 비운 꽉 찬 보드
    const board = fullBoardExcept([
      [4, 5],
      [3, 6],
      [4, 6],
      [5, 6],
    ]);
    const piece = { type: 'T' as const, rotation: 0 as const, x: 3, y: 5 };
    expect(tryRotate(board, piece, 1)).toBeNull();
    expect(tryRotate(board, piece, -1)).toBeNull();
  });
});
