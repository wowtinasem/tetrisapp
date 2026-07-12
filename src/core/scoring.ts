// 점수 계산: PRD 4.5 점수표, 콤보, 백투백 (순수 로직)

import { MAX_LEVEL } from './gravity';

export interface ClearEvent {
  lines: number; // 0~4
  tspin: boolean;
}

export const BACK_TO_BACK_MULTIPLIER = 1.5;
export const COMBO_BONUS = 50;

const LINE_SCORES = [0, 100, 300, 500, 800] as const;
const TSPIN_SCORES = [0, 800, 1200, 1600] as const; // T-스핀은 최대 트리플(3줄)

export function baseClearScore(event: ClearEvent, level: number): number {
  if (event.lines === 0) return 0;
  const base = event.tspin ? TSPIN_SCORES[event.lines]! : LINE_SCORES[event.lines]!;
  return base * level;
}

/** 백투백 체인 대상: 테트리스 또는 라인을 지운 T-스핀 */
export function isDifficultClear(event: ClearEvent): boolean {
  return event.lines > 0 && (event.tspin || event.lines === 4);
}

/** 10라인 클리어마다 레벨 +1, 최대 20 (PRD 3.1) */
export function levelForLines(baseLevel: number, totalLines: number): number {
  return Math.min(MAX_LEVEL, baseLevel + Math.floor(totalLines / 10));
}

export interface LockScore {
  points: number;
  backToBack: boolean;
  combo: number; // 0 = 콤보 없음, 1부터 보너스
}

export class ScoreTracker {
  score = 0;
  private combo = -1; // 연속 클리어 카운터 (-1 = 체인 없음)
  private lastDifficult = false;

  /** 블록 고정 결과를 반영하고 이번 고정으로 얻은 점수를 반환 */
  onLock(event: ClearEvent, level: number): LockScore {
    if (event.lines === 0) {
      // 클리어 없는 고정: 콤보만 끊기고 백투백 체인은 유지된다
      this.combo = -1;
      return { points: 0, backToBack: false, combo: 0 };
    }

    this.combo++;
    const difficult = isDifficultClear(event);
    const backToBack = difficult && this.lastDifficult;
    this.lastDifficult = difficult;

    let points = baseClearScore(event, level);
    if (backToBack) points = Math.floor(points * BACK_TO_BACK_MULTIPLIER);
    if (this.combo >= 1) points += COMBO_BONUS * this.combo * level;

    this.score += points;
    return { points, backToBack, combo: this.combo };
  }

  /** 소프트 드롭 1점/칸, 하드 드롭 2점/칸 (PRD 4.5) */
  addDropPoints(cells: number, perCell: 1 | 2): void {
    this.score += cells * perCell;
  }
}
