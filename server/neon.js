// The production database, shared by every request a function instance serves.
import { neon } from '@neondatabase/serverless'
import { fromNeon } from './db.js'

let db

export function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? null
}

export function database() {
  if (db) return db
  const url = databaseUrl()
  if (!url) throw new Error('DATABASE_URL is not set. Connect a Neon database to the Vercel project.')
  db = fromNeon(neon(url))
  return db
}
