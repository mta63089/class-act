# The Class Act

## Future migrations

After changing `src/db/schema.ts`, run `npm run db:generate` to create the next SQL migration.
Review it and apply with `npm run db:migrate:local`. Commit the generated `drizzle/` directory
alongside your schema changes. After confirming local behavior, use remote migration against the
real database.
