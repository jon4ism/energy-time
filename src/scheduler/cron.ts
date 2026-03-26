import cron from "node-cron";
import { InputFile, type Bot } from "grammy";
import { getActiveSubscribers } from "../db/database";
import { fetchDayPrices, PricesNotAvailableError } from "../prices/fetcher";
import { generatePriceChart } from "../chart/generator";

export function startScheduler(bot: Bot): void {
  // Every day at 8:00 AM Europe/Madrid
  cron.schedule(
    "0 8 * * *",
    async () => {
      const subscribers = getActiveSubscribers();
      if (subscribers.length === 0) return;

      console.log(
        `[scheduler] Broadcasting prices to ${subscribers.length} subscriber(s)...`
      );

      let prices;
      try {
        prices = await fetchDayPrices();
      } catch (err) {
        if (err instanceof PricesNotAvailableError) {
          console.error("[scheduler] Prices not available:", err.message);
        } else {
          console.error("[scheduler] Failed to fetch prices:", err);
        }
        return;
      }

      const { buffer, caption } = await generatePriceChart(prices);

      const results = await Promise.allSettled(
        subscribers.map(async (sub) => {
          await bot.api.sendPhoto(
            sub.chat_id,
            new InputFile(buffer, "prices.png"),
            { caption, parse_mode: "Markdown" }
          );
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      console.log(
        `[scheduler] Broadcast complete: ${succeeded} sent, ${failed} failed`
      );

      // Log individual failures
      results.forEach((result, i) => {
        if (result.status === "rejected") {
          console.error(
            `[scheduler] Failed to send to chat_id ${subscribers[i]?.chat_id}:`,
            result.reason
          );
        }
      });
    },
    {
      timezone: "Europe/Madrid",
    }
  );

  console.log("[scheduler] Cron job scheduled: daily at 08:00 Europe/Madrid");
}
