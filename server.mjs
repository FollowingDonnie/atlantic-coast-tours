import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { answerCustomer } from "./src/assistant.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
loadDotEnv();
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 5174);
const DEFAULT_ALLOWED_ORIGINS = [
  "https://followingdonnie.github.io",
  "https://atlantic-coast-tours.onrender.com"
];
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const requestBuckets = new Map();

const server = createServer(async (request, response) => {
  try {
    setSecurityHeaders(response);
    if (!handleCors(request, response)) return;

    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, {
        ok: true,
        service: "Atlantic Coast Tours assistant",
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        tools: ["search_tours", "check_weather"],
        sheetFetchPolicy: "live-per-question-no-cache",
        time: new Date().toISOString()
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      if (!consumeRateLimit(clientAddress(request))) {
        sendJson(
          response,
          {
            error:
              "Too many questions arrived at once. Please wait a moment and try again."
          },
          429
        );
        return;
      }

      const body = await readJson(request);
      const message = String(body.message || "").trim();
      if (!message) {
        sendJson(response, { error: "Please enter a question." }, 400);
        return;
      }
      if (message.length > 2_000) {
        sendJson(
          response,
          { error: "Please keep the question under 2,000 characters." },
          400
        );
        return;
      }

      const result = await answerCustomer({
        message,
        history: body.history
      });
      sendJson(response, result);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    sendJson(response, { error: "Not found." }, 404);
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        message: error.message,
        status
      })
    );
    sendJson(
      response,
      {
        error:
          status >= 500
            ? "I could not check the live information just now. Please try again."
            : error.message
      },
      status
    );
  }
});

server.listen(PORT, () => {
  console.log(`Atlantic Coast Tours is ready at http://localhost:${PORT}`);
});

function handleCors(request, response) {
  const origin = request.headers.origin;
  const allowed =
    !origin ||
    ALLOWED_ORIGINS.has(origin) ||
    /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);

  if (!allowed) {
    sendJson(response, { error: "Origin not allowed." }, 403);
    return false;
  }

  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return false;
  }
  return true;
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requested)).replace(
    /^(\.\.[/\\])+/,
    ""
  );
  const filePath = join(PUBLIC_DIR, safePath);

  if (
    !filePath.startsWith(PUBLIC_DIR) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    sendJson(response, { error: "Not found." }, 404);
    return;
  }

  response.setHeader("Content-Type", contentType(filePath));
  response.setHeader(
    "Cache-Control",
    extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600"
  );
  createReadStream(filePath).pipe(response);
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("X-Frame-Options", "DENY");
}

function contentType(filePath) {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp"
    }[extname(filePath).toLowerCase()] || "application/octet-stream"
  );
}

function consumeRateLimit(address) {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 24;
  const bucket = requestBuckets.get(address) || [];
  const recent = bucket.filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  requestBuckets.set(address, recent);

  if (requestBuckets.size > 1_000) {
    for (const [key, times] of requestBuckets) {
      if (!times.some((time) => now - time < windowMs)) requestBuckets.delete(key);
    }
  }
  return true;
}

function clientAddress(request) {
  return (
    String(request.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function sendJson(response, payload, status = 200) {
  if (response.writableEnded) return;
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 100_000) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON request.");
    error.statusCode = 400;
    throw error;
  }
}

function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

