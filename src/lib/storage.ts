import { SessionState, SessionStateSchema } from './types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'maxwell_session';

/**
 * ATOMIC READ: Fetches and validates current state.
 */
export async function getSessionState(): Promise<SessionState | null> {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  if (!result[STORAGE_KEY]) return null;
  
  const parsed = SessionStateSchema.safeParse(result[STORAGE_KEY]);
  if (parsed.success) return parsed.data;
  
  console.error("[Maxwell Storage] State corrupted:", parsed.error);
  return null;
}

/**
 * ATOMIC WRITE: Merges updates into storage.
 * Note: This replaces the whole object. Race conditions are possible in high-freq loops
 * but acceptable for this prototype phase.
 */
export async function updateSessionState(updater: (current: SessionState) => SessionState): Promise<void> {
  const current = await getSessionState();
  if (!current) {
    console.warn("[Maxwell Storage] No active session to update.");
    return;
  }

  const newState = updater(current);
  await chrome.storage.local.set({ [STORAGE_KEY]: newState });
  console.log("[Maxwell Storage] State Synced 💾");
}

/**
 * INITIALIZER: Creates the blank slate if none exists.
 */
export async function initSessionIfMissing(northStar: string): Promise<void> {
  const current = await getSessionState();
  if (current) return;

  const newState: SessionState = {
    session_id: uuidv4(),
    meta: { created_at: Date.now(), token_count: 0, iteration: 0 },
    north_star: { id: uuidv4(), content: northStar, locked: true },
    constraints: [],
    vfs: {},
    pointer: { current_step: "Session Initialized", blockers: [] }
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: newState });
}