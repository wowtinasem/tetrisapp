// 효과음 (PRD 6.3) — Web Audio API 합성음, 에셋 파일 없음
// AudioContext는 브라우저 자동재생 정책 때문에 첫 사용자 입력 시점에 생성한다.

const MUTE_KEY = 'tetris.muted.v1';

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  endFreq?: number;
  delayMs?: number;
}

export class Sfx {
  muted: boolean;

  private ctx: AudioContext | null = null;
  private lastDangerAt = 0;

  constructor() {
    let saved = false;
    try {
      saved = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // localStorage 접근 불가 환경이면 기본값(켜짐) 사용
    }
    this.muted = saved;
  }

  /** 음소거 토글 — 설정은 localStorage에 저장 (PRD 6.3) */
  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // 저장 실패해도 런타임 설정은 유지
    }
    return this.muted;
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, durMs: number, opts: ToneOptions = {}): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delayMs ?? 0) / 1000;
    const dur = durMs / 1000;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = opts.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + dur);
    gainNode.gain.setValueAtTime(opts.gain ?? 0.15, t0);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 좌우 이동 — 짧고 낮은 블립 */
  move(): void {
    this.tone(210, 30, { type: 'square', gain: 0.055 });
  }

  /** 회전 — 위로 살짝 휘는 소리 */
  rotate(): void {
    this.tone(300, 55, { type: 'triangle', gain: 0.12, endFreq: 430 });
  }

  /** 홀드 */
  hold(): void {
    this.tone(520, 60, { type: 'triangle', gain: 0.1, endFreq: 620 });
  }

  /** 하드 드롭 — 아래로 떨어지는 휘파람 */
  hardDrop(): void {
    this.tone(320, 90, { type: 'sawtooth', gain: 0.13, endFreq: 70 });
  }

  /** 블록 고정 — 둔탁한 착지음 */
  lock(): void {
    this.tone(130, 70, { type: 'sine', gain: 0.18, endFreq: 85 });
  }

  /** 라인 클리어 — 지운 줄 수만큼 올라가는 아르페지오, 테트리스는 한 옥타브 위까지 */
  clear(lines: number, tspin: boolean): void {
    if (tspin) {
      this.tone(660, 80, { type: 'square', gain: 0.12 });
      this.tone(880, 130, { type: 'square', gain: 0.12, delayMs: 75 });
      return;
    }
    const scale = [523, 659, 784, 1047];
    const notes = scale.slice(0, Math.min(lines, 4));
    notes.forEach((freq, i) => this.tone(freq, 90, { type: 'triangle', gain: 0.13, delayMs: i * 60 }));
  }

  /** 가비지 수신 경고 — 낮은 버즈 */
  garbage(): void {
    this.tone(95, 180, { type: 'sawtooth', gain: 0.15, endFreq: 60 });
  }

  /** 게임 오버/라운드 종료 — 하강 멜로디 */
  gameOver(): void {
    [440, 330, 220, 110].forEach((freq, i) =>
      this.tone(freq, 170, { type: 'triangle', gain: 0.15, delayMs: i * 140 }),
    );
  }

  /**
   * 위기 하트비트 — 스택이 천장에 가까울수록 빨라지고 커진다.
   * intensity 0~1 (null이면 정지). 매 프레임 호출해도 내부에서 박자를 조절한다.
   */
  danger(intensity: number | null): void {
    if (intensity === null || this.muted) return;
    const now = performance.now();
    const interval = 800 - intensity * 520; // 최고조에 280ms 간격
    if (now - this.lastDangerAt < interval) return;
    this.lastDangerAt = now;
    const gain = 0.11 + intensity * 0.1;
    this.tone(75, 90, { type: 'sine', gain, endFreq: 55 });
    this.tone(68, 80, { type: 'sine', gain: gain * 0.7, delayMs: 130, endFreq: 52 }); // 두 번째 박동
  }
}
