import { Bot } from "grammy";
import { registerCommands } from "./src/bot/commands";
import { startScheduler } from "./src/scheduler/cron";
import { createApp } from "./src/app";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const bot = new Bot(token);

registerCommands(bot);
startScheduler(bot);

const isDev = process.env.NODE_ENV !== "production";

if (isDev) {
  // Polling mode — no public URL required
  console.log("[bot] Starting in polling mode (development)...");
  bot.start({
    onStart: (info) => {
      console.log(`[bot] Running as @${info.username}`);
    },
  });
} else {
  // Webhook mode — production
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("WEBHOOK_URL is not set in production mode");
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  await bot.api.setWebhook(webhookUrl + "/webhook", {
    secret_token: webhookSecret,
  });
  console.log(`[bot] Webhook set to ${webhookUrl}/webhook`);

  const app = createApp(bot);
  const port = parseInt(process.env.PORT ?? "3000", 10);
  if (Number.isNaN(port)) throw new Error(`Invalid PORT: ${process.env.PORT}`);

  Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`[server] Listening on port ${port}`);
}
