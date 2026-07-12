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

// PRD 5.2 — 2인용 키 배치 (한 키보드, 고스팅 방지를 위해 영역 분산)
export const VERSUS_KEYS: readonly [KeyBindings, KeyBindings] = [
  {
    left: ['KeyA'],
    right: ['KeyD'],
    softDrop: ['KeyS'],
    hardDrop: ['KeyW'],
    rotateCW: ['KeyF'],
    rotateCCW: ['KeyG'],
    hold: ['KeyR', 'KeyQ'],
  },
  {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    softDrop: ['ArrowDown'],
    hardDrop: ['ArrowUp'],
    rotateCW: ['Period'],
    rotateCCW: ['Comma'],
    hold: ['Slash'],
  },
];

// PRD 3.2 — 2인용 배틀 규칙
export const VERSUS_BASE_LEVEL = 5; // 낙하 속도 고정 시작 레벨
export const VERSUS_LEVEL_UP_MS = 5 * 60_000; // 5분마다 한 단계 상승
export const VERSUS_TARGET_WINS = 2; // 3판 2선승

export const PAUSE_KEYS: readonly string[] = ['Escape', 'KeyP'];
export const RESTART_KEYS: readonly string[] = ['KeyR'];
export const MODE_SOLO_KEYS: readonly string[] = ['Digit1'];
export const MODE_VERSUS_KEYS: readonly string[] = ['Digit2'];
export const NEXT_ROUND_KEYS: readonly string[] = ['Space'];

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
