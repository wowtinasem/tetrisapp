// 조작/루프 튜닝값 — 체감 조정은 전부 이 파일에서 한다 (implementation_plan 4장 리스크 대응)

export const TICK_MS = 1000 / 60; // 고정 타임스텝 (60 ticks/sec)
export const DAS_MS = 167; // 자동 반복 시작 지연
export const ARR_MS = 33; // 자동 반복 간격

export interface KeyBindings {
  left: readonly string[];
  right: readonly string[];
  softDrop: readonly string[];
  hardDrop: readonly string[];
  rotateCW: readonly string[];
  rotateCCW: readonly string[];
  hold: readonly string[];
}

// PRD 5.1 — 1인용 키 배치 (KeyboardEvent.code 기준)
export const SOLO_KEYS: KeyBindings = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: ['Space'],
  rotateCW: ['ArrowUp', 'KeyX'],
  rotateCCW: ['KeyZ'],
  hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
};

export const PAUSE_KEYS: readonly string[] = ['Escape', 'KeyP'];
export const RESTART_KEYS: readonly string[] = ['KeyR'];

export function allBindingCodes(bindings: KeyBindings): string[] {
  return [
    ...bindings.left,
    ...bindings.right,
    ...bindings.softDrop,
    ...bindings.hardDrop,
    ...bindings.rotateCW,
    ...bindings.rotateCCW,
    ...bindings.hold,
  ];
}
