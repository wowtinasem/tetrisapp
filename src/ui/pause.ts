// 일시정지/결과 오버레이 (PRD 6.1 — 계속하기 / 재시작 / 메뉴로)

export class PauseOverlay {
  constructor(private readonly el: HTMLElement) {}

  showPause(): void {
    this.show('PAUSED', 'Esc/Enter 계속 · R 재시작 · M 메뉴로');
  }

  show(main: string, sub = ''): void {
    this.el.innerHTML =
      `<div>${main}</div>` + (sub ? `<div class="overlay-sub">${sub}</div>` : '');
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }
}
