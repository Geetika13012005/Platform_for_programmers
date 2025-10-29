import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { signup, login, me } from "./routes/auth.js";
import { execute } from "./routes/execute.js";
import { listNotebooks, createNotebook, getNotebook, updateNotebook } from "./routes/notebooks.js";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Auth
  app.post("/api/auth/signup", signup);
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", me);


  // Code execution
  app.post("/api/run", execute);

  // Notebooks
  app.get("/api/notebooks", listNotebooks);
  app.post("/api/notebooks", createNotebook);
  app.get("/api/notebooks/:id", getNotebook);
  app.put("/api/notebooks/:id", updateNotebook);

  return app;
}
