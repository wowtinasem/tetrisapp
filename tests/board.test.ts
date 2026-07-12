import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  clearLines,
  createBoard,
  isValidPosition,
  lockPiece,
  type Board,
} from '../src/core/board';
import { getShape, getSpawnPosition } from '../src/core/piece';

function fillRow(board: Board, y: number, except: number[] = []): void {
  for (let x = 0; x < BOARD_WIDTH; x++) {
    if (!except.includes(x)) board[y]![x] = 'G';
  }
}

describe('createBoard', () => {
  it('10x22 크기의 빈 보드를 만든다', () => {
    const board = createBoard();
    expect(board).toHaveLength(BOARD_HEIGHT);
    expect(board.every((row) => row.length === BOARD_WIDTH)).toBe(true);
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });
});

describe('isValidPosition', () => {
  const tShape = getShape('T', 0);

  it('빈 보드의 스폰 위치는 유효하다', () => {
    const { x, y } = getSpawnPosition('T');
    expect(isValidPosition(createBoard(), tShape, x, y)).toBe(true);
  });

  it('좌/우/하단 벽 밖은 무효다', () => {
    const board = createBoard();
    expect(isValidPosition(board, tShape, -1, 5)).toBe(false);
    expect(isValidPosition(board, tShape, BOARD_WIDTH - 2, 5)).toBe(false);
    expect(isValidPosition(board, tShape, 3, BOARD_HEIGHT - 1)).toBe(false);
  });

  it('고정된 블록과 겹치면 무효다', () => {
    const board = createBoard();
    board[10]![4] = 'I';
    expect(isValidPosition(board, tShape, 3, 9)).toBe(false); // T의 (1,1)이 (4,10)과 충돌
    expect(isValidPosition(board, tShape, 3, 11)).toBe(true);
  });

  it('벽에 붙은 위치는 유효하다', () => {
    const board = createBoard();
    expect(isValidPosition(board, tShape, 0, 5)).toBe(true); // 왼쪽 벽
    expect(isValidPosition(board, tShape, BOARD_WIDTH - 3, 5)).toBe(true); // 오른쪽 벽
  });
});

describe('lockPiece', () => {
  it('블록 셀을 보드에 기록하고 원본은 변경하지 않는다', () => {
    const board = createBoard();
    const locked = lockPiece(board, getShape('T', 0), 3, 10, 'T');
    expect(locked[10]![4]).toBe('T');
    expect(locked[11]![3]).toBe('T');
    expect(locked[11]![4]).toBe('T');
    expect(locked[11]![5]).toBe('T');
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });
});

describe('clearLines', () => {
  it('가득 찬 한 줄을 제거하고 위 줄을 내린다', () => {
    const board = createBoard();
    fillRow(board, BOARD_HEIGHT - 1);
    board[BOARD_HEIGHT - 2]![0] = 'T'; // 클리어 줄 바로 위의 표식

    const result = clearLines(board);
    expect(result.linesCleared).toBe(1);
    expect(result.clearedRows).toEqual([BOARD_HEIGHT - 1]);
    expect(result.board[BOARD_HEIGHT - 1]![0]).toBe('T'); // 한 칸 내려옴
    expect(result.board[0]!.every((cell) => cell === null)).toBe(true);
    expect(result.board).toHaveLength(BOARD_HEIGHT);
  });

  it('떨어져 있는 두 줄도 동시에 제거한다', () => {
    const board = createBoard();
    fillRow(board, BOARD_HEIGHT - 1);
    fillRow(board, BOARD_HEIGHT - 3);
    board[BOARD_HEIGHT - 2]![5] = 'S'; // 두 클리어 줄 사이의 표식

    const result = clearLines(board);
    expect(result.linesCleared).toBe(2);
    expect(result.board[BOARD_HEIGHT - 1]![5]).toBe('S'); // 맨 아래로 내려옴
    expect(result.board.flat().filter((cell) => cell !== null)).toEqual(['S']);
  });

  it('가득 찬 줄이 없으면 보드가 그대로다', () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 1]![0] = 'Z';
    const result = clearLines(board);
    expect(result.linesCleared).toBe(0);
    expect(result.board).toEqual(board);
  });

  it('테트리스(4줄 동시) 클리어가 동작한다', () => {
    const board = createBoard();
    for (let i = 1; i <= 4; i++) fillRow(board, BOARD_HEIGHT - i);
    const result = clearLines(board);
    expect(result.linesCleared).toBe(4);
    expect(result.board.flat().every((cell) => cell === null)).toBe(true);
  });
});
