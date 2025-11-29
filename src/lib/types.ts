import { z } from 'zod';

// --- Tier 0: The North Star (Immutable) ---
export const NorthStarSchema = z.object({
  id: z.string().uuid(),
  content: z.string(), // e.g., "Build a Chrome Extension..."
  locked: z.boolean().default(true),
});

// --- Tier 1: Constraints (Hard Rules) ---
export const ConstraintSchema = z.object({
  id: z.string(),
  content: z.string(), // e.g., "No jQuery", "Manifest V3 only"
  active: z.boolean().default(true),
});

// --- Tier 2: The Virtual File System (VFS) ---
export const FileNodeSchema = z.object({
  path: z.string(),       // e.g., "src/content/index.ts"
  content: z.string(),    // The actual code
  language: z.string(),   // "typescript", "javascript", "css"
  last_modified: z.number(),
  hash: z.string(),       // SHA-256 for deduplication
  pending_patches: z.array(z.object({
    id: z.string(),
    content: z.string(),
    timestamp: z.number(),
    confidence: z.number().min(0).max(1), // 0.0 to 1.0 (Sentiment)
  })).default([]),
});

export const VFSSchema = z.record(z.string(), FileNodeSchema);

// --- Tier 3: Execution Pointer (Volatile) ---
export const PointerSchema = z.object({
  current_step: z.string(),
  blockers: z.array(z.string()),
  last_error: z.string().optional(),
});

// --- THE MASTER STATE OBJECT ---
export const SessionStateSchema = z.object({
  session_id: z.string().uuid(),
  meta: z.object({
    created_at: z.number(),
    token_count: z.number(),
    iteration: z.number(),
  }),
  north_star: NorthStarSchema,
  constraints: z.array(ConstraintSchema),
  vfs: VFSSchema,
  pointer: PointerSchema,
});

// Extract TypeScript types from the Zod Schema
export type SessionState = z.infer<typeof SessionStateSchema>;
export type FileNode = z.infer<typeof FileNodeSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
