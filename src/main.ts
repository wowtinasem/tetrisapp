// 진입점: 솔로/대전 모드, 입력/렌더러 연결, 고정 타임스텝(60tps) 게임 루프
// 메인 메뉴/씬 전환 UI는 Phase 7에서 이 위에 얹는다. (임시: 1 솔로 / 2 대전 키 전환)

import './style.css';
import {
  allBindingCodes,
  MODE_SOLO_KEYS,
  MODE_VERSUS_KEYS,
  NEXT_ROUND_KEYS,
  PAUSE_KEYS,
  RESTART_KEYS,
  SOLO_KEYS,
  TICK_MS,
  VERSUS_KEYS,
} from './config';
import { Game } from './core/game';
import { DasRepeater } from './input/das';
import { Keyboard } from './input/keyboard';
import { BoardRenderer } from './render/boardRenderer';
import { Hud } from './render/hud';
import { spawnClearPopup } from './render/popup';
import { createScoreFileSync } from './score/fileSync';
import { ScoreStore, type SoloRecord, type VersusRecord } from './score/scoreStore';
import { serializeRecord } from './score/txtFormat';
import { RecordsPanel } from './ui/records';
import { Match } from './versus/match';

const RECORDS_KEYS: readonly string[] = ['Tab'];
const HELP_SOLO =
  '←→ 이동 · ↓ 소프트 · Space 하드 · ↑/X · Z 회전 · C/Shift 홀드 · Esc/P 일시정지 · Tab 기록 · 2 대전';
const HELP_VERSUS =
  'P1: A/D 이동 · S 소프트 · W 하드 · F/G 회전 · R/Q 홀드 │ P2: ←→ 이동 · ↓ 소프트 · ↑ 하드 · ./, 회전 · / 홀드 │ Esc 일시정지 · 1 솔로';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div id="solo-root">
    <div class="game-layout">
      <div class="side" id="left-pane"></div>
      <div class="board-wrap">
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

const $ = <T extends HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector)!;

const helpEl = $('#help');
const soloRoot = $('#solo-root');
const versusRoot = $('#versus-root');
const soloOverlay = $('#overlay');
const versusOverlay = $('#versus-overlay');
const soloBoardWrap = $<HTMLDivElement>('#solo-root .board-wrap');

// --- 공용 ---
const keyboard = new Keyboard(
  new Set([
    ...allBindingCodes(SOLO_KEYS),
    ...VERSUS_KEYS.flatMap((k) => allBindingCodes(k)),
    ...PAUSE_KEYS,
    ...RESTART_KEYS,
    ...MODE_SOLO_KEYS,
    ...MODE_VERSUS_KEYS,
    ...NEXT_ROUND_KEYS,
    ...RECORDS_KEYS,
  ]),
);
keyboard.attach();

const store = new ScoreStore(localStorage);
const fileSync = createScoreFileSync();
const recordsPanel = new RecordsPanel(document.body, store, fileSync);

let mode: 'solo' | 'versus' = 'solo';
let paused = false;

// --- 솔로 모드 상태 ---
let game = new Game();
let lastLockSeq = 0;
let playTimeMs = 0;
let recordSaved = false;
const soloDas = new DasRepeater();
const soloRenderer = new BoardRenderer($('#board') as unknown as HTMLCanvasElement);
const soloHud = new Hud($('#left-pane'), $('#right-pane'));

// --- 대전 모드 상태 ---
let match = new Match();
let versusPlayMs = 0;
let versusSaved = false;
const versusLockSeqs: [number, number] = [0, 0];
const versusDas = [new DasRepeater(), new DasRepeater()] as const;
const versusRenderers = [
  new BoardRenderer($('#p1-board') as unknown as HTMLCanvasElement, 26),
  new BoardRenderer($('#p2-board') as unknown as HTMLCanvasElement, 26),
] as const;
const versusHuds = [
  new Hud($('#p1-left'), $('#p1-right'), 3),
  new Hud($('#p2-left'), $('#p2-right'), 3),
] as const;
const versusWraps = [$('#p1-wrap'), $('#p2-wrap')] as const;
const versusWinEls = [$('#p1-wins'), $('#p2-wins')] as const;

function switchMode(next: 'solo' | 'versus'): void {
  mode = next;
  paused = mode === 'solo'; // 진행 중이던 솔로 게임은 일시정지 상태로 복귀
  soloRoot.classList.toggle('hidden', mode !== 'solo');
  versusRoot.classList.toggle('hidden', mode !== 'versus');
  helpEl.textContent = mode === 'solo' ? HELP_SOLO : HELP_VERSUS;
  if (mode === 'versus') {
    match = new Match();
    versusPlayMs = 0;
    versusSaved = false;
    versusLockSeqs[0] = 0;
    versusLockSeqs[1] = 0;
    versusDas[0].reset();
    versusDas[1].reset();
    paused = false;
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
  for (let i = 0; i < Math.abs(moves); i++) playerGame.moveActive(moves > 0 ? 1 : -1);
  if (keyboard.consumePress(keys.rotateCW)) playerGame.rotateActive(1);
  if (keyboard.consumePress(keys.rotateCCW)) playerGame.rotateActive(-1);
  playerGame.setSoftDrop(keyboard.isAnyDown(keys.softDrop));
  if (keyboard.consumePress(keys.hardDrop)) playerGame.hardDrop();
  if (keyboard.consumePress(keys.hold)) playerGame.holdActive();
}

function updateSolo(deltaMs: number): void {
  if (game.isGameOver) {
    if (keyboard.consumePress(RESTART_KEYS)) {
      game = new Game();
      soloDas.reset();
      paused = false;
      lastLockSeq = 0;
      playTimeMs = 0;
      recordSaved = false;
    }
    return;
  }
  if (keyboard.consumePress(PAUSE_KEYS)) paused = !paused;
  if (paused) return;
  playTimeMs += deltaMs;

  const moves = soloDas.update(
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

  if (game.isGameOver && !recordSaved) {
    recordSaved = true;
    saveSoloRecord();
  }
}

function updateVersus(deltaMs: number): void {
  if (match.phase === 'playing') {
    if (keyboard.consumePress(PAUSE_KEYS)) paused = !paused;
    if (paused) return;
    versusPlayMs += deltaMs;
    applyPlayerInput(match.games[0], 0, deltaMs);
    applyPlayerInput(match.games[1], 1, deltaMs);
    match.tick(deltaMs);
    if (match.isOver && !versusSaved) {
      versusSaved = true;
      saveVersusRecord();
    }
  } else if (match.phase === 'roundover') {
    if (keyboard.consumePress(NEXT_ROUND_KEYS)) match.nextRound();
  } else if (keyboard.consumePress([...NEXT_ROUND_KEYS, ...RESTART_KEYS])) {
    match.rematch();
    versusPlayMs = 0;
    versusSaved = false;
  }
}

function update(deltaMs: number): void {
  if (keyboard.consumePress(RECORDS_KEYS)) recordsPanel.toggle();
  if (recordsPanel.visible) return; // 기록 화면이 열려 있으면 게임 정지

  if (mode === 'solo' && keyboard.consumePress(MODE_VERSUS_KEYS)) {
    switchMode('versus');
    return;
  }
  if (mode === 'versus' && keyboard.consumePress(MODE_SOLO_KEYS)) {
    switchMode('solo');
    return;
  }

  if (mode === 'solo') updateSolo(deltaMs);
  else updateVersus(deltaMs);
}

function setOverlay(el: HTMLElement, main: string | null, sub = ''): void {
  if (main === null) {
    el.classList.add('hidden');
    return;
  }
  el.innerHTML = `<div>${main}</div>${sub ? `<div class="overlay-sub">${sub}</div>` : ''}`;
  el.classList.remove('hidden');
}

function renderSolo(): void {
  soloRenderer.draw(game);
  soloHud.update(game, game.score);

  if (game.lastLock && game.lastLock.seq !== lastLockSeq) {
    lastLockSeq = game.lastLock.seq;
    spawnClearPopup(soloBoardWrap, game.lastLock);
  }

  if (game.isGameOver) setOverlay(soloOverlay, 'GAME OVER', 'R 키로 재시작');
  else if (paused) setOverlay(soloOverlay, 'PAUSED', 'Esc/P 키로 계속');
  else setOverlay(soloOverlay, null);
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
    }
  });

  if (match.phase === 'matchover') {
    setOverlay(
      versusOverlay,
      `PLAYER ${match.matchWinner! + 1} 시리즈 승리! (${match.wins[match.matchWinner!]}-${match.wins[1 - match.matchWinner!]})`,
      'Space/R 재대결 · 1 솔로 모드',
    );
  } else if (match.phase === 'roundover') {
    setOverlay(
      versusOverlay,
      `ROUND ${match.round} — PLAYER ${match.roundWinner! + 1} 승리!`,
      `${match.wins[0]} : ${match.wins[1]} · Space 다음 라운드`,
    );
  } else if (paused) {
    setOverlay(versusOverlay, 'PAUSED', 'Esc/P 키로 계속');
  } else {
    setOverlay(versusOverlay, null);
  }
}

function render(): void {
  if (mode === 'solo') renderSolo();
  else renderVersus();
}

helpEl.textContent = HELP_SOLO;

// #records 해시로 접속하면 기록 화면을 바로 연다 (검증/직접 탐색용)
if (location.hash === '#records') recordsPanel.toggle();
// #versus 해시로 접속하면 대전 모드로 시작한다
if (location.hash === '#versus') switchMode('versus');

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
