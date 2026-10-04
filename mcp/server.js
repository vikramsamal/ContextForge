import readline from "node:readline";
import process from "node:process";
import { MCP_TOOLS } from "./tools.js";

const SERVER_NAME = "contextforge";
const SERVER_VERSION = "0.2.0";

export async function runMcpServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const toolLookup = new Map(MCP_TOOLS.map((t) => [t.name, t]));

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (err) {
      sendError(null, -32700, "Parse error");
      return;
    }

    try {
      await handleMessage(msg, toolLookup);
    } catch (err) {
      sendError(msg.id, -32603, `Internal error: ${err.message}`);
    }
  });

  // Handle process shutdown
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

async function handleMessage(msg, toolLookup) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    sendResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
    });
    return;
  }

  if (method === "notifications/initialized") {
    // Client acknowledgment, nothing to respond to
    return;
  }

  if (method === "ping") {
    sendResult(id, {});
    return;
  }

  if (method === "tools/list") {
    sendResult(id, {
      tools: MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};
    const tool = toolLookup.get(name);
    if (!tool) {
      sendError(id, -32601, `Tool not found: ${name}`);
      return;
    }

    try {
      const result = await tool.handler(args || {});
      sendResult(id, {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      });
    } catch (err) {
      sendResult(id, {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${err.message}`,
          },
        ],
        isError: true,
      });
    }
    return;
  }

  // Unknown method
  if (id !== undefined && id !== null) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

function sendResult(id, result) {
  if (id === undefined || id === null) return;
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id,
    result,
  });
  process.stdout.write(payload + "\n");
}

function sendError(id, code, message) {
  if (id === undefined || id === null) return;
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  process.stdout.write(payload + "\n");
}
