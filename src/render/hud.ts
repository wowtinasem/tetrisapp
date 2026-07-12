// HUD: 홀드, 넥스트 미리보기, 점수/레벨/라인 (PRD 6.1 — DOM + 미니 캔버스)

import type { Game } from '../core/game';
import { getShape, PIECE_COLORS, type PieceType } from '../core/piece';

const MINI_CELL = 14;
const SLOT = 4 * MINI_CELL; // 미리보기 한 칸(4x4 셀 기준 정사각형)

function drawPieceInSlot(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  slotX: number,
  slotY: number,
): void {
  const shape = getShape(type, 0);
  // 채워진 셀의 바운딩 박스를 구해 슬롯 중앙에 배치
  let minX = 4, maxX = -1, minY = 4, maxY = -1;
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y]!.length; x++) {
      if (!shape[y]![x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const w = (maxX - minX + 1) * MINI_CELL;
  const h = (maxY - minY + 1) * MINI_CELL;
  const offsetX = slotX + (SLOT - w) / 2;
  const offsetY = slotY + (SLOT - h) / 2;
  ctx.fillStyle = PIECE_COLORS[type];
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y]!.length; x++) {
      if (!shape[y]![x]) continue;
      ctx.fillRect(
        offsetX + (x - minX) * MINI_CELL + 1,
        offsetY + (y - minY) * MINI_CELL + 1,
        MINI_CELL - 2,
        MINI_CELL - 2,
      );
    }
  }
}

export class Hud {
  private readonly holdCtx: CanvasRenderingContext2D;
  private readonly nextCtx: CanvasRenderingContext2D;
  private readonly scoreEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly linesEl: HTMLElement;
  private readonly previewCount: number;

  constructor(leftPane: HTMLElement, rightPane: HTMLElement, previewCount = 5) {
    this.previewCount = previewCount;

    leftPane.innerHTML = `
      <div class="panel">
        <div class="panel-title">HOLD</div>
        <canvas class="hold-canvas" width="${SLOT}" height="${SLOT}"></canvas>
      </div>`;
    rightPane.innerHTML = `
      <div class="panel">
        <div class="panel-title">NEXT</div>
        <canvas class="next-canvas" width="${SLOT}" height="${SLOT * previewCount}"></canvas>
      </div>
      <div class="panel stats">
        <div class="panel-title">SCORE</div><div class="stat-value" data-stat="score">0</div>
        <div class="panel-title">LEVEL</div><div class="stat-value" data-stat="level">1</div>
        <div class="panel-title">LINES</div><div class="stat-value" data-stat="lines">0</div>
      </div>`;

    this.holdCtx = leftPane.querySelector<HTMLCanvasElement>('.hold-canvas')!.getContext('2d')!;
    this.nextCtx = rightPane.querySelector<HTMLCanvasElement>('.next-canvas')!.getContext('2d')!;
    this.scoreEl = rightPane.querySelector<HTMLElement>('[data-stat="score"]')!;
    this.levelEl = rightPane.querySelector<HTMLElement>('[data-stat="level"]')!;
    this.linesEl = rightPane.querySelector<HTMLElement>('[data-stat="lines"]')!;
  }

  update(game: Game, score: number): void {
    this.holdCtx.clearRect(0, 0, SLOT, SLOT);
    if (game.heldPiece) drawPieceInSlot(this.holdCtx, game.heldPiece, 0, 0);

    this.nextCtx.clearRect(0, 0, SLOT, SLOT * this.previewCount);
    game.preview(this.previewCount).forEach((type, i) => {
      drawPieceInSlot(this.nextCtx, type, 0, i * SLOT);
    });

    this.scoreEl.textContent = String(score);
    this.levelEl.textContent = String(game.level);
    this.linesEl.textContent = String(game.totalLines);
  }
}
