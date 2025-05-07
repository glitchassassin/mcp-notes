import { DurableObject } from "cloudflare:workers";

export class Notes extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    // Initialize the database schema
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  createNote(title: string, body: string) {
    const cursor = this.ctx.storage.sql.exec(
      "INSERT INTO notes (title, body) VALUES (?, ?) RETURNING *",
      title,
      body
    );
    return cursor.one();
  }

  readNote(id: number) {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT * FROM notes WHERE id = ?",
      id
    );
    return cursor.one();
  }

  listNotes() {
    const cursor = this.ctx.storage.sql.exec(
      "SELECT * FROM notes ORDER BY created_at DESC"
    );
    return cursor.toArray();
  }

  updateNote(id: number, title?: string, body?: string) {
    const updates = [];
    const params = [];

    if (title) {
      updates.push("title = ?");
      params.push(title);
    }
    if (body) {
      updates.push("body = ?");
      params.push(body);
    }

    if (updates.length === 0) {
      return null;
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const cursor = this.ctx.storage.sql.exec(
      `UPDATE notes SET ${updates.join(", ")} WHERE id = ? RETURNING *`,
      ...params
    );
    return cursor.one();
  }

  async deleteNote(id: number) {
    this.ctx.storage.sql.exec("DELETE FROM notes WHERE id = ?", id);
    return true;
  }
}
