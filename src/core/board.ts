// 보드 상태, 충돌 검사, 블록 고정, 라인 클리어 (PRD 4.1) — 순수 함수로 구현

import type { PieceType, ShapeMatrix } from './piece';

export const BOARD_WIDTH = 10;
export const BUFFER_ROWS = 2; // 상단 비가시 버퍼
export const BOARD_HEIGHT = 20 + BUFFER_ROWS; // 총 22줄

// 'G' = 가비지 라인 셀 (2인용, Phase 6)
export type CellValue = PieceType | 'G' | null;
export type Board = CellValue[][];

export function createBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null as CellValue),
  );
}

/** shape의 좌상단이 (px, py)에 놓일 때 모든 셀이 보드 안이고 비어 있는지 검사 */
export function isValidPosition(board: Board, shape: ShapeMatrix, px: number, py: number): boolean {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y]!.length; x++) {
      if (!shape[y]![x]) continue;
      const bx = px + x;
      const by = py + y;
      if (bx < 0 || bx >= BOARD_WIDTH || by < 0 || by >= BOARD_HEIGHT) return false;
      if (board[by]![bx] !== null) return false;
    }
  }
  return true;
}

/** 블록을 보드에 고정한 새 보드를 반환 (원본 불변) */
export function lockPiece(
  board: Board,
  shape: ShapeMatrix,
  px: number,
  py: number,
  type: PieceType,
): Board {
  const next = board.map((row) => [...row]);
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y]!.length; x++) {
      if (!shape[y]![x]) continue;
      next[py + y]![px + x] = type;
    }
  }
  return next;
}

export interface ClearResult {
  board: Board;
  linesCleared: number;
  clearedRows: number[];
}

/** 가득 찬 줄을 제거하고 위를 아래로 내린 새 보드를 반환 (원본 불변) */
export function clearLines(board: Board): ClearResult {
  const clearedRows: number[] = [];
  const remaining: CellValue[][] = [];
  for (let y = 0; y < board.length; y++) {
    if (board[y]!.every((cell) => cell !== null)) {
      clearedRows.push(y);
    } else {
      remaining.push([...board[y]!]);
    }
  }
  const emptyRows: CellValue[][] = Array.from({ length: clearedRows.length }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null as CellValue),
  );
  return {
    board: [...emptyRows, ...remaining],
    linesCleared: clearedRows.length,
    clearedRows,
  };
}
