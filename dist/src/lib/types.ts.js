import { z } from "/vendor/.vite-deps-zod.js__v--9bbfba18.js";
export const NorthStarSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  // e.g., "Build a Chrome Extension..."
  locked: z.boolean().default(true)
});
export const ConstraintSchema = z.object({
  id: z.string(),
  content: z.string(),
  // e.g., "No jQuery", "Manifest V3 only"
  active: z.boolean().default(true)
});
export const FileNodeSchema = z.object({
  path: z.string(),
  // e.g., "src/content/index.ts"
  content: z.string(),
  // The actual code
  language: z.string(),
  // "typescript", "javascript", "css"
  last_modified: z.number(),
  hash: z.string(),
  // SHA-256 for deduplication
  pending_patches: z.array(z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.number(),
    confidence: z.number().min(0).max(1)
    // 0.0 to 1.0 (Sentiment)
  })).default([])
});
export const VFSSchema = z.record(z.string(), FileNodeSchema);
export const PointerSchema = z.object({
  current_step: z.string(),
  blockers: z.array(z.string()),
  last_error: z.string().optional()
});
export const SessionStateSchema = z.object({
  session_id: z.string().uuid(),
  meta: z.object({
    created_at: z.number(),
    token_count: z.number(),
    iteration: z.number()
  }),
  north_star: NorthStarSchema,
  constraints: z.array(ConstraintSchema),
  vfs: VFSSchema,
  pointer: PointerSchema
});
