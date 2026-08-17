import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { getOrCreateCreator } from "../db";
import { storagePut } from "../storage";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.post("/api/uploads/product", express.raw({ type: "application/octet-stream", limit: "50mb" }), async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const creator = await getOrCreateCreator(user);
      const rawName = typeof req.query.name === "string" ? req.query.name : "download";
      const fileName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180) || "download";
      const contentType = typeof req.headers["x-content-type"] === "string" ? req.headers["x-content-type"] : "application/octet-stream";
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "A file is required" });
      const stored = await storagePut(`creators/${creator.id}/digital-products/${fileName}`, req.body, contentType);
      return res.status(201).json(stored);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return res.status(500).json({ error: message });
    }
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
