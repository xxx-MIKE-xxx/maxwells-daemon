import { get, set } from 'idb-keyval';
import { TetherFile } from './types';

const HANDLE_KEY = 'maxwell_project_handle';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.vscode', 'coverage', '.DS_Store', 'build']);
const IGNORE_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.gitignore']);

export class TetherEngine {
  private rootHandle: FileSystemDirectoryHandle | null = null;
  public rootName: string = "";

  /**
   * 1. Initialize: Try to restore handle from IndexedDB
   */
  async init(): Promise<boolean> {
    try {
      const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY);
      if (handle) {
        console.log("[Tether] Handle found, verifying permissions...");
        const perm = await this.verifyPermission(handle);
        if (perm) {
          this.rootHandle = handle;
          this.rootName = handle.name;
          return true;
        }
      }
    } catch (e) {
      console.error("[Tether] Failed to restore handle:", e);
    }
    return false;
  }

  /**
   * 2. Connect: Trigger the browser picker
   */
  async connect(): Promise<boolean> {
    try {
      const handle = await window.showDirectoryPicker();
      this.rootHandle = handle;
      this.rootName = handle.name;
      await set(HANDLE_KEY, handle);
      return true;
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error("[Tether] Connection failed:", e);
      }
      return false;
    }
  }

  /**
   * 3. Scan: Walk the tree to build the Shadow Tree
   */
  async scanTree(): Promise<TetherFile[]> {
    if (!this.rootHandle) throw new Error("Tether disconnected");
    const files: TetherFile[] = [];
    await this.walkDir(this.rootHandle, "", files);
    return files;
  }

  /**
   * 4. Read: Get full content for Working Set
   */
  async readFile(path: string): Promise<string> {
    if (!this.rootHandle) throw new Error("Tether disconnected");
    
    // Normalize path just in case
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const parts = cleanPath.split('/');
    let currentDir = this.rootHandle;
    
    // Navigate to file folder
    for (let i = 0; i < parts.length - 1; i++) {
      try {
        currentDir = await currentDir.getDirectoryHandle(parts[i]);
      } catch (e) {
        throw new Error(`Path not found: ${parts[i]}`);
      }
    }
    
    const fileName = parts[parts.length - 1];
    try {
      const fileHandle = await currentDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  // --- Internal Helpers ---

  private async verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const opts = { mode: 'read' as const };
    
    // Check if we already have permission
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    
    // If not, request it (this requires a user gesture if not done immediately after click)
    // Note: This might fail if called during auto-init without user interaction.
    try {
        if ((await handle.requestPermission(opts)) === 'granted') return true;
    } catch (e) {
        // Permission prompt blocked or denied
        return false;
    }
    
    return false;
  }

  private async walkDir(dirHandle: FileSystemDirectoryHandle, pathPrefix: string, results: TetherFile[]) {
    // @ts-ignore
    for await (const entry of dirHandle.values()) {
      const path = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
      
      if (entry.kind === 'file') {
        if (IGNORE_FILES.has(entry.name)) continue;
        
        const file = await entry.getFile();
        results.push({
          path,
          kind: 'file',
          size: file.size,
          last_modified: file.lastModified,
          in_working_set: false,
          summary: "" 
        });
      } 
      else if (entry.kind === 'directory') {
        if (IGNORE_DIRS.has(entry.name)) continue;
        await this.walkDir(entry, path, results);
      }
    }
  }
}

export const tether = new TetherEngine();