// 게임 기록 모델 + localStorage CRUD (Phase 5)

export interface SoloRecord {
  kind: 'solo';
  timestamp: number; // epoch ms (초 단위로 정규화해 저장)
  player: string;
  score: number;
  lines: number;
  level: number;
  durationMs: number;
}

export interface VersusRecord {
  kind: 'versus';
  timestamp: number;
  winner: string; // 'P1' | 'P2'
  rounds: string; // 예: '2-1'
  durationMs: number;
}

export type GameRecord = SoloRecord | VersusRecord;

// localStorage와 테스트용 인메모리 스토리지가 공유하는 최소 인터페이스
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'tetris.records.v1';

/** txt 왕복 시 밀리초가 소실되므로 초 단위로 정규화해 중복 판정을 안정화한다 */
export function normalizeTimestamp(ms: number): number {
  return Math.floor(ms / 1000) * 1000;
}

function dedupKey(record: GameRecord): string {
  return `${record.kind}:${normalizeTimestamp(record.timestamp)}`;
}

export class ScoreStore {
  private records: GameRecord[] = [];

  constructor(private readonly storage: KeyValueStorage) {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) this.records = JSON.parse(raw) as GameRecord[];
    } catch {
      this.records = [];
    }
  }

  add(record: GameRecord): void {
    this.records.push({ ...record, timestamp: normalizeTimestamp(record.timestamp) });
    this.persist();
  }

  /** 최신순 전체 기록 */
  all(): GameRecord[] {
    return [...this.records].sort((a, b) => b.timestamp - a.timestamp);
  }

  /** 시간순(오래된 것부터) — txt 직렬화용 */
  chronological(): GameRecord[] {
    return [...this.records].sort((a, b) => a.timestamp - b.timestamp);
  }

  topSolo(count = 10): SoloRecord[] {
    return this.records
      .filter((r): r is SoloRecord => r.kind === 'solo')
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /** 타임스탬프(초)+모드 기준으로 중복을 제거하며 병합. 추가된 개수를 반환 */
  merge(incoming: GameRecord[]): number {
    const seen = new Set(this.records.map(dedupKey));
    let added = 0;
    for (const record of incoming) {
      const key = dedupKey(record);
      if (seen.has(key)) continue;
      seen.add(key);
      this.records.push({ ...record, timestamp: normalizeTimestamp(record.timestamp) });
      added++;
    }
    if (added > 0) this.persist();
    return added;
  }

  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // 저장 공간 부족 등 — 런타임 기록은 유지되므로 치명적이지 않다
    }
  }
}
