// 1인 게임 코어 상태 머신: spawn → falling → locking → (clearing) → spawn
// 라인 클리어는 lock 시점에 원자적으로 처리하고 결과를 lastLock으로 노출한다.
// 렌더링/입력 의존 없음 — tick(deltaMs)으로만 시간이 흐른다.

import { SevenBag } from './bag';
import {
  addGarbageLines,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BUFFER_ROWS,
  clearLines,
  createBoard,
  isValidPosition,
  lockPiece,
  type Board,
} from './board';
import { attackLines, GarbageQueue } from './garbage';
import {
  fallIntervalMs,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  SOFT_DROP_MULTIPLIER,
} from './gravity';
import { getShape, getSpawnPosition, type PieceType, type Rotation } from './piece';
import { levelForLines, ScoreTracker } from './scoring';
import { tryRotate } from './srs';

export interface ActivePiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export type GamePhase = 'falling' | 'locking' | 'gameover';

export interface LockResult {
  seq: number; // 고정 이벤트 순번 — 렌더러/매치가 새 이벤트 감지에 사용
  linesCleared: number;
  clearedRows: number[];
  tspin: boolean;
  points: number; // 이번 고정으로 얻은 클리어 점수 (드롭 점수 제외)
  backToBack: boolean;
  combo: number;
  attack: number; // 상쇄 후 상대에게 전송할 가비지 라인 수 (2인용)
}

export interface GameOptions {
  rng?: () => number;
  level?: number;
  /** false면 레벨이 고정된다 (2인용 배틀 모드) */
  autoLevelUp?: boolean;
  /** 가비지 구멍 위치용 rng — bag rng와 분리해 2인용 블록 순서 공정성을 지킨다 */
  garbageRng?: () => number;
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

  /** 대기 중인 가비지 — 매치(2인용)가 상대 공격을 여기에 쌓는다 */
  readonly garbage = new GarbageQueue();

  private readonly bag: SevenBag;
  private readonly tracker = new ScoreTracker();
  private readonly baseLevel: number;
  private readonly autoLevelUp: boolean;
  private readonly garbageRng: () => number;
  private holdUsed = false;
  private softDropping = false;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private lastMoveWasRotation = false; // T-스핀 조건: 마지막 동작이 회전
  private lockSeq = 0;

  constructor(opts: GameOptions = {}) {
    this.bag = new SevenBag(opts.rng);
    this.baseLevel = opts.level ?? 1;
    this.level = this.baseLevel;
    this.autoLevelUp = opts.autoLevelUp ?? true;
    this.garbageRng = opts.garbageRng ?? Math.random;
    this.spawn();
  }

  get score(): number {
    return this.tracker.score;
  }

  get isGameOver(): boolean {
    return this.phase === 'gameover';
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
      this.lastMoveWasRotation = false;
      if (this.softDropping) this.tracker.addDropPoints(1, 1);
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
    this.lastMoveWasRotation = false;
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
    this.lastMoveWasRotation = true;
    this.afterShift();
    return true;
  }

  setSoftDrop(on: boolean): void {
    this.softDropping = on;
  }

  hardDrop(): void {
    if (!this.active || this.phase === 'gameover') return;
    let cells = 0;
    while (!this.isGrounded()) {
      this.active.y += 1;
      cells++;
    }
    if (cells > 0) {
      this.lastMoveWasRotation = false;
      this.tracker.addDropPoints(cells, 2);
    }
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
    this.lastMoveWasRotation = false;
  }

  /**
   * T-스핀 판정 (PRD 4.3): T 블록이 회전으로 고정되고, 3x3 박스의 네 모서리 중
   * 3개 이상이 채워져(벽/바닥 포함) 있으면 T-스핀. lock 직전에 호출해야 한다.
   */
  private isTSpin(): boolean {
    const piece = this.active;
    if (!piece || piece.type !== 'T' || !this.lastMoveWasRotation) return false;
    const corners: ReadonlyArray<readonly [number, number]> = [
      [piece.x, piece.y],
      [piece.x + 2, piece.y],
      [piece.x, piece.y + 2],
      [piece.x + 2, piece.y + 2],
    ];
    let filled = 0;
    for (const [cx, cy] of corners) {
      if (cx < 0 || cx >= BOARD_WIDTH || cy < 0 || cy >= BOARD_HEIGHT) filled++;
      else if (this.board[cy]![cx] !== null) filled++;
    }
    return filled >= 3;
  }

  private lockActive(): void {
    if (!this.active) return;
    const { type, rotation, x, y } = this.active;
    const shape = getShape(type, rotation);
    const tspin = this.isTSpin(); // 보드에 고정하기 전에 판정

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

    const lockScore = this.tracker.onLock({ lines: result.linesCleared, tspin }, this.level);
    if (this.autoLevelUp) this.level = levelForLines(this.baseLevel, this.totalLines);

    // 공격량 계산 → 대기 가비지와 상쇄 → 잔여분만 상대에게 전송 (PRD 3.2)
    const rawAttack = attackLines({
      lines: result.linesCleared,
      tspin,
      backToBack: lockScore.backToBack,
      combo: lockScore.combo,
    });
    const attack = this.garbage.offset(rawAttack);

    this.lastLock = {
      seq: ++this.lockSeq,
      linesCleared: result.linesCleared,
      clearedRows: result.clearedRows,
      tspin,
      points: lockScore.points,
      backToBack: lockScore.backToBack,
      combo: lockScore.combo,
      attack,
    };

    if (allInBuffer) {
      this.active = null;
      this.phase = 'gameover';
      return;
    }

    // 라인을 지우지 못한 고정이면 대기 가비지가 이번 lock 직후 올라온다
    if (result.linesCleared === 0 && this.garbage.total > 0) {
      const count = this.garbage.flush();
      const holes = Array.from({ length: count }, () =>
        Math.floor(this.garbageRng() * BOARD_WIDTH),
      );
      this.board = addGarbageLines(this.board, holes);
    }
    this.spawn();
  }
}
