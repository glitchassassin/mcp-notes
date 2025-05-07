import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Notes } from "./notes";

export { Notes } from "./notes";

export type Env = {
  MCP_SECRET: string;
  NOTES: DurableObjectNamespace<Notes>;
};

export type Props = {
  token: string;
};

export class MyMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: "Notes API",
    version: "1.0.0",
  });

  get notes(): DurableObjectStub<Notes> {
    const notes = this.env.NOTES.idFromName(this.props.token);
    return this.env.NOTES.get(notes);
  }

  async init() {
    // Create note
    this.server.tool(
      "createNote",
      `Create a note with the given title and body`,
      {
        title: z.string(),
        body: z.string(),
      },
      async ({ title, body }) => {
        console.log(`[createNote] Creating note with title "${title}"`);
        const result = await this.notes.createNote(title, body);
        console.log(
          `[createNote] Successfully created note with ID ${result.id}`
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Read note
    this.server.tool(
      "readNote",
      `Fetch the contents of a note`,
      { id: z.number() },
      async ({ id }) => {
        console.log(`[readNote] Reading note with ID ${id}`);
        const result = await this.notes.readNote(id);
        console.log(`[readNote] Found note: ${JSON.stringify(result)}`);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // List notes
    this.server.tool(
      "listNotes",
      `List all notes`,
      { list: z.boolean() },
      async ({ list }) => {
        console.log(`[listNotes] Listing notes`);
        const result = await this.notes.listNotes();
        console.log(`[listNotes] Found ${result.length} notes`);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Update note
    this.server.tool(
      "updateNote",
      `Update the contents of a note. Will only update the fields provided.`,
      {
        id: z.number(),
        title: z.string().optional(),
        body: z.string().optional(),
      },
      async ({ id, title, body }) => {
        console.log(
          `[updateNote] Updating note ${id} with title "${title}" and body "${body}"`
        );
        const result = await this.notes.updateNote(id, title, body);
        console.log(`[updateNote] Successfully updated note ${id}`);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    );

    // Delete note
    this.server.tool(
      "deleteNote",
      `Delete a note`,
      { id: z.number() },
      async ({ id }) => {
        console.log(`[deleteNote] Deleting note ${id}`);
        await this.notes.deleteNote(id);
        console.log(`[deleteNote] Successfully deleted note ${id}`);
        return { content: [{ type: "text", text: "Note deleted" }] };
      }
    );
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (env.MCP_SECRET && token !== env.MCP_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { pathname } = new URL(request.url);

    // pass token to props
    ctx.props.token = token;

    if (pathname.startsWith("/sse")) {
      return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (pathname.startsWith("/mcp")) {
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // Handle case where no path matches
    return new Response("Not found", { status: 404 });
  },
};
