// 진입점: 레이아웃 구성, 입력/렌더러 연결, 고정 타임스텝(60tps) 게임 루프
// 메인 메뉴/씬 전환은 Phase 7에서 이 위에 얹는다.

import './style.css';
import { allBindingCodes, PAUSE_KEYS, RESTART_KEYS, SOLO_KEYS, TICK_MS } from './config';
import { Game } from './core/game';
import { DasRepeater } from './input/das';
import { Keyboard } from './input/keyboard';
import { BoardRenderer } from './render/boardRenderer';
import { Hud } from './render/hud';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="game-layout">
    <div class="side" id="left-pane"></div>
    <div class="board-wrap">
      <canvas id="board"></canvas>
      <div class="overlay hidden" id="overlay"></div>
    </div>
    <div class="side" id="right-pane"></div>
  </div>
  <p class="help">←→ 이동 · ↓ 소프트 · Space 하드 · ↑/X · Z 회전 · C/Shift 홀드 · Esc/P 일시정지</p>
`;

const boardCanvas = document.querySelector<HTMLCanvasElement>('#board')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;

let game = new Game();
let paused = false;

const keyboard = new Keyboard(
  new Set([...allBindingCodes(SOLO_KEYS), ...PAUSE_KEYS]),
);
keyboard.attach();
const das = new DasRepeater();
const renderer = new BoardRenderer(boardCanvas);
const hud = new Hud(
  document.querySelector<HTMLElement>('#left-pane')!,
  document.querySelector<HTMLElement>('#right-pane')!,
);

function update(deltaMs: number): void {
  if (game.phase === 'gameover') {
    if (keyboard.consumePress(RESTART_KEYS)) {
      game = new Game();
      das.reset();
      paused = false;
    }
    return;
  }
  if (keyboard.consumePress(PAUSE_KEYS)) paused = !paused;
  if (paused) return;

  const moves = das.update(
    keyboard.isAnyDown(SOLO_KEYS.left),
    keyboard.isAnyDown(SOLO_KEYS.right),
    deltaMs,
  );
  for (let i = 0; i < Math.abs(moves); i++) game.moveActive(moves > 0 ? 1 : -1);

  if (keyboard.consumePress(SOLO_KEYS.rotateCW)) game.rotateActive(1);
  if (keyboard.consumePress(SOLO_KEYS.rotateCCW)) game.rotateActive(-1);
  game.setSoftDrop(keyboard.isAnyDown(SOLO_KEYS.softDrop));
  if (keyboard.consumePress(SOLO_KEYS.hardDrop)) game.hardDrop();
  if (keyboard.consumePress(SOLO_KEYS.hold)) game.holdActive();

  game.tick(deltaMs);
}

function render(): void {
  renderer.draw(game);
  hud.update(game, 0); // 점수 계산은 Phase 4

  if (game.phase === 'gameover') {
    overlay.innerHTML = '<div>GAME OVER</div><div class="overlay-sub">R 키로 재시작</div>';
    overlay.classList.remove('hidden');
  } else if (paused) {
    overlay.innerHTML = '<div>PAUSED</div><div class="overlay-sub">Esc/P 키로 계속</div>';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  // 탭 비활성화 등으로 프레임이 밀려도 한 번에 최대 250ms까지만 따라잡는다
  accumulator = Math.min(accumulator + (now - last), 250);
  last = now;
  while (accumulator >= TICK_MS) {
    update(TICK_MS);
    accumulator -= TICK_MS;
  }
  keyboard.endFrame();
  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
