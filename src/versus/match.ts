// 2인 매치: 게임 코어 2개, 가비지 라우팅, 라운드/시리즈 관리 (PRD 3.2)

import { VERSUS_BASE_LEVEL, VERSUS_LEVEL_UP_MS, VERSUS_TARGET_WINS } from '../config';
import { Game } from '../core/game';
import { MAX_LEVEL } from '../core/gravity';

/** 결정적 rng — 두 플레이어에게 같은 블록 순서를 주기 위해 사용 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시간 경과에 따른 낙하 레벨: 5분마다 한 단계씩 상승 (PRD 3.2) */
export function versusLevel(baseLevel: number, elapsedMs: number): number {
  return Math.min(MAX_LEVEL, baseLevel + Math.floor(elapsedMs / VERSUS_LEVEL_UP_MS));
}

export type MatchPhase = 'playing' | 'roundover' | 'matchover';

export interface MatchOptions {
  targetWins?: number; // 기본 2 (3판 2선승)
  level?: number; // 기본 5 고정
  seed?: number; // 테스트용 결정적 시드
}

export class Match {
  games!: [Game, Game];
  wins: [number, number] = [0, 0];
  round = 1;
  phase: MatchPhase = 'playing';
  roundWinner: 0 | 1 | null = null;
  matchWinner: 0 | 1 | null = null;

  private readonly targetWins: number;
  private readonly baseLevel: number;
  private readonly seedRng: () => number;
  private elapsedMs = 0;
  private lastSeqs: [number, number] = [0, 0];

  constructor(opts: MatchOptions = {}) {
    this.targetWins = opts.targetWins ?? VERSUS_TARGET_WINS;
    this.baseLevel = opts.level ?? VERSUS_BASE_LEVEL;
    this.seedRng = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random;
    this.startRound();
  }

  get level(): number {
    return versusLevel(this.baseLevel, this.elapsedMs);
  }

  get isOver(): boolean {
    return this.phase === 'matchover';
  }

  tick(deltaMs: number): void {
    if (this.phase !== 'playing') return;
    this.elapsedMs += deltaMs;
    const level = this.level;
    for (const game of this.games) {
      game.level = level; // autoLevelUp: false라 게임이 덮어쓰지 않는다
      game.tick(deltaMs);
    }
    this.sync();
  }

  /**
   * 공격 라우팅 + 라운드 종료 판정. tick 내부에서 호출되며, 입력(하드드롭 등)으로
   * lock이 발생해도 같은 프레임의 tick이 곧바로 처리한다.
   */
  sync(): void {
    if (this.phase !== 'playing') return;

    this.games.forEach((game, i) => {
      const lock = game.lastLock;
      if (lock && lock.seq !== this.lastSeqs[i]) {
        this.lastSeqs[i] = lock.seq;
        if (lock.attack > 0) this.games[1 - i]!.garbage.enqueue(lock.attack);
      }
    });

    const over0 = this.games[0].isGameOver;
    const over1 = this.games[1].isGameOver;
    if (!over0 && !over1) return;

    // 탑아웃한 쪽이 패배. 동시 탑아웃이면 점수가 높은 쪽이 승리 (동점은 P1)
    let winner: 0 | 1;
    if (over0 && over1) winner = this.games[0].score >= this.games[1].score ? 0 : 1;
    else winner = over0 ? 1 : 0;

    this.roundWinner = winner;
    this.wins[winner]++;
    if (this.wins[winner]! >= this.targetWins) {
      this.matchWinner = winner;
      this.phase = 'matchover';
    } else {
      this.phase = 'roundover';
    }
  }

  nextRound(): void {
    if (this.phase !== 'roundover') return;
    this.round++;
    this.startRound();
  }

  rematch(): void {
    this.wins = [0, 0];
    this.round = 1;
    this.matchWinner = null;
    this.startRound();
  }

  private startRound(): void {
    // 공정성: 두 플레이어가 같은 시드의 bag을 받아 블록 순서가 동일하다.
    // 가비지 구멍 rng는 분리 — bag 소비량이 달라져 순서가 어긋나는 것을 방지.
    const seed = Math.floor(this.seedRng() * 0xffffffff);
    this.games = [0, 1].map(
      (i) =>
        new Game({
          rng: mulberry32(seed),
          garbageRng: mulberry32(seed ^ (0x9e3779b9 + i)),
          level: this.baseLevel,
          autoLevelUp: false,
        }),
    ) as [Game, Game];
    this.lastSeqs = [0, 0];
    this.elapsedMs = 0;
    this.roundWinner = null;
    this.phase = 'playing';
  }
}
