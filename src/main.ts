// 진입점: 메뉴/솔로/대전 씬, 입력/렌더러 연결, 고정 타임스텝(60tps) 게임 루프

import './style.css';
import {
  allBindingCodes,
  CONFIRM_KEYS,
  MENU_DOWN_KEYS,
  MENU_KEYS,
  MENU_UP_KEYS,
  NEXT_ROUND_KEYS,
  PAUSE_KEYS,
  RESTART_KEYS,
  SOLO_KEYS,
  TICK_MS,
  VERSUS_KEYS,
} from './config';
import { Sfx } from './audio/sfx';
import { BOARD_HEIGHT, BOARD_WIDTH } from './core/board';
import { Game } from './core/game';
import { DasRepeater } from './input/das';
import { Keyboard } from './input/keyboard';
import { BoardRenderer } from './render/boardRenderer';
import { Hud } from './render/hud';
import { spawnClearPopup } from './render/popup';
import { createScoreFileSync } from './score/fileSync';
import { ScoreStore, type SoloRecord, type VersusRecord } from './score/scoreStore';
import { serializeRecord } from './score/txtFormat';
import { ControlsPanel, MainMenu, type MenuAction } from './ui/menu';
import { PauseOverlay } from './ui/pause';
import { RecordsPanel } from './ui/records';
import { Match } from './versus/match';

type Mode = 'menu' | 'solo' | 'versus';

const RECORDS_KEYS: readonly string[] = ['Tab'];
const MUTE_KEYS: readonly string[] = ['KeyN'];
const HELP_TEXT: Record<Mode, string> = {
  menu: '',
  solo: '←→ 이동 · ↓ 소프트 · Space 하드 · ↑/X · Z 회전 · C/Shift 홀드 · Esc 일시정지 · Tab 기록 · N 음소거',
  versus:
    'P1: A/D 이동 · S 소프트 · W 하드 · F/G 회전 · R/Q 홀드 │ P2: ←→ 이동 · ↓ 소프트 · ↑ 하드 · ./, 회전 · / 홀드 │ Esc 일시정지 · N 음소거',
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="solo-root" class="hidden">
    <div class="game-layout">
      <div class="side" id="left-pane"></div>
      <div class="board-wrap" id="solo-wrap">
        <canvas id="board"></canvas>
        <div class="overlay hidden" id="overlay"></div>
      </div>
      <div class="side" id="right-pane"></div>
    </div>
  </div>
  <div id="versus-root" class="hidden">
    <div class="versus-layout">
      ${[1, 2]
        .map(
          (p) => `
      <div class="player-column">
        <div class="player-title">PLAYER ${p} <span class="player-wins" id="p${p}-wins"></span></div>
        <div class="game-layout">
          <div class="side" id="p${p}-left"></div>
          <div class="board-wrap" id="p${p}-wrap"><canvas id="p${p}-board"></canvas></div>
          <div class="side" id="p${p}-right"></div>
        </div>
      </div>`,
        )
        .join('')}
    </div>
    <div class="overlay hidden" id="versus-overlay"></div>
  </div>
  <p class="help" id="help"></p>
`;

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const helpEl = $('#help');
const soloRoot = $('#solo-root');
const versusRoot = $('#versus-root');
const soloBoardWrap = $('#solo-wrap');

// --- 공용 ---
const keyboard = new Keyboard(
  new Set([
    ...allBindingCodes(SOLO_KEYS),
    ...VERSUS_KEYS.flatMap((k) => allBindingCodes(k)),
    ...PAUSE_KEYS,
    ...RESTART_KEYS,
    ...MENU_KEYS,
    ...NEXT_ROUND_KEYS,
    ...RECORDS_KEYS,
  ]),
);
keyboard.attach();

const sfx = new Sfx();
const store = new ScoreStore(localStorage);
const fileSync = createScoreFileSync();
const recordsPanel = new RecordsPanel(document.body, store, fileSync);
const controlsPanel = new ControlsPanel(document.body);
const menu = new MainMenu(app, (action) => onMenuSelect(action));

let mode: Mode = 'menu';
let paused = false;

// --- 솔로 모드 상태 ---
let game = new Game();
let lastLockSeq = 0;
let playTimeMs = 0;
let recordSaved = false;
const soloDas = new DasRepeater();
const soloRenderer = new BoardRenderer($<HTMLCanvasElement>('#board'));
const soloHud = new Hud($('#left-pane'), $('#right-pane'));
const soloPause = new PauseOverlay($('#overlay'));

// --- 대전 모드 상태 ---
let match = new Match();
let versusPlayMs = 0;
let versusSaved = false;
const versusLockSeqs: [number, number] = [0, 0];
const versusGarbageSeen: [number, number] = [0, 0];
const versusDas = [new DasRepeater(), new DasRepeater()] as const;
const versusRenderers = [
  new BoardRenderer($<HTMLCanvasElement>('#p1-board'), 26),
  new BoardRenderer($<HTMLCanvasElement>('#p2-board'), 26),
] as const;
const versusHuds = [
  new Hud($('#p1-left'), $('#p1-right'), 3),
  new Hud($('#p2-left'), $('#p2-right'), 3),
] as const;
const versusWraps = [$('#p1-wrap'), $('#p2-wrap')] as const;
const versusWinEls = [$('#p1-wins'), $('#p2-wins')] as const;
const versusPause = new PauseOverlay($('#versus-overlay'));

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 창 크기 대응 보드 스케일링 (PRD 6.4) */
function layout(): void {
  const availH = window.innerHeight - 200;
  if (mode === 'solo') {
    soloRenderer.resize(clamp(Math.floor(Math.min(availH / 20, (window.innerWidth - 340) / 10)), 16, 34));
  } else if (mode === 'versus') {
    const cell = clamp(Math.floor(Math.min(availH / 20, (window.innerWidth - 480) / 20)), 14, 30);
    versusRenderers[0].resize(cell);
    versusRenderers[1].resize(cell);
  }
}
window.addEventListener('resize', layout);

/** 하드 드롭 진동 효과 (PRD 6.2) */
function shake(el: HTMLElement): void {
  el.classList.remove('shake');
  void el.offsetWidth; // 리플로우로 애니메이션 재시작
  el.classList.add('shake');
}

function startSolo(): void {
  game = new Game();
  soloDas.reset();
  paused = false;
  lastLockSeq = 0;
  playTimeMs = 0;
  recordSaved = false;
}

function startVersus(): void {
  match = new Match();
  versusPlayMs = 0;
  versusSaved = false;
  versusLockSeqs[0] = 0;
  versusLockSeqs[1] = 0;
  versusGarbageSeen[0] = 0;
  versusGarbageSeen[1] = 0;
  versusDas[0].reset();
  versusDas[1].reset();
  paused = false;
}

/**
 * 위기 강도: 스택 높이가 14줄(보이는 영역 상단 6줄 이내)부터 0~1로 상승.
 * null이면 위기 아님 — 하트비트 정지.
 */
function stackDanger(g: Game): number | null {
  let topRow = BOARD_HEIGHT;
  outer: for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (g.board[y]![x] !== null) {
        topRow = y;
        break outer;
      }
    }
  }
  const height = BOARD_HEIGHT - topRow;
  const dangerStart = 14;
  if (height < dangerStart) return null;
  return Math.min(1, (height - dangerStart) / (BOARD_HEIGHT - dangerStart));
}

function switchMode(next: Mode): void {
  mode = next;
  soloRoot.classList.toggle('hidden', mode !== 'solo');
  versusRoot.classList.toggle('hidden', mode !== 'versus');
  if (mode === 'menu') menu.show();
  else menu.hide();
  helpEl.textContent = HELP_TEXT[mode];
  layout();
}

function onMenuSelect(action: MenuAction): void {
  if (action === 'solo') {
    startSolo();
    switchMode('solo');
  } else if (action === 'versus') {
    startVersus();
    switchMode('versus');
  } else if (action === 'records') {
    recordsPanel.toggle();
  } else {
    controlsPanel.show();
  }
}

function saveSoloRecord(): void {
  const record: SoloRecord = {
    kind: 'solo',
    timestamp: Date.now(),
    player: 'P1',
    score: game.score,
    lines: game.totalLines,
    level: game.level,
    durationMs: playTimeMs,
  };
  store.add(record);
  void fileSync.appendLine(serializeRecord(record));
}

function saveVersusRecord(): void {
  const winner = match.matchWinner;
  if (winner === null) return;
  const record: VersusRecord = {
    kind: 'versus',
    timestamp: Date.now(),
    winner: `P${winner + 1}`,
    rounds: `${match.wins[winner]}-${match.wins[1 - winner]}`,
    durationMs: versusPlayMs,
  };
  store.add(record);
  void fileSync.appendLine(serializeRecord(record));
}

function applyPlayerInput(playerGame: Game, index: 0 | 1, deltaMs: number): void {
  const keys = VERSUS_KEYS[index];
  const moves = versusDas[index].update(
    keyboard.isAnyDown(keys.left),
    keyboard.isAnyDown(keys.right),
    deltaMs,
  );
  let moved = false;
  for (let i = 0; i < Math.abs(moves); i++) {
    if (playerGame.moveActive(moves > 0 ? 1 : -1)) moved = true;
  }
  if (moved) sfx.move();
  if (keyboard.consumePress(keys.rotateCW) && playerGame.rotateActive(1)) sfx.rotate();
  if (keyboard.consumePress(keys.rotateCCW) && playerGame.rotateActive(-1)) sfx.rotate();
  playerGame.setSoftDrop(keyboard.isAnyDown(keys.softDrop));
  if (keyboard.consumePress(keys.hardDrop)) {
    sfx.hardDrop();
    playerGame.hardDrop();
    shake(versusWraps[index]);
  }
  if (keyboard.consumePress(keys.hold) && playerGame.holdActive()) sfx.hold();
}

function updateMenu(): void {
  if (keyboard.consumePress(MENU_UP_KEYS)) menu.moveFocus(-1);
  if (keyboard.consumePress(MENU_DOWN_KEYS)) menu.moveFocus(1);
  if (keyboard.consumePress([...CONFIRM_KEYS, ...NEXT_ROUND_KEYS])) menu.activate();
}

function updateSolo(deltaMs: number): void {
  if (game.isGameOver) {
    if (keyboard.consumePress(RESTART_KEYS)) startSolo();
    else if (keyboard.consumePress(MENU_KEYS)) switchMode('menu');
    return;
  }
  if (keyboard.consumePress(PAUSE_KEYS)) paused = !paused;
  if (paused) {
    if (keyboard.consumePress(CONFIRM_KEYS)) paused = false;
    else if (keyboard.consumePress(RESTART_KEYS)) startSolo();
    else if (keyboard.consumePress(MENU_KEYS)) switchMode('menu');
    return;
  }
  playTimeMs += deltaMs;

  const moves = soloDas.update(
    keyboard.isAnyDown(SOLO_KEYS.left),
    keyboard.isAnyDown(SOLO_KEYS.right),
    deltaMs,
  );
  let moved = false;
  for (let i = 0; i < Math.abs(moves); i++) {
    if (game.moveActive(moves > 0 ? 1 : -1)) moved = true;
  }
  if (moved) sfx.move();

  if (keyboard.consumePress(SOLO_KEYS.rotateCW) && game.rotateActive(1)) sfx.rotate();
  if (keyboard.consumePress(SOLO_KEYS.rotateCCW) && game.rotateActive(-1)) sfx.rotate();
  game.setSoftDrop(keyboard.isAnyDown(SOLO_KEYS.softDrop));
  if (keyboard.consumePress(SOLO_KEYS.hardDrop)) {
    sfx.hardDrop();
    game.hardDrop();
    shake(soloBoardWrap);
  }
  if (keyboard.consumePress(SOLO_KEYS.hold) && game.holdActive()) sfx.hold();

  game.tick(deltaMs);

  if (game.isGameOver && !recordSaved) {
    recordSaved = true;
    sfx.gameOver();
    saveSoloRecord();
  }
}

function updateVersus(deltaMs: number): void {
  if (match.phase === 'playing') {
    if (keyboard.consumePress(PAUSE_KEYS)) paused = !paused;
    if (paused) {
      if (keyboard.consumePress(CONFIRM_KEYS)) paused = false;
      else if (keyboard.consumePress(RESTART_KEYS)) startVersus();
      else if (keyboard.consumePress(MENU_KEYS)) switchMode('menu');
      return;
    }
    versusPlayMs += deltaMs;
    applyPlayerInput(match.games[0], 0, deltaMs);
    applyPlayerInput(match.games[1], 1, deltaMs);
    match.tick(deltaMs);
    if (match.roundWinner !== null) sfx.gameOver(); // 이번 틱에 라운드/시리즈 종료
    if (match.isOver && !versusSaved) {
      versusSaved = true;
      saveVersusRecord();
    }
  } else if (match.phase === 'roundover') {
    if (keyboard.consumePress(NEXT_ROUND_KEYS)) match.nextRound();
    else if (keyboard.consumePress(MENU_KEYS)) switchMode('menu');
  } else {
    if (keyboard.consumePress([...NEXT_ROUND_KEYS, ...RESTART_KEYS])) {
      match.rematch();
      versusPlayMs = 0;
      versusSaved = false;
    } else if (keyboard.consumePress(MENU_KEYS)) {
      switchMode('menu');
    }
  }
}

function update(deltaMs: number): void {
  if (keyboard.consumePress(MUTE_KEYS)) sfx.toggleMute();
  if (keyboard.consumePress(RECORDS_KEYS)) recordsPanel.toggle();
  if (recordsPanel.visible) {
    // 기록 화면이 열려 있으면 게임 정지, Esc로도 닫기
    if (keyboard.consumePress(PAUSE_KEYS)) recordsPanel.close();
    return;
  }

  if (controlsPanel.visible) {
    if (keyboard.consumePress([...PAUSE_KEYS, ...CONFIRM_KEYS])) controlsPanel.hide();
    return;
  }

  if (mode === 'menu') updateMenu();
  else if (mode === 'solo') updateSolo(deltaMs);
  else updateVersus(deltaMs);
}

function renderSolo(): void {
  soloRenderer.draw(game);
  soloHud.update(game, game.score);

  const lock = game.lastLock;
  if (lock && lock.seq !== lastLockSeq) {
    lastLockSeq = lock.seq;
    spawnClearPopup(soloBoardWrap, lock);
    soloRenderer.flash(lock.clearedRows);
    if (lock.linesCleared > 0) sfx.clear(lock.linesCleared, lock.tspin);
    else sfx.lock();
  }

  // 스택이 천장에 가까워지면 하트비트로 긴장감 고조
  if (!paused && !game.isGameOver && !recordsPanel.visible) sfx.danger(stackDanger(game));

  if (game.isGameOver) {
    soloPause.show(
      'GAME OVER',
      `점수 ${game.score.toLocaleString()} · ${game.totalLines}줄 · Lv${game.level}<br>R 재시작 · M 메뉴로`,
    );
  } else if (paused) {
    soloPause.showPause();
  } else {
    soloPause.hide();
  }
}

function renderVersus(): void {
  match.games.forEach((playerGame, i) => {
    versusRenderers[i]!.draw(playerGame);
    versusHuds[i]!.update(playerGame, playerGame.score);
    versusWinEls[i]!.textContent = `승 ${match.wins[i]}`;
    const lock = playerGame.lastLock;
    if (lock && lock.seq !== versusLockSeqs[i]) {
      versusLockSeqs[i as 0 | 1] = lock.seq;
      spawnClearPopup(versusWraps[i]!, lock);
      versusRenderers[i]!.flash(lock.clearedRows);
      if (lock.linesCleared > 0) sfx.clear(lock.linesCleared, lock.tspin);
      else sfx.lock();
    }

    // 가비지 수신 경고음
    const pendingGarbage = playerGame.garbage.total;
    if (pendingGarbage > versusGarbageSeen[i]!) sfx.garbage();
    versusGarbageSeen[i as 0 | 1] = pendingGarbage;
  });

  // 두 보드 중 더 위험한 쪽 기준으로 하트비트
  if (match.phase === 'playing' && !paused && !recordsPanel.visible) {
    const dangers = match.games
      .map((g) => stackDanger(g))
      .filter((d): d is number => d !== null);
    sfx.danger(dangers.length > 0 ? Math.max(...dangers) : null);
  }

  if (match.isOver) {
    versusPause.show(
      `PLAYER ${match.matchWinner! + 1} 시리즈 승리! (${match.wins[match.matchWinner!]}-${match.wins[1 - match.matchWinner!]})`,
      'Space/R 재대결 · M 메뉴로',
    );
  } else if (match.phase === 'roundover') {
    versusPause.show(
      `ROUND ${match.round} — PLAYER ${match.roundWinner! + 1} 승리!`,
      `${match.wins[0]} : ${match.wins[1]} · Space 다음 라운드 · M 메뉴로`,
    );
  } else if (paused) {
    versusPause.showPause();
  } else {
    versusPause.hide();
  }
}

function render(): void {
  if (mode === 'solo') renderSolo();
  else if (mode === 'versus') renderVersus();
}

// 시작 씬 결정 (#versus / #records 해시는 검증·직접 탐색용)
switchMode('menu');
if (location.hash === '#versus') {
  startVersus();
  switchMode('versus');
} else if (location.hash === '#solo') {
  startSolo();
  switchMode('solo');
} else if (location.hash === '#records') {
  recordsPanel.toggle();
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
