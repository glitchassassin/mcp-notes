import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface CORSOptions {
  origin?: string;
  methods?: string;
  headers?: string;
  maxAge?: number;
}

interface Note {
  id: number;
  title: string;
  user: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Notes API",
    version: "1.0.0",
  });

  async init() {
    // Initialize the database schema
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        user TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create note
    this.server.tool(
      "createNote",
      {
        title: z.string(),
        user: z.string(),
        body: z.string(),
      },
      async ({ title, user, body }) => {
        console.log(
          `[createNote] Creating note for user ${user} with title "${title}"`
        );
        const cursor = this.ctx.storage.sql.exec(
          "INSERT INTO notes (title, user, body) VALUES (?, ?, ?) RETURNING *",
          title,
          user,
          body
        );
        const result = cursor.one();
        console.log(
          `[createNote] Successfully created note with ID ${result.id}`
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Read note
    this.server.tool("readNote", { id: z.number() }, async ({ id }) => {
      console.log(`[readNote] Reading note with ID ${id}`);
      const cursor = this.ctx.storage.sql.exec(
        "SELECT * FROM notes WHERE id = ?",
        id
      );
      const result = cursor.one();
      console.log(`[readNote] Found note: ${JSON.stringify(result)}`);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // List notes
    this.server.tool("listNotes", { user: z.string() }, async ({ user }) => {
      console.log(`[listNotes] Listing notes for user ${user}`);
      const cursor = this.ctx.storage.sql.exec(
        "SELECT * FROM notes WHERE user = ? ORDER BY created_at DESC",
        user
      );
      const result = cursor.toArray();
      console.log(`[listNotes] Found ${result.length} notes for user ${user}`);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // Update note
    this.server.tool(
      "updateNote",
      {
        id: z.number(),
        title: z.string().optional(),
        body: z.string().optional(),
      },
      async ({ id, title, body }) => {
        console.log(
          `[updateNote] Updating note ${id} with title "${title}" and body "${body}"`
        );
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
          console.log(`[updateNote] No fields to update for note ${id}`);
          return { content: [{ type: "text", text: "No fields to update" }] };
        }

        updates.push("updated_at = CURRENT_TIMESTAMP");
        params.push(id);

        const cursor = this.ctx.storage.sql.exec(
          `UPDATE notes SET ${updates.join(", ")} WHERE id = ? RETURNING *`,
          ...params
        );
        const result = cursor.one();
        console.log(`[updateNote] Successfully updated note ${id}`);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Delete note
    this.server.tool("deleteNote", { id: z.number() }, async ({ id }) => {
      console.log(`[deleteNote] Deleting note ${id}`);
      this.ctx.storage.sql.exec("DELETE FROM notes WHERE id = ?", id);
      console.log(`[deleteNote] Successfully deleted note ${id}`);
      return { content: [{ type: "text", text: "Note deleted" }] };
    });
  }

  static mount(
    path: string,
    {
      binding,
      corsOptions,
    }: { binding?: string; corsOptions?: CORSOptions } = {}
  ): {
    fetch: (
      request: Request,
      env: Record<string, DurableObjectNamespace<McpAgent>>,
      ctx: ExecutionContext
    ) => Promise<Response | undefined>;
  } {
    const { fetch, ...rest } = super.mount(path, { binding, corsOptions });

    return {
      fetch: async (request, env, ctx) => {
        if (
          env.MCP_SECRET &&
          request.headers.get("Authorization") !== `Bearer ${env.MCP_SECRET}`
        ) {
          return new Response("Unauthorized", { status: 401 });
        }
        return await fetch(request, env, ctx);
      },
      ...rest,
    };
  }
}

export default MyMCP.mount("/sse");
