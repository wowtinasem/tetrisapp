// scores.txt 파일 동기화 (Phase 5)
// - Chrome/Edge: File System Access API로 최초 1회 파일 연결 → 게임 오버마다 자동 append
//   (FileHandle은 IndexedDB에 보관, 재방문 시 권한 재요청)
// - 기타 브라우저: 내보내기(다운로드)/불러오기(업로드) 폴백
// Electron 전환(Phase 8) 시 ScoreFileSync 구현체만 교체한다 — 어댑터 패턴.

import { TXT_HEADER } from './txtFormat';

export type SyncStatus = 'unsupported' | 'unlinked' | 'need-permission' | 'ready';

export interface ScoreFileSync {
  /** 파일이 연결돼 있고 권한이 있으면 한 줄을 추가한다 (실패해도 throw하지 않음) */
  appendLine(line: string): Promise<boolean>;
  /** 사용자 제스처 안에서 호출 — 파일 선택으로 연결 */
  link(): Promise<boolean>;
  /** 재방문 후 만료된 권한을 사용자 제스처 안에서 재요청 */
  ensurePermission(): Promise<boolean>;
  unlink(): Promise<void>;
  status(): Promise<SyncStatus>;
}

// --- File System Access API 타입 보강 (lib.dom에 없는 WICG 확장) ---

interface FsaFileHandle extends FileSystemFileHandle {
  queryPermission?(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(opts: { mode: 'readwrite' }): Promise<PermissionState>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker?(opts?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }): Promise<FileSystemFileHandle>;
}

// --- IndexedDB에 FileHandle 보관 ---

const DB_NAME = 'tetris-file-sync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'scores-txt';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: IDBValidKey, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- 구현체 ---

class FsaScoreFileSync implements ScoreFileSync {
  private getHandle(): Promise<FsaFileHandle | undefined> {
    return idbGet<FsaFileHandle>(HANDLE_KEY);
  }

  private async permissionOf(handle: FsaFileHandle, request: boolean): Promise<PermissionState> {
    const opts = { mode: 'readwrite' as const };
    let state = (await handle.queryPermission?.(opts)) ?? 'granted';
    if (state === 'prompt' && request) {
      try {
        state = (await handle.requestPermission?.(opts)) ?? state;
      } catch {
        // 사용자 제스처 밖에서는 요청이 거부될 수 있다
      }
    }
    return state;
  }

  async link(): Promise<boolean> {
    const win = window as FilePickerWindow;
    if (!win.showSaveFilePicker) return false;
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName: 'scores.txt',
        types: [{ description: '텍스트 파일', accept: { 'text/plain': ['.txt'] } }],
      });
      await idbSet(HANDLE_KEY, handle);
      return true;
    } catch {
      return false; // 사용자가 선택을 취소
    }
  }

  async ensurePermission(): Promise<boolean> {
    const handle = await this.getHandle();
    if (!handle) return false;
    return (await this.permissionOf(handle, true)) === 'granted';
  }

  async unlink(): Promise<void> {
    await idbDelete(HANDLE_KEY);
  }

  async status(): Promise<SyncStatus> {
    try {
      const handle = await this.getHandle();
      if (!handle) return 'unlinked';
      return (await this.permissionOf(handle, false)) === 'granted' ? 'ready' : 'need-permission';
    } catch {
      return 'unlinked';
    }
  }

  async appendLine(line: string): Promise<boolean> {
    try {
      const handle = await this.getHandle();
      if (!handle) return false;
      if ((await this.permissionOf(handle, true)) !== 'granted') return false;
      const file = await handle.getFile();
      const writable = await handle.createWritable({ keepExistingData: true });
      const prefix = file.size === 0 ? `${TXT_HEADER}\n` : '';
      await writable.write({ type: 'write', position: file.size, data: `${prefix}${line}\n` });
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }
}

class NullScoreFileSync implements ScoreFileSync {
  async appendLine(): Promise<boolean> {
    return false;
  }
  async link(): Promise<boolean> {
    return false;
  }
  async ensurePermission(): Promise<boolean> {
    return false;
  }
  async unlink(): Promise<void> {
    // 연결 자체가 불가능하므로 할 일 없음
  }
  async status(): Promise<SyncStatus> {
    return 'unsupported';
  }
}

export function createScoreFileSync(): ScoreFileSync {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window
    ? new FsaScoreFileSync()
    : new NullScoreFileSync();
}

// --- 폴백: 다운로드/업로드 ---

export function downloadTxt(content: string, filename = 'scores.txt'): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 파일 선택 대화상자를 열어 txt 내용을 읽는다. 취소하면 null */
export function pickTxtFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
