import { Database } from "bun:sqlite";

const db = new Database("energy-time.db", { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS subscribers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id      INTEGER NOT NULL UNIQUE,
    username     TEXT,
    subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
    active       INTEGER NOT NULL DEFAULT 1
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(active)
`);

export interface Subscriber {
  id: number;
  chat_id: number;
  username: string | null;
  subscribed_at: string;
  active: number;
}

export function subscribe(chatId: number, username?: string): void {
  db.run(
    `INSERT INTO subscribers (chat_id, username, active)
     VALUES (?, ?, 1)
     ON CONFLICT(chat_id) DO UPDATE SET active = 1, username = excluded.username`,
    [chatId, username ?? null]
  );
}

export function unsubscribe(chatId: number): void {
  db.run(`UPDATE subscribers SET active = 0 WHERE chat_id = ?`, [chatId]);
}

export function getActiveSubscribers(): Subscriber[] {
  return db
    .query<Subscriber, []>(`SELECT * FROM subscribers WHERE active = 1`)
    .all();
}

export function isSubscribed(chatId: number): boolean {
  const row = db
    .query<{ active: number }, [number]>(
      `SELECT active FROM subscribers WHERE chat_id = ?`
    )
    .get(chatId);
  return row?.active === 1;
}
