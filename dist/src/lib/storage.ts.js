import { SessionStateSchema } from "/src/lib/types.ts.js";
import { v4 as uuidv4 } from "/vendor/.vite-deps-uuid.js__v--9bbfba18.js";
const STORAGE_KEY = "maxwell_session";
export async function getSessionState() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  if (!result[STORAGE_KEY]) return null;
  const parsed = SessionStateSchema.safeParse(result[STORAGE_KEY]);
  if (parsed.success) return parsed.data;
  console.error("[Maxwell Storage] State corrupted:", parsed.error);
  return null;
}
export async function updateSessionState(updater) {
  const current = await getSessionState();
  if (!current) {
    console.warn("[Maxwell Storage] No active session to update.");
    return;
  }
  const newState = updater(current);
  await chrome.storage.local.set({ [STORAGE_KEY]: newState });
  console.log("[Maxwell Storage] State Synced 💾");
}
export async function initSessionIfMissing(northStar) {
  const current = await getSessionState();
  if (current) return;
  const newState = {
    session_id: uuidv4(),
    meta: { created_at: Date.now(), token_count: 0, iteration: 0 },
    north_star: { id: uuidv4(), content: northStar, locked: true },
    constraints: [],
    vfs: {},
    pointer: { current_step: "Session Initialized", blockers: [] }
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: newState });
}
