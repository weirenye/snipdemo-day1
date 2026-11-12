import { isAbsolute, relative, resolve, sep } from "node:path";

const links = new Map();
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const baseUrl =
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${port}`);
const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
const publicDir = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function createCode() {
  let code = "";
  while (code.length < 6) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < 248) code += alphabet[byte % alphabet.length];
      if (code.length === 6) break;
    }
  }
  return code;
}

async function serveStatic(pathname) {
  if (!publicDir) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname).replaceAll("\\", "/");
  } catch {
    return null;
  }
  if (decodedPath.includes("\0")) return null;

  const relativePath =
    decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = resolve(publicDir, relativePath);
  const fileRelativeToRoot = relative(publicDir, filePath);
  if (
    fileRelativeToRoot === ".." ||
    fileRelativeToRoot.startsWith(`..${sep}`) ||
    isAbsolute(fileRelativeToRoot)
  ) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;

  return new Response(file, {
    headers: {
      ...corsHeaders,
      "Content-Type": file.type || "application/octet-stream",
    },
  });
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Request body must be valid JSON" }, 400);
      }

      if (!body || typeof body.url !== "string") {
        return jsonResponse({ error: "url must be a valid HTTP(S) URL" }, 400);
      }

      let originalUrl;
      try {
        originalUrl = new URL(body.url);
      } catch {
        return jsonResponse({ error: "url must be a valid HTTP(S) URL" }, 400);
      }
      if (originalUrl.protocol !== "http:" && originalUrl.protocol !== "https:") {
        return jsonResponse({ error: "url must be a valid HTTP(S) URL" }, 400);
      }

      let code;
      do {
        code = createCode();
      } while (links.has(code));

      const link = {
        code,
        url: originalUrl.href,
        shortUrl: `${normalizedBaseUrl}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return jsonResponse(link, 201);
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return jsonResponse([...links.values()]);
    }

    if (request.method === "GET") {
      const staticResponse = await serveStatic(pathname);
      if (staticResponse) return staticResponse;

      const link = links.get(pathname.slice(1));
      if (!link || pathname === "/") {
        return jsonResponse({ error: "Not found" }, 404);
      }
      link.hits += 1;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: link.url },
      });
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend listening on port ${port}`);
