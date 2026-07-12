// keydown/keyup 상태 폴링 (PRD 7.2 — DAS/ARR 구현을 위해 이벤트가 아닌 폴링 방식)

export class Keyboard {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();

  /** preventCodes에 포함된 키는 브라우저 기본 동작(스크롤 등)을 막는다 */
  constructor(private readonly preventCodes: ReadonlySet<string> = new Set()) {}

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.preventCodes.has(e.code)) e.preventDefault();
    if (e.repeat) return; // OS 자동 반복은 무시 — 반복은 DAS/ARR가 담당
    this.held.add(e.code);
    this.pressed.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
  };

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('blur', this.onBlur);
  }

  isAnyDown(codes: readonly string[]): boolean {
    return codes.some((code) => this.held.has(code));
  }

  /** 이번 프레임에 새로 눌린 키를 1회성으로 소비 (한 번 누름 = 한 번 동작) */
  consumePress(codes: readonly string[]): boolean {
    if (!codes.some((code) => this.pressed.has(code))) return false;
    for (const code of codes) this.pressed.delete(code);
    return true;
  }

  /** 프레임 종료 시 호출 — 소비되지 않은 press를 비운다 */
  endFrame(): void {
    this.pressed.clear();
  }
}
