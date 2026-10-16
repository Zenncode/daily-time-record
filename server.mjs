import http from "node:http";
import nextEnv from "@next/env";
import next from "next";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";
import { createClient } from "redis";
import { WebSocket, WebSocketServer } from "ws";

nextEnv.loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const dev = args.includes("--dev") || (!args.includes("--production") && process.env.NODE_ENV !== "production");
const hostIndex = args.indexOf("--hostname");
const portIndex = args.indexOf("--port");
const hostname = hostIndex >= 0 ? args[hostIndex + 1] : (process.env.HOSTNAME || "0.0.0.0");
const port = Number(portIndex >= 0 ? args[portIndex + 1] : (process.env.PORT || 3100));
process.env.PORT = String(port);
process.env.REALTIME_PUBLISH_URL ||= `http://127.0.0.1:${port}/_dtr/realtime/publish`;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const database = new PrismaClient();
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
}

const secret = new TextEncoder().encode(sessionSecret);
const sockets = new Map();
const realtimePath = "/_dtr/realtime";
const publishPath = "/_dtr/realtime/publish";
const redisChannelPrefix = "daymark:realtime";
const validRoles = new Set(["ADMIN", "MANAGER", "EMPLOYEE"]);
const redisClient = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : null;
const redisSubscriber = process.env.REDIS_URL ? createClient({ url: process.env.REDIS_URL }) : null;
let redisEnabled = false;

function getRedisChannel(channel) {
  return `${redisChannelPrefix}:${channel}`;
}

function dispatchLocalMessage(channel, message) {
  const delivered = new Set();
  for (const socket of sockets.get(channel) ?? []) {
    if (socket.readyState === WebSocket.OPEN && !delivered.has(socket)) {
      socket.send(message);
      delivered.add(socket);
    }
  }
  return delivered.size;
}

async function setupRedis() {
  if (!redisClient || !redisSubscriber) return;

  redisClient.on("error", (error) => console.error("Realtime Redis client error:", error.message));
  redisSubscriber.on("error", (error) => console.error("Realtime Redis subscriber error:", error.message));

  try {
    await redisClient.connect();
    await redisSubscriber.connect();
    await redisSubscriber.pSubscribe(getRedisChannel("*"));
    redisSubscriber.on("pmessage", (_pattern, channel, message) => {
      const localChannel = channel.startsWith(`${redisChannelPrefix}:`)
        ? channel.slice(redisChannelPrefix.length + 1)
        : channel;
      dispatchLocalMessage(localChannel, message);
    });
    redisEnabled = true;
  } catch (error) {
    console.warn("Realtime Redis unavailable; falling back to in-memory relay.", error instanceof Error ? error.message : error);
    redisEnabled = false;
  }
}

function parseRequestUrl(request) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const query = {};
  for (const [key, value] of url.searchParams) {
    if (query[key] === undefined) query[key] = value;
    else if (Array.isArray(query[key])) query[key].push(value);
    else query[key] = [query[key], value];
  }
  return { pathname: url.pathname, query };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

function addSocketChannel(socket, channel) {
  let subscribers = sockets.get(channel);
  if (!subscribers) {
    subscribers = new Set();
    sockets.set(channel, subscribers);
  }
  subscribers.add(socket);
  socket.channels.add(channel);
}

function removeSocket(socket) {
  clearTimeout(socket.expiryTimer);
  for (const channel of socket.channels) {
    const subscribers = sockets.get(channel);
    subscribers?.delete(socket);
    if (subscribers?.size === 0) sockets.delete(channel);
  }
  socket.channels.clear();
}

async function authenticateSocket(request) {
  const cookieHeader = request.headers.cookie ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("dtr_session="));
  if (!sessionCookie) return null;

  let token;
  try {
    token = decodeURIComponent(sessionCookie.slice("dtr_session=".length));
  } catch {
    return null;
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: "daymark",
      audience: "daymark-session",
    }));
  } catch {
    return null;
  }

  if (
    typeof payload.id !== "string" ||
    typeof payload.role !== "string" ||
    !validRoles.has(payload.role)
  ) return null;

  const user = await database.user.findUnique({
    where: { id: payload.id },
    select: { id: true, role: true, active: true, managerId: true },
  });
  if (!user?.active || user.role !== payload.role) return null;

  return {
    user,
    expiry: typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 8 * 60 * 60 * 1000,
  };
}

function handlePublish(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  void (async () => {
    const authorization = request.headers.authorization ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    let payload;
    try {
      ({ payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        issuer: "daymark",
        audience: "daymark-realtime-publisher",
      }));
    } catch {
      return sendJson(response, 401, { error: "Unauthorized." });
    }

    if (payload.type !== "publish") return sendJson(response, 401, { error: "Unauthorized." });

    let body = "";
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > 4096) {
        tooLarge = true;
        sendJson(response, 413, { error: "Payload too large." });
      }
    });
    request.on("end", async () => {
      if (tooLarge) return;
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return sendJson(response, 400, { error: "Invalid payload." });
      }
      if (
        !Array.isArray(parsed.channels) ||
        parsed.channels.length > 32 ||
        parsed.channels.some((channel) =>
          typeof channel !== "string" || !/^(admin|user:[0-9a-f-]{36}|manager:[0-9a-f-]{36})$/i.test(channel),
        )
      ) return sendJson(response, 400, { error: "Invalid channels." });

      const message = JSON.stringify({ type: "refresh", sentAt: Date.now() });
      if (redisEnabled && redisClient) {
        try {
          for (const channel of parsed.channels) {
            await redisClient.publish(getRedisChannel(channel), message);
          }
          return sendJson(response, 200, { delivered: 0, published: parsed.channels.length });
        } catch (error) {
          console.error("Realtime Redis publish failed:", error);
          return sendJson(response, 500, { error: "Realtime publish failed." });
        }
      }

      const delivered = new Set();
      for (const channel of parsed.channels) {
        for (const socket of sockets.get(channel) ?? []) {
          if (socket.readyState === WebSocket.OPEN && !delivered.has(socket)) {
            socket.send(message);
            delivered.add(socket);
          }
        }
      }
      sendJson(response, 200, { delivered: delivered.size });
    });
    request.on("error", (error) => {
      if (!response.headersSent && !response.destroyed) {
        console.error("Realtime publish request failed:", error.message);
        sendJson(response, 400, { error: "Invalid request." });
      }
    });
  })().catch((error) => {
    console.error("Realtime publish authorization failed:", error);
    if (!response.headersSent && !response.destroyed) sendJson(response, 500, { error: "Realtime publish failed." });
  });
}

await setupRedis();
await app.prepare();
const handleUpgrade = app.getUpgradeHandler();

const server = http.createServer((request, response) => {
  const url = parseRequestUrl(request);
  if (url.pathname === publishPath) return handlePublish(request, response);
  return handle(request, response, url);
});
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 });

server.on("upgrade", (request, socket, head) => {
  const url = parseRequestUrl(request);
  if (url.pathname !== realtimePath) {
    if (dev) return handleUpgrade(request, socket, head);
    socket.destroy();
    return;
  }

  const origin = request.headers.origin;
  const hostHeader = request.headers.host;
  if (!origin || !hostHeader) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.host !== hostHeader ||
      !["http:", "https:"].includes(parsedOrigin.protocol)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
  } catch {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  void authenticateSocket(request).then((auth) => {
    if (!auth || socket.destroyed) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (client) => {
      client.channels = new Set();
      client.userId = auth.user.id;
      client.userRole = auth.user.role;
      addSocketChannel(client, `user:${auth.user.id}`);
      if (auth.user.role === "ADMIN") addSocketChannel(client, "admin");
      if (auth.user.role === "MANAGER") addSocketChannel(client, `manager:${auth.user.id}`);
      if (auth.user.managerId) addSocketChannel(client, `manager:${auth.user.managerId}`);
      client.expiryTimer = setTimeout(
        () => client.close(4001, "Session expired"),
        Math.max(1, auth.expiry - Date.now()),
      );
      client.on("message", () => client.close(1008, "Client messages are not supported"));
      client.on("close", () => removeSocket(client));
      client.on("error", (error) => console.error("Realtime WebSocket error:", error.message));
      client.send(JSON.stringify({ type: "connected" }));
    });
  }).catch((error) => {
    console.error("Realtime connection authorization failed:", error);
    socket.destroy();
  });
});

const heartbeat = setInterval(() => {
  for (const socket of websocketServer.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30_000);

const sessionRevalidation = setInterval(() => {
  for (const socket of websocketServer.clients) {
    void database.user.findUnique({
      where: { id: socket.userId },
      select: { role: true, active: true },
    }).then((user) => {
      if (!user?.active || user.role !== socket.userRole) socket.close(4001, "Session is no longer active");
    }).catch((error) => console.error("Realtime session revalidation failed:", error));
  }
}, 60_000);

websocketServer.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => { socket.isAlive = true; });
});

server.listen(port, hostname, () => {
  console.log(`> Daymark listening on http://${hostname}:${port}`);
  console.log("> Same-origin WebSocket endpoint: /_dtr/realtime");
});

async function shutdown() {
  clearInterval(heartbeat);
  clearInterval(sessionRevalidation);
  for (const socket of websocketServer.clients) socket.close(1001, "Server shutting down");
  if (redisClient) await redisClient.quit();
  if (redisSubscriber) await redisSubscriber.quit();
  await new Promise((resolve) => server.close(resolve));
  await database.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
