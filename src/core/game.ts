// 1인 게임 코어 상태 머신: spawn → falling → locking → (clearing) → spawn
// 라인 클리어는 lock 시점에 원자적으로 처리하고 결과를 lastLock으로 노출한다.
// 렌더링/입력 의존 없음 — tick(deltaMs)으로만 시간이 흐른다.

import { SevenBag } from './bag';
import {
  BUFFER_ROWS,
  clearLines,
  createBoard,
  isValidPosition,
  lockPiece,
  type Board,
} from './board';
import {
  fallIntervalMs,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  SOFT_DROP_MULTIPLIER,
} from './gravity';
import { getShape, getSpawnPosition, type PieceType, type Rotation } from './piece';
import { tryRotate } from './srs';

export interface ActivePiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export type GamePhase = 'falling' | 'locking' | 'gameover';

export interface LockResult {
  linesCleared: number;
  clearedRows: number[];
}

export interface GameOptions {
  rng?: () => number;
  level?: number;
}

export class Game {
  board: Board = createBoard();
  active: ActivePiece | null = null;
  heldPiece: PieceType | null = null;
  phase: GamePhase = 'falling';
  level: number;
  totalLines = 0;
  /** 가장 최근 lock의 클리어 결과 (이펙트/점수 계산용) */
  lastLock: LockResult | null = null;

  private readonly bag: SevenBag;
  private holdUsed = false;
  private softDropping = false;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;

  constructor(opts: GameOptions = {}) {
    this.bag = new SevenBag(opts.rng);
    this.level = opts.level ?? 1;
    this.spawn();
  }

  preview(count = 5): PieceType[] {
    return this.bag.preview(count);
  }

  /** 고스트 피스가 표시될 y (현재 위치에서 수직 낙하 시 도달점) */
  ghostY(): number {
    if (!this.active) return 0;
    const { type, rotation, x } = this.active;
    const shape = getShape(type, rotation);
    let y = this.active.y;
    while (isValidPosition(this.board, shape, x, y + 1)) y++;
    return y;
  }

  tick(deltaMs: number): void {
    if (this.phase === 'gameover' || !this.active) return;

    if (this.isGrounded()) {
      if (this.phase !== 'locking') {
        this.phase = 'locking';
        this.gravityAcc = 0;
      }
      this.lockTimer += deltaMs;
      if (this.lockTimer >= LOCK_DELAY_MS) this.lockActive();
      return;
    }

    this.phase = 'falling';
    const interval = fallIntervalMs(this.level) / (this.softDropping ? SOFT_DROP_MULTIPLIER : 1);
    this.gravityAcc += deltaMs;
    while (this.gravityAcc >= interval) {
      this.gravityAcc -= interval;
      this.active.y += 1;
      if (this.isGrounded()) {
        this.phase = 'locking';
        this.gravityAcc = 0;
        break;
      }
    }
  }

  moveActive(dx: -1 | 1): boolean {
    if (!this.active || this.phase === 'gameover') return false;
    const { type, rotation, x, y } = this.active;
    if (!isValidPosition(this.board, getShape(type, rotation), x + dx, y)) return false;
    this.active.x += dx;
    this.afterShift();
    return true;
  }

  rotateActive(direction: 1 | -1): boolean {
    if (!this.active || this.phase === 'gameover') return false;
    const result = tryRotate(this.board, this.active, direction);
    if (!result) return false;
    this.active.x = result.x;
    this.active.y = result.y;
    this.active.rotation = result.rotation;
    this.afterShift();
    return true;
  }

  setSoftDrop(on: boolean): void {
    this.softDropping = on;
  }

  hardDrop(): void {
    if (!this.active || this.phase === 'gameover') return;
    while (!this.isGrounded()) this.active.y += 1;
    this.lockActive();
  }

  /** 현재 블록을 보관/교체. 블록당 1회만 가능 (PRD 4.4) */
  holdActive(): boolean {
    if (!this.active || this.phase === 'gameover' || this.holdUsed) return false;
    const current = this.active.type;
    this.spawn(this.heldPiece ?? undefined);
    this.heldPiece = current;
    this.holdUsed = true;
    return true;
  }

  private isGrounded(): boolean {
    if (!this.active) return false;
    const { type, rotation, x, y } = this.active;
    return !isValidPosition(this.board, getShape(type, rotation), x, y + 1);
  }

  // 락 딜레이 리셋 규칙: 접지 중 이동/회전 성공 시 타이머 리셋(최대 15회),
  // 리셋 소진 후 접지 상태의 성공한 조작은 즉시 강제 고정
  private afterShift(): void {
    if (this.phase !== 'locking') return;
    if (this.lockResets < MAX_LOCK_RESETS) {
      this.lockResets++;
      this.lockTimer = 0;
      if (!this.isGrounded()) this.phase = 'falling';
    } else if (this.isGrounded()) {
      this.lockActive();
    }
  }

  private spawn(type?: PieceType): void {
    const pieceType = type ?? this.bag.next();
    const { x, y } = getSpawnPosition(pieceType);
    if (!isValidPosition(this.board, getShape(pieceType, 0), x, y)) {
      this.active = null;
      this.phase = 'gameover';
      return;
    }
    this.active = { type: pieceType, rotation: 0, x, y };
    this.phase = 'falling';
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.holdUsed = false;
  }

  private lockActive(): void {
    if (!this.active) return;
    const { type, rotation, x, y } = this.active;
    const shape = getShape(type, rotation);

    // 락 아웃: 블록 전체가 버퍼(비가시 영역) 안에서 고정되면 게임 오버
    let allInBuffer = true;
    for (let sy = 0; sy < shape.length; sy++) {
      for (let sx = 0; sx < shape[sy]!.length; sx++) {
        if (shape[sy]![sx] && y + sy >= BUFFER_ROWS) allInBuffer = false;
      }
    }

    this.board = lockPiece(this.board, shape, x, y, type);
    const result = clearLines(this.board);
    this.board = result.board;
    this.totalLines += result.linesCleared;
    this.lastLock = { linesCleared: result.linesCleared, clearedRows: result.clearedRows };

    if (allInBuffer) {
      this.active = null;
      this.phase = 'gameover';
      return;
    }
    this.spawn();
  }
}
