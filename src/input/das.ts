// DAS/ARR 처리: 키를 누르면 즉시 1회 이동, DAS 지연 후 ARR 간격으로 자동 반복

import { ARR_MS, DAS_MS } from '../config';

export class DasRepeater {
  private dir: -1 | 0 | 1 = 0;
  private prevLeft = false;
  private prevRight = false;
  private timer = 0;
  private repeating = false;

  constructor(
    private readonly dasMs: number = DAS_MS,
    private readonly arrMs: number = ARR_MS,
  ) {}

  /**
   * 이번 틱에 적용할 이동량(부호 = 방향)을 반환한다.
   * 좌우 동시 입력은 나중에 누른 쪽이 우선.
   */
  update(left: boolean, right: boolean, deltaMs: number): number {
    let dir: -1 | 0 | 1;
    if (left && right) {
      if (!this.prevRight) dir = 1;
      else if (!this.prevLeft) dir = -1;
      else dir = this.dir;
    } else {
      dir = left ? -1 : right ? 1 : 0;
    }
    this.prevLeft = left;
    this.prevRight = right;

    if (dir === 0) {
      this.dir = 0;
      this.timer = 0;
      this.repeating = false;
      return 0;
    }

    if (dir !== this.dir) {
      this.dir = dir;
      this.timer = 0;
      this.repeating = false;
      return dir; // 최초 입력/방향 전환은 즉시 1회 이동
    }

    this.timer += deltaMs;
    let moves = 0;
    if (!this.repeating && this.timer >= this.dasMs) {
      this.repeating = true;
      this.timer -= this.dasMs;
      moves++;
    }
    if (this.repeating) {
      while (this.timer >= this.arrMs) {
        this.timer -= this.arrMs;
        moves++;
      }
    }
    return moves === 0 ? 0 : moves * dir; // -0 방지
  }

  reset(): void {
    this.dir = 0;
    this.timer = 0;
    this.repeating = false;
    this.prevLeft = false;
    this.prevRight = false;
  }
}
