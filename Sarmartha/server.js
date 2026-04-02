const http = require("http");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const baseDir = __dirname;
const usersFile = path.join(baseDir, "data", "users.json");
const port = process.env.PORT || 3000;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

async function ensureUsersFile() {
  try {
    await fs.access(usersFile);
  } catch {
    await fs.writeFile(usersFile, "[]", "utf8");
  }
}

async function readUsers() {
  await ensureUsersFile();
  const content = await fs.readFile(usersFile, "utf8");
  return JSON.parse(content || "[]");
}

async function writeUsers(users) {
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

async function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("hex"));
    });
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await scryptAsync(password, salt);
  return { salt, passwordHash };
}

async function verifyPassword(password, user) {
  const incomingHash = await scryptAsync(password, user.salt);
  const incoming = Buffer.from(incomingHash, "hex");
  const stored = Buffer.from(user.passwordHash, "hex");
  return incoming.length === stored.length && crypto.timingSafeEqual(incoming, stored);
}

async function handleSignup(request, response) {
  const body = await parseBody(request);
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!name || !email || password.length < 6) {
    sendJson(response, 400, { message: "Name, valid email, and a password of at least 6 characters are required." });
    return;
  }

  const users = await readUsers();
  if (users.some((user) => user.email === email)) {
    sendJson(response, 409, { message: "An account with this email already exists." });
    return;
  }

  const { salt, passwordHash } = await createPasswordRecord(password);
  const newUser = {
    id: `user-${Date.now()}`,
    name,
    email,
    salt,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  await writeUsers(users);

  sendJson(response, 201, {
    message: "Signup successful.",
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email
    }
  });
}

async function handleLogin(request, response) {
  const body = await parseBody(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email || !password) {
    sendJson(response, 400, { message: "Email and password are required." });
    return;
  }

  const users = await readUsers();
  const user = users.find((entry) => entry.email === email);

  if (!user || !(await verifyPassword(password, user))) {
    sendJson(response, 401, { message: "Invalid email or password." });
    return;
  }

  sendJson(response, 200, {
    message: "Login successful.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
}

async function serveStatic(response, requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(baseDir, safePath);

  if (!filePath.startsWith(baseDir)) {
    sendJson(response, 403, { message: "Access denied." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    sendJson(response, 404, { message: "File not found." });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(302, { Location: "/html/index.html" });
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/signup") {
      await handleSignup(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      await handleLogin(request, response);
      return;
    }

    if (request.method === "GET" && (url.pathname.startsWith("/html/") || url.pathname.startsWith("/css/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/js/"))) {
      await serveStatic(response, url.pathname.slice(1));
      return;
    }

    sendJson(response, 404, { message: "Route not found." });
  } catch (error) {
    sendJson(response, 500, { message: error.message || "Internal server error." });
  }
});

server.listen(port, () => {
  console.log(`Sarmartha server running at http://localhost:${port}`);
});
