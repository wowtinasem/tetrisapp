// 2인용 공격 테이블, 가비지 큐, 상쇄 로직 (PRD 3.2)

export interface AttackEvent {
  lines: number;
  tspin: boolean;
  backToBack: boolean;
  combo: number;
}

// 싱글 0, 더블 1, 트리플 2, 테트리스 4
const LINE_ATTACK = [0, 0, 1, 2, 4] as const;
// T-스핀 싱글 2, 더블 4, 트리플 6
const TSPIN_ATTACK = [0, 2, 4, 6] as const;

/** 콤보 수에 따른 추가 공격 +1 ~ +4 */
export function comboBonus(combo: number): number {
  if (combo <= 0) return 0;
  if (combo <= 2) return 1;
  if (combo <= 4) return 2;
  if (combo <= 6) return 3;
  return 4;
}

/** 이번 클리어로 상대에게 보낼 가비지 라인 수 */
export function attackLines(event: AttackEvent): number {
  if (event.lines === 0) return 0;
  let attack = event.tspin ? TSPIN_ATTACK[event.lines]! : LINE_ATTACK[event.lines]!;
  if (event.backToBack) attack += 1;
  return attack + comboBonus(event.combo);
}

/** 대기 가비지 큐 — 공격 단위로 쌓이고, 클리어 공격량만큼 상쇄된다 */
export class GarbageQueue {
  private queue: number[] = [];

  get total(): number {
    return this.queue.reduce((sum, n) => sum + n, 0);
  }

  enqueue(lines: number): void {
    if (lines > 0) this.queue.push(lines);
  }

  /**
   * 상쇄(PRD 3.2): 공격량만큼 대기 가비지를 차감하고,
   * 대기량을 넘는 잔여 공격량(상대에게 실제로 전송할 양)을 반환한다.
   */
  offset(attack: number): number {
    let remaining = attack;
    while (remaining > 0 && this.queue.length > 0) {
      const head = this.queue[0]!;
      if (head <= remaining) {
        remaining -= head;
        this.queue.shift();
      } else {
        this.queue[0] = head - remaining;
        remaining = 0;
      }
    }
    return remaining;
  }

  /** 대기 가비지를 모두 꺼낸다 — 블록 고정 시점에 보드로 올린다 */
  flush(): number {
    const total = this.total;
    this.queue = [];
    return total;
  }
}
