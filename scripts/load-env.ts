/**
 * Env loader for CLI scripts. Loads `.env.local` (dev overrides) FIRST, then `.env`.
 * dotenv never overrides an already-set var, so `.env.local` wins where it defines one
 * (e.g. DATABASE_URL → an isolated Neon dev branch), while everything else falls back
 * to `.env`. Import this instead of 'dotenv/config' in scripts that hit the DB.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
