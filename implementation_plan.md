# Implementation Plan: 테트리스 (1인용 / 2인용)

- **기반 문서**: tetris-prd.md (v1.0)
- **개발 도구**: Antigravity + Claude Code
- **작성일**: 2026-07-12

---

## 0. 스코어 txt 저장 방식에 대한 기술 결정 (중요)

브라우저 웹 게임은 보안상 로컬 디스크에 파일을 직접 쓸 수 없다. 따라서 "txt 파일로 로컬 저장" 요구사항은 아래 하이브리드 방식으로 구현한다.

| 계층 | 역할 |
|---|---|
| **localStorage** | 런타임 기본 저장소. 게임 오버 시 자동 저장, 새로고침에도 유지 |
| **File System Access API** (Chrome/Edge) | 사용자가 최초 1회 `scores.txt` 파일을 지정하면, 이후 게임 오버마다 해당 파일에 자동 기록 |
| **다운로드 폴백** (기타 브라우저) | "TXT로 내보내기" 버튼으로 `scores.txt` 다운로드 |

> 대안: 만약 Electron 또는 로컬 Node 서버 구성이 가능하다면 `fs.appendFile`로 무조건적 자동 저장이 가능하다. v1은 순수 웹으로 진행하고, 필요 시 Phase 8에서 전환한다.

### scores.txt 파일 포맷 (사람이 읽을 수 있는 형식)

```
=== TETRIS SCORE LOG ===
[2026-07-12 21:35:02] MODE=SOLO   PLAYER=P1  SCORE=48200  LINES=62  LEVEL=7   DURATION=08:41
[2026-07-12 21:50:17] MODE=VERSUS WINNER=P2  ROUNDS=2-1   DURATION=12:03
```

- 한 줄 = 한 게임 기록, append 방식
- 파싱 규칙: `[timestamp]` + `KEY=VALUE` 공백 구분 (게임 내 기록 화면에서 재파싱하여 표시)

---

## 1. 프로젝트 구조

```
tetris/
├── index.html
├── vite.config.ts
├── package.json
├── src/
│   ├── main.ts              # 진입점, 씬 전환, 게임 루프
│   ├── core/
│   │   ├── board.ts         # 보드 상태, 충돌, 라인 클리어
│   │   ├── piece.ts         # 테트로미노 정의, 회전 상태
│   │   ├── srs.ts           # SRS 회전 + 벽킥 테이블
│   │   ├── bag.ts           # 7-bag 랜덤라이저
│   │   ├── gravity.ts       # 레벨별 낙하 속도, 락 딜레이
│   │   ├── scoring.ts       # 점수, 콤보, 백투백, T-스핀 판정
│   │   ├── garbage.ts       # 공격 테이블, 가비지 큐, 상쇄
│   │   └── game.ts          # 게임 상태 머신 (1인 코어 인스턴스)
│   ├── input/
│   │   ├── keyboard.ts      # keydown/keyup 상태 폴링
│   │   └── das.ts           # DAS/ARR 처리
│   ├── render/
│   │   ├── boardRenderer.ts # Canvas 보드/고스트/이펙트
│   │   └── hud.ts           # 점수, 넥스트, 홀드, 가비지 게이지
│   ├── ui/
│   │   ├── menu.ts          # 메인 메뉴
│   │   ├── pause.ts         # 일시정지 오버레이
│   │   ├── result.ts        # 결과 화면
│   │   └── records.ts       # 스코어 기록 열람 화면
│   ├── score/
│   │   ├── scoreStore.ts    # localStorage CRUD, 기록 정렬
│   │   ├── txtFormat.ts     # 기록 <-> txt 직렬화/파싱
│   │   └── fileSync.ts      # File System Access API + 다운로드 폴백
│   └── versus/
│       └── match.ts         # 2인 매치: 코어 2개, 가비지 라우팅, 라운드 관리
├── tests/
│   ├── srs.test.ts
│   ├── bag.test.ts
│   ├── board.test.ts
│   ├── scoring.test.ts
│   ├── garbage.test.ts
│   └── txtFormat.test.ts
└── scores.txt               # (사용자가 지정 시) 기록 파일
```

---

## 2. Phase별 구현 계획

각 Phase는 Claude Code 세션에서 독립적으로 지시 가능한 단위이며, 완료 기준(DoD)을 만족해야 다음으로 넘어간다.

### Phase 1 — 프로젝트 셋업 & 코어 데이터 모델

**작업**

1. Vite + TypeScript + Vitest 프로젝트 초기화
2. `piece.ts`: 7종 테트로미노 형태/색상/스폰 위치 상수 정의
3. `board.ts`: 10x22 그리드, 충돌 검사 `isValidPosition()`, 블록 고정 `lockPiece()`, 라인 클리어 `clearLines()`
4. `bag.ts`: 7-bag 셔플, `next()`, 미리보기 5개 큐

**DoD**

- `npm test` 통과: bag이 7개 단위로 중복 없이 지급, 라인 클리어가 정확히 동작
- 아직 화면 출력 없음 (순수 로직)

---

### Phase 2 — SRS 회전 & 중력

**작업**

1. `srs.ts`: 표준 SRS 벽킥 테이블 (JLSTZ용, I용 별도) 구현
2. `gravity.ts`: 레벨 1~20 낙하 간격 테이블, 락 딜레이 0.5초 + 15회 리셋 제한
3. `game.ts`: 상태 머신 — `spawn → falling → locking → clearing → spawn`, 게임 오버 판정

**DoD**

- `srs.test.ts`: 벽킥 케이스(T 회전 킥, I 킥 등) 전부 통과
- 게임 오버(스폰 불가) 판정 테스트 통과

---

### Phase 3 — 렌더링 & 입력 → 1인용 플레이 가능

**작업**

1. `keyboard.ts` + `das.ts`: 키 상태 폴링, DAS 167ms / ARR 33ms
2. `boardRenderer.ts`: Canvas에 보드, 현재 블록, 고스트 피스 렌더링
3. `main.ts`: requestAnimationFrame + 고정 타임스텝(60tps) 게임 루프
4. 조작 연결: 이동, 소프트/하드 드롭, 좌/우 회전, 홀드
5. `hud.ts`: 넥스트 5개, 홀드, 점수/레벨/라인 표시

**DoD**

- 브라우저에서 1인용 마라톤을 처음부터 게임 오버까지 플레이 가능
- 입력 지연 체감 없음, 60fps 유지

---

### Phase 4 — 점수 시스템 & T-스핀

**작업**

1. `scoring.ts`: PRD 4.5 점수 테이블, 콤보, 백투백 ×1.5
2. T-스핀 판정 (모서리 3개 규칙 + 마지막 동작이 회전)
3. 레벨업 로직 (10라인당 +1) 및 중력 연동
4. 라인 클리어/테트리스/T-스핀 텍스트 팝업 이펙트

**DoD**

- `scoring.test.ts`: 싱글~테트리스, T-스핀 더블, 백투백 시나리오 테스트 통과

---

### Phase 5 — 스코어 기록 기능 (txt 저장) ⭐

**작업**

1. `scoreStore.ts`
   - 게임 오버 시 기록 객체 생성: `{ timestamp, mode, player, score, lines, level, duration }`
   - localStorage에 JSON 배열로 저장, 상위 10개 하이스코어 정렬 제공
2. `txtFormat.ts`
   - 기록 배열 → txt 직렬화 (섹션 0의 포맷)
   - txt → 기록 배열 파싱 (기존 scores.txt 불러오기용)
3. `fileSync.ts`
   - `window.showSaveFilePicker` 지원 시: 최초 1회 scores.txt 지정 → FileHandle을 IndexedDB에 보관 → 이후 게임 오버마다 자동 append
   - 미지원 브라우저: "TXT로 내보내기" 버튼으로 Blob 다운로드
   - "TXT 불러오기" 버튼: 기존 scores.txt 업로드 → 파싱 → localStorage와 병합(타임스탬프 중복 제거)
4. `records.ts`: 기록 열람 화면 — 하이스코어 톱10, 최근 기록, 내보내기/불러오기/파일 연결 버튼

**DoD**

- `txtFormat.test.ts`: 직렬화 ↔ 파싱 왕복 테스트 통과
- 게임 오버 → scores.txt에 한 줄 추가 확인 (Chrome)
- Firefox 등에서 내보내기 다운로드 정상 동작
- 새로고침 후에도 기록 유지

---

### Phase 6 — 2인용 배틀 모드

**작업**

1. `match.ts`: 게임 코어 인스턴스 2개 생성, 각각 독립 bag/보드
2. 키 매핑 분리 (PRD 5.2), 동시 입력 처리 검증
3. `garbage.ts`: 공격 테이블, 가비지 큐, 상쇄 로직, 다음 lock 시점에 적용
4. 분할 화면 렌더링 (보드 2개 + 각자 HUD + 가비지 게이지)
5. 라운드 관리: 탑아웃 → 라운드 승패 → 3판 2선승 시리즈, 결과 화면
6. 2인용 결과도 scores.txt에 기록 (`MODE=VERSUS WINNER=... ROUNDS=...`)

**DoD**

- `garbage.test.ts`: 공격량 계산, 상쇄, 큐 적용 타이밍 테스트 통과
- 두 명이 동시에 하드드롭해도 프레임 드랍/입력 누락 없음
- 시리즈 완주 → 결과 화면 → 재대결 플로우 정상

---

### Phase 7 — 메뉴/폴리싱

**작업**

1. `menu.ts`: 메인 메뉴 (1인용 / 2인용 / 기록 / 조작법)
2. `pause.ts`: Esc 일시정지, 계속/재시작/메뉴로
3. 이펙트: 라인 클리어 플래시, 하드드롭 진동, 가비지 수신 경고
4. 창 크기 대응 보드 스케일링
5. (선택) 효과음 + 음소거 토글

**DoD**

- PRD 9장 수용 기준 전체 체크리스트 통과
- 메뉴 → 게임 → 결과 → 기록 열람 전체 플로우 무결

---

### Phase 8 (선택) — Electron 전환

- txt 자동 저장을 무조건 보장해야 할 경우: Electron 래핑 후 `fs.appendFile('scores.txt')`로 교체
- `fileSync.ts`의 인터페이스를 유지한 채 구현체만 교체하도록 Phase 5에서 어댑터 패턴으로 설계해 둘 것

---

## 3. Claude Code 세션 운영 가이드

- **Phase 단위로 지시**: "Phase 1을 구현해줘. 완료 기준은 implementation plan 참조" 형태로 진행
- **테스트 우선**: 각 Phase에서 코어 로직은 테스트 먼저 작성하도록 지시 (`npm test` 통과를 완료 조건으로 명시)
- **커밋 단위**: Phase당 1개 이상 커밋, 커밋 메시지에 Phase 번호 포함 (`feat(phase-5): score txt sync`)
- **회귀 방지**: Phase 4 이후에는 매 Phase 종료 시 전체 테스트 재실행
- 이 문서와 tetris-prd.md를 프로젝트 루트에 두고 Claude Code가 항상 참조하게 할 것 (`CLAUDE.md`에 두 문서 경로 명시 권장)

### CLAUDE.md 권장 내용

```markdown
# Tetris Project
- 요구사항: ./tetris-prd.md
- 구현 계획: ./tetris-implementation-plan.md
- 규칙: 코어 로직 수정 시 반드시 관련 테스트 갱신, npm test 통과 후 커밋
- 현재 진행: Phase N (완료 시 이 줄 업데이트)
```

---

## 4. 리스크 & 대응

| 리스크 | 대응 |
|---|---|
| File System Access API 미지원 브라우저 | 다운로드/업로드 폴백 (Phase 5에 포함) |
| FileHandle 권한이 세션 간 만료됨 | IndexedDB에 핸들 보관 + 재방문 시 권한 재요청 UI |
| 2인 동시 입력 시 키보드 고스팅 | PRD 5.2의 분산 키 배치 유지, QA 시 실기기 검증 |
| 락 딜레이/DAS 체감 이상 | 설정값 상수화(`config.ts`)로 튜닝 용이하게 |
| txt 수동 편집으로 파싱 실패 | 파싱 실패 라인은 건너뛰고 경고만 표시 |
