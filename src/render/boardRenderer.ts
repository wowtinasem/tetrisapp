// Canvas 보드 렌더러: 고정 블록, 고스트 피스, 활성 블록 (버퍼 2줄은 숨김)

import { BOARD_HEIGHT, BOARD_WIDTH, BUFFER_ROWS, type CellValue } from '../core/board';
import type { Game } from '../core/game';
import { getShape, PIECE_COLORS } from '../core/piece';

export const VISIBLE_ROWS = BOARD_HEIGHT - BUFFER_ROWS;
const GARBAGE_COLOR = '#6b7280';
const BG_COLOR = '#0d0f14';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';

function cellColor(cell: Exclude<CellValue, null>): string {
  return cell === 'G' ? GARBAGE_COLOR : PIECE_COLORS[cell];
}

export class BoardRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cellSize: number;

  constructor(private readonly canvas: HTMLCanvasElement, cellSize = 30) {
    this.cellSize = cellSize;
    this.ctx = canvas.getContext('2d')!;
    this.resize(cellSize);
  }

  /** 창 크기 대응(Phase 7)에서 사용 — 셀 크기를 바꾸면 캔버스도 재조정 */
  resize(cellSize: number): void {
    this.cellSize = cellSize;
    this.canvas.width = BOARD_WIDTH * cellSize;
    this.canvas.height = VISIBLE_ROWS * cellSize;
  }

  draw(game: Game): void {
    const { ctx, cellSize } = this;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 격자선 (은은하게 — PRD 6.2)
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < BOARD_WIDTH; x++) {
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, this.canvas.height);
    }
    for (let y = 1; y < VISIBLE_ROWS; y++) {
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(this.canvas.width, y * cellSize + 0.5);
    }
    ctx.stroke();

    // 고정된 블록
    for (let y = BUFFER_ROWS; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const cell = game.board[y]![x];
        if (cell) this.drawCell(x, y - BUFFER_ROWS, cellColor(cell), 1);
      }
    }

    if (!game.active) return;
    const { type, rotation, x: px } = game.active;
    const shape = getShape(type, rotation);
    const color = PIECE_COLORS[type];

    // 고스트 피스 (반투명)
    const ghostY = game.ghostY();
    this.drawShape(shape, px, ghostY, color, 0.25);
    // 활성 블록
    this.drawShape(shape, px, game.active.y, color, 1);
  }

  private drawShape(
    shape: readonly (readonly number[])[],
    px: number,
    py: number,
    color: string,
    alpha: number,
  ): void {
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy]!.length; sx++) {
        if (!shape[sy]![sx]) continue;
        const by = py + sy - BUFFER_ROWS;
        if (by < 0) continue; // 버퍼 영역은 그리지 않음
        this.drawCell(px + sx, by, color, alpha);
      }
    }
  }

  private drawCell(cx: number, cy: number, color: string, alpha: number): void {
    const { ctx, cellSize } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(cx * cellSize + 1, cy * cellSize + 1, cellSize - 2, cellSize - 2);
    // 위쪽 하이라이트로 입체감
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(cx * cellSize + 1, cy * cellSize + 1, cellSize - 2, 3);
    ctx.globalAlpha = 1;
  }
}
