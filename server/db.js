// One small interface over the two ways the site talks to Postgres: Neon's
// serverless driver in production (each query is one HTTPS request, so there's
// no connection to keep open between visits) and PGlite, Postgres compiled to
// WebAssembly, for local development and tests. Both are real Postgres, so the
// same SQL runs on each.
//
//   db.query(sql, params)  → rows
//   db.one(sql, params)    → first row or null
//   db.batch([[sql, params], ...]) → rows for each, all in one transaction
//
// Queries return plain values only: timestamps, dates and big numbers are cast
// to text or int in SQL, so both drivers hand back the same thing.

export function fromNeon(sql) {
  return wrap({
    query: (text, params = []) => sql.query(text, params),
    batch: (list) => sql.transaction(list.map(([text, params = []]) => sql.query(text, params))),
  })
}

export function fromPglite(pg) {
  return wrap({
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    batch: (list) =>
      pg.transaction(async (tx) => {
        const out = []
        for (const [text, params = []] of list) out.push((await tx.query(text, params)).rows)
        return out
      }),
  })
}

function wrap({ query, batch }) {
  return {
    query,
    batch,
    one: async (text, params) => (await query(text, params))[0] ?? null,
  }
}
