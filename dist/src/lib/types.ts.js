import { z } from "/vendor/.vite-deps-zod.js__v--75e5e267.js";
export const NorthStarSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  locked: z.boolean().default(true)
});
export const ConstraintSchema = z.object({
  id: z.string(),
  content: z.string(),
  active: z.boolean().default(true)
});
export const FileNodeSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string(),
  last_modified: z.number(),
  hash: z.string(),
  pending_patches: z.array(z.any()).default([])
});
export const VFSSchema = z.record(z.string(), FileNodeSchema);
export const TetherFileSchema = z.object({
  path: z.string(),
  // Relative path: "src/components/Button.tsx"
  kind: z.enum(["file", "directory"]),
  size: z.number(),
  last_modified: z.number(),
  summary: z.string().optional(),
  in_working_set: z.boolean().default(false)
});
export const TetherStateSchema = z.object({
  active: z.boolean().default(false),
  root_name: z.string().optional(),
  tree: z.array(TetherFileSchema).default([]),
  working_set: z.record(z.string(), z.string())
  // Path -> Full Content
});
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
  // Default to empty if migrating from old state
  tether: TetherStateSchema.default({
    active: false,
    tree: [],
    working_set: {}
  }),
  pointer: PointerSchema
});
