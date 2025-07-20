import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const PORT = 3000;
const STATIC_DIR = join(import.meta.dirname, "client", "dist");

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

type ServeFileResult = { content: Buffer; contentType: string } | Error;

async function serveFile(filePath: string): Promise<ServeFileResult> {
  let data: Buffer;
  try {
    data = await readFile(filePath);
  } catch (e) {
    return new Error(`File not found: ${filePath}`);
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] ?? "application/octet-stream";
  
  return { content: data, contentType };
}

const server = createServer(async (req, res): Promise<void> => {
  const url = req.url ?? "/";
  const safePath = url === "/" ? "/index.html" : url;
  const filePath = join(STATIC_DIR, safePath);

  // Prevent directory traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const result = await serveFile(filePath);
  
  if (result instanceof Error) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  res.writeHead(200, { "Content-Type": result.contentType });
  res.end(result.content);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});