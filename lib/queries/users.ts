/**
 * The `users` table: lookups, creation, and first-login provisioning.
 *
 * Every other query module takes a `userId` and filters by it. This one
 * produces those ids, so it is the only module here that is not itself
 * user-scoped.
 */
import { asc, eq, sql as raw } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import type { User } from '../types.ts';

type UserRow = typeof users.$inferSelect;

function toWire(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name };
}

/**
 * The session in `dev` auth mode: whoever was created first. With the
 * seed's single user that is unambiguous; if a dev database somehow has
 * several, `created_at` then `id` keeps the choice stable across restarts
 * rather than depending on Postgres's physical row order.
 */
export async function getFirstUser(): Promise<User | null> {
  const [row] = await db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)).limit(1);
  return row ? toWire(row) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toWire(row) : null;
}

/** Case-insensitive, matching the `ux_users_email_lower` unique index. */
export async function getUserByEmail(email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(raw`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return row ? toWire(row) : null;
}

export async function getUserBySupabaseUserId(supabaseUserId: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUserId))
    .limit(1);
  return row ? toWire(row) : null;
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: raw<number>`count(*)::int` }).from(users);
  return row?.n ?? 0;
}

/** Links an existing local user to a Supabase identity on first OAuth sign-in. */
export async function linkSupabaseUserId(id: string, supabaseUserId: string): Promise<User> {
  const [row] = await db.update(users).set({ supabaseUserId }).where(eq(users.id, id)).returning();
  if (!row) throw new Error(`user ${id} not found`);
  return toWire(row);
}

export interface NewUser {
  email: string;
  name?: string | null;
  supabaseUserId?: string | null;
}

/**
 * Creates a user.
 *
 * This is the hook for whatever a new account needs in order to be usable —
 * a default workspace, a starter document, a settings row. Do that work
 * **inside this transaction**: an account that is half set up is a broken
 * account, not a partially-set-up one, and the failure shows up days later
 * as a page that renders empty for exactly one person.
 */
export async function provisionUser(newUser: NewUser): Promise<User> {
  return db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(users)
      .values({
        email: newUser.email,
        name: newUser.name ?? null,
        supabaseUserId: newUser.supabaseUserId ?? null,
      })
      .returning();
    if (!userRow) throw new Error('failed to create user');

    return toWire(userRow);
  });
}
