import { Hono } from "hono";
import { webhookCallback } from "grammy";
import type { Bot } from "grammy";

export function createApp(bot: Bot): Hono {
  const app = new Hono();

  const webhookSecret = process.env.WEBHOOK_SECRET;

  app.post("/webhook", webhookCallback(bot, "hono", {
    secretToken: webhookSecret,
  }));

  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}
