import { create } from 'zustand';
import { SessionState, SessionStateSchema, FileNode } from './types';
import { v4 as uuidv4 } from 'uuid';

// Define the shape of our Store (State + Actions)
interface MaxwellStore {
  state: SessionState | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeSession: (northStar: string) => void;
  updateNorthStar: (content: string) => void;
  addConstraint: (content: string) => void;
  updateFile: (path: string, fileData: Partial<FileNode>) => void;
  setExecutionPointer: (step: string) => void;
  
  // Storage Sync
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
  resetStorage: () => Promise<void>;
}

// Helper: Create a fresh empty state
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
  pointer: {
    current_step: "Initializing Session...",
    blockers: []
  }
});

export const useMaxwellStore = create<MaxwellStore>((set, get) => ({
  state: null,
  isLoading: true,
  error: null,

  initializeSession: (northStar) => {
    const newState = createEmptyState(northStar);
    set({ state: newState });
    get().saveToStorage();
  },

  updateNorthStar: (content) => {
    set((s) => {
      if (!s.state) return {};
      return {
        state: { ...s.state, north_star: { ...s.state.north_star, content } }
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
      
      // Merge logic: If file exists, update it. If not, create it.
      const newFile: FileNode = existingFile 
        ? { ...existingFile, ...fileData, last_modified: Date.now() }
        : { 
            path, 
            content: "", 
            language: "javascript", 
            last_modified: Date.now(), 
            hash: "init", 
            pending_patches: [], 
            ...fileData 
          };

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
        state: { ...s.state, pointer: { ...s.state.pointer, current_step: step } }
      };
    });
    get().saveToStorage();
  },

  // --- STORAGE ENGINE ---
  
  loadFromStorage: async () => {
    set({ isLoading: true });
    try {
      const result = await chrome.storage.local.get(['maxwell_session']);
      if (result.maxwell_session) {
        // Validation: Ensure data matches our Schema
        const parsed = SessionStateSchema.safeParse(result.maxwell_session);
        if (parsed.success) {
          set({ state: parsed.data, isLoading: false });
          console.log("[Store] State Hydrated:", parsed.data);
        } else {
          console.error("[Store] Schema Validation Failed", parsed.error);
          set({ error: "Data corruption detected", isLoading: false });
        }
      } else {
        set({ state: null, isLoading: false }); // No session exists yet
      }
    } catch (e) {
      set({ error: "Failed to load storage", isLoading: false });
    }
  },

  saveToStorage: async () => {
    const s = get().state;
    if (s) {
      await chrome.storage.local.set({ maxwell_session: s });
      console.log("[Store] State Saved");
    }
  },

  resetStorage: async () => {
    await chrome.storage.local.remove('maxwell_session');
    set({ state: null });
  }
}));
