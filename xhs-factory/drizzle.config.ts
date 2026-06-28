import { defineConfig } from 'drizzle-kit'

// drizzle-kit is used in dev to generate/inspect migrations from schema.ts.
// At runtime the app applies migrations via a small versioned runner in
// src/main/db/client.ts (avoids bundling a migrations folder into Electron).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/db/schema.ts',
  out: './src/main/db/migrations'
})
