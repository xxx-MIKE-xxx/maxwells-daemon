import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { 
  SessionState, 
  SessionStateSchema, 
  FileNode, 
  FileNodeSchema 
} from './types';
import { tether } from './tether';

interface MaxwellStore {
  state: SessionState | null;
  isLoading: boolean;
  error: string | null;

  // --- Core Session Actions ---
  initializeSession: (northStar: string) => void;
  updateNorthStar: (content: string) => void;
  addConstraint: (content: string) => void;
  updateFile: (path: string, fileData: Partial<FileNode>) => void;
  setExecutionPointer: (step: string) => void;
  
  // --- Tether (Local FS) Actions ---
  initTether: () => Promise<void>;
  connectTether: () => Promise<void>;
  refreshShadowTree: () => Promise<void>;
  promoteFile: (path: string) => Promise<void>;
  demoteFile: (path: string) => void;

  // --- Storage Engine ---
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
  resetStorage: () => Promise<void>;
}

// Helper: Create a fresh empty session
const createEmptyState = (northStar: string): SessionState => ({
  session_id: uuidv4(),
  meta: {
    created_at: Date.now(),
    token_count: 0,
    iteration: 0
  },
  north_star: {
    id: uuidv4(),
    content: northStar,
    locked: true
  },
  constraints: [],
  vfs: {},
  tether: {
    active: false,
    tree: [],
    working_set: {}
  },
  pointer: {
    current_step: "Session Initialized",
    blockers: [],
    last_error: undefined
  }
});

export const useMaxwellStore = create<MaxwellStore>((set, get) => ({
  state: null,
  isLoading: true,
  error: null,

  // ---------------------------------------------------------------------------
  // Core Session Actions
  // ---------------------------------------------------------------------------

  initializeSession: (northStar) => {
    const newState = createEmptyState(northStar);
    set({ state: newState });
    get().saveToStorage();
  },

  updateNorthStar: (content) => {
    set((s) => {
      if (!s.state) return {};
      return {
        state: { 
          ...s.state, 
          north_star: { ...s.state.north_star, content } 
        }
      };
    });
    get().saveToStorage();
  },

  addConstraint: (content) => {
    set((s) => {
      if (!s.state) return {};
      return {
        state: {
          ...s.state,
          constraints: [
            ...s.state.constraints,
            { id: uuidv4(), content, active: true }
          ]
        }
      };
    });
    get().saveToStorage();
  },

  updateFile: (path, fileData) => {
    set((s) => {
      if (!s.state) return {};
      const existingFile = s.state.vfs[path];
      
      // Merge or Create new VFS file
      const newFile: FileNode = existingFile 
        ? { ...existingFile, ...fileData, last_modified: Date.now() }
        : { 
            path, 
            content: "", 
            language: "javascript", // Default, effectively
            last_modified: Date.now(), 
            hash: "init", 
            pending_patches: [], 
            ...fileData 
          } as FileNode; // Cast to satisfy partial checks if needed

      return {
        state: {
          ...s.state,
          vfs: { ...s.state.vfs, [path]: newFile }
        }
      };
    });
    get().saveToStorage();
  },

  setExecutionPointer: (step) => {
    set((s) => {
      if (!s.state) return {};
      return {
        state: { 
          ...s.state, 
          pointer: { ...s.state.pointer, current_step: step } 
        }
      };
    });
    get().saveToStorage();
  },

  // ---------------------------------------------------------------------------
  // Tether (Local File System) Actions
  // ---------------------------------------------------------------------------

  initTether: async () => {
    // 1. Silent Resume: Check IDB for existing handle on load
    const isConnected = await tether.init();
    
    if (isConnected) {
        set((s) => {
            if (!s.state) return {};
            return { 
                state: { 
                    ...s.state, 
                    tether: { 
                      ...s.state.tether, 
                      active: true,
                      root_name: tether.rootName || "Project Root"
                    } 
                } 
            };
        });
        // CRITICAL: Save connected state BEFORE the slow scan starts
        await get().saveToStorage(); 
        await get().refreshShadowTree();
    }
  },

  connectTether: async () => {
    // 2. User Action: Open Directory Picker
    const success = await tether.connect();
    
    if (success) {
      set((s) => {
          if (!s.state) return {};
          return { 
            state: { 
                ...s.state, 
                tether: { 
                  ...s.state.tether, 
                  active: true, 
                  root_name: tether.rootName || "Project Root" 
                } 
            } 
          };
      });
      // CRITICAL: Save "active: true" immediately.
      // This prevents the background sync (loadFromStorage) from reverting 
      // the UI to "active: false" while the tree is still scanning.
      await get().saveToStorage();
      
      await get().refreshShadowTree();
    }
  },

  refreshShadowTree: async () => {
    try {
      const tree = await tether.scanTree();
      set((s) => {
          if (!s.state) return {};
          
          // Calculate "in_working_set" status for the UI based on current memory
          const currentWorkingSet = s.state.tether.working_set;
          
          const mergedTree = tree.map(node => ({
              ...node,
              in_working_set: Object.prototype.hasOwnProperty.call(currentWorkingSet, node.path)
          }));

          return {
              state: {
                  ...s.state,
                  tether: { ...s.state.tether, tree: mergedTree }
              }
          };
      });
      // Save the updated tree structure
      get().saveToStorage();
    } catch (e) {
      console.error("[Store] Failed to refresh shadow tree", e);
    }
  },

  promoteFile: async (path) => {
    try {
      // Read actual bytes from disk
      const content = await tether.readFile(path);
      
      set((s) => {
        if (!s.state) return {};
        return {
            state: {
                ...s.state,
                tether: {
                    ...s.state.tether,
                    working_set: { 
                      ...s.state.tether.working_set, 
                      [path]: content 
                    }
                }
            }
        };
      });
      
      await get().saveToStorage();
      // Refresh tree so the UI updates the "eye" icon to "in_working_set"
      await get().refreshShadowTree(); 
    } catch (e) {
      console.error("[Store] Failed to promote file", e);
    }
  },

  demoteFile: (path) => {
      set((s) => {
        if (!s.state) return {};
        const newSet = { ...s.state.tether.working_set };
        delete newSet[path];
        return {
            state: {
                ...s.state,
                tether: { ...s.state.tether, working_set: newSet }
            }
        };
      });
      get().saveToStorage();
      get().refreshShadowTree();
  },

  // ---------------------------------------------------------------------------
  // Storage Engine
  // ---------------------------------------------------------------------------
  
  loadFromStorage: async () => {
    set({ isLoading: true });
    try {
      const result = await chrome.storage.local.get(['maxwell_session']);
      
      if (result.maxwell_session) {
        // Validation Layer: Protect against corrupted JSON
        const parsed = SessionStateSchema.safeParse(result.maxwell_session);

        if (parsed.success) {
          const currentState = get().state;

          // Merge in-memory tether state with stored state to avoid connection races
          const mergedState = (() => {
            if (currentState?.tether?.active && !parsed.data.tether.active) {
              return {
                ...parsed.data,
                tether: {
                  ...parsed.data.tether,
                  active: true,
                  root_name: parsed.data.tether.root_name || currentState.tether.root_name,
                  working_set: Object.keys(parsed.data.tether.working_set).length
                    ? parsed.data.tether.working_set
                    : currentState.tether.working_set,
                  tree: parsed.data.tether.tree.length ? parsed.data.tether.tree : currentState.tether.tree
                }
              };
            }
            return parsed.data;
          })();

          set({ state: mergedState, isLoading: false });
          // Note: We do NOT auto-init Tether here to avoid infinite loops.
          // Tether initialization is handled by the component mount or explicit actions.
        } else {
          console.error("[Store] Schema Validation Failed", parsed.error);
          set({ error: "Data corruption detected in storage.", isLoading: false });
        }
      } else {
        set({ state: null, isLoading: false });
      }
    } catch (e) {
      console.error("[Store] Load failed", e);
      set({ error: "Failed to access chrome.storage.local", isLoading: false });
    }
  },

  saveToStorage: async () => {
    const s = get().state;
    if (s) {
      await chrome.storage.local.set({ maxwell_session: s });
    }
  },

  resetStorage: async () => {
    await chrome.storage.local.remove('maxwell_session');
    set({ state: null });
  }
}));