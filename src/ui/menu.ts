// 메인 메뉴 + 조작법 화면 (PRD 6.1: 1인용 / 2인용 / 기록 / 조작법)

export type MenuAction = 'solo' | 'versus' | 'records' | 'controls';

const ITEMS: ReadonlyArray<{ action: MenuAction; label: string }> = [
  { action: 'solo', label: '1인용 시작' },
  { action: 'versus', label: '2인용 시작' },
  { action: 'records', label: '기록' },
  { action: 'controls', label: '조작법' },
];

export class MainMenu {
  private readonly el: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[];
  private readonly select: (action: MenuAction) => void;
  private index = 0;

  constructor(parent: HTMLElement, onSelect: (action: MenuAction) => void) {
    this.select = onSelect;
    this.el = document.createElement('div');
    this.el.className = 'menu-root';
    this.el.innerHTML = `
      <h1 class="menu-title">TETRIS</h1>
      <div class="menu-items">
        ${ITEMS.map((item) => `<button type="button" class="menu-item" tabindex="-1">${item.label}</button>`).join('')}
      </div>
      <p class="menu-hint">↑↓ 선택 · Enter 확인</p>`;
    parent.appendChild(this.el);

    this.buttons = [...this.el.querySelectorAll<HTMLButtonElement>('.menu-item')];
    this.buttons.forEach((button, i) => {
      button.addEventListener('click', () => this.select(ITEMS[i]!.action));
      button.addEventListener('mouseenter', () => this.setIndex(i));
    });
    this.setIndex(0);
  }

  show(): void {
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.el.classList.add('hidden');
  }

  moveFocus(delta: -1 | 1): void {
    this.setIndex((this.index + delta + ITEMS.length) % ITEMS.length);
  }

  activate(): void {
    this.select(ITEMS[this.index]!.action);
  }

  private setIndex(index: number): void {
    this.index = index;
    this.buttons.forEach((button, i) => button.classList.toggle('active', i === index));
  }
}

export class ControlsPanel {
  visible = false;
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'records-panel hidden'; // 같은 오버레이 스타일 재사용
    this.el.innerHTML = `
      <div class="records-inner">
        <h2>조작법</h2>
        <div class="records-columns">
          <section>
            <h3>1인용</h3>
            <table class="controls-table">
              <tr><td>이동</td><td>← →</td></tr>
              <tr><td>소프트 드롭</td><td>↓</td></tr>
              <tr><td>하드 드롭</td><td>Space</td></tr>
              <tr><td>회전</td><td>↑/X 시계 · Z 반시계</td></tr>
              <tr><td>홀드</td><td>C 또는 Shift</td></tr>
              <tr><td>일시정지</td><td>Esc 또는 P</td></tr>
            </table>
          </section>
          <section>
            <h3>2인용 (한 키보드)</h3>
            <table class="controls-table">
              <tr><td></td><td>P1 (왼쪽)</td><td>P2 (오른쪽)</td></tr>
              <tr><td>이동</td><td>A / D</td><td>← / →</td></tr>
              <tr><td>소프트</td><td>S</td><td>↓</td></tr>
              <tr><td>하드</td><td>W</td><td>↑</td></tr>
              <tr><td>회전</td><td>F 시계 · G 반시계</td><td>. 시계 · , 반시계</td></tr>
              <tr><td>홀드</td><td>R 또는 Q</td><td>/</td></tr>
            </table>
          </section>
        </div>
        <div class="records-close">Esc/Enter 키로 닫기</div>
      </div>`;
    parent.appendChild(this.el);
  }

  show(): void {
    this.visible = true;
    this.el.classList.remove('hidden');
  }

  hide(): void {
    this.visible = false;
    this.el.classList.add('hidden');
  }
}
