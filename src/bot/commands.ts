import { InputFile, type Bot, type Context } from "grammy";
import { subscribe, unsubscribe } from "../db/database";
import { fetchDayPrices, PricesNotAvailableError } from "../prices/fetcher";
import { generatePriceChart } from "../chart/generator";

export async function sendPriceChart(
  bot: Bot,
  chatId: number,
  date?: Date
): Promise<void> {
  const prices = await fetchDayPrices(date);
  const { buffer, caption } = await generatePriceChart(prices, date);

  await bot.api.sendPhoto(chatId, new InputFile(buffer, "prices.png"), {
    caption,
    parse_mode: "Markdown",
  });
}

export function registerCommands(bot: Bot): void {
  bot.command("start", async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const username = ctx.from?.username;
    if (!chatId) return;

    subscribe(chatId, username);

    await ctx.reply(
      "✅ *¡Suscripción activada!*\n\n" +
        "Recibirás cada día a las 8:00 AM (hora española) una imagen con los precios PVPC por hora.\n\n" +
        "Usa /hoy para ver los precios de hoy ahora mismo.\n" +
        "Usa /stop para cancelar la suscripción.",
      { parse_mode: "Markdown" }
    );
  });

  bot.command("stop", async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    unsubscribe(chatId);

    await ctx.reply(
      "❌ *Suscripción cancelada.*\n\n" +
        "Ya no recibirás los precios diarios.\n" +
        "Usa /start para volver a suscribirte.",
      { parse_mode: "Markdown" }
    );
  });

  bot.command("hoy", async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    try {
      await ctx.replyWithChatAction("upload_photo");
      await sendPriceChart(bot, chatId);
    } catch (err) {
      if (err instanceof PricesNotAvailableError) {
        await ctx.reply(
          "⚠️ No se han podido obtener los precios de hoy. Inténtalo más tarde.",
          { parse_mode: "Markdown" }
        );
      } else {
        console.error("Error sending price chart:", err);
        await ctx.reply("❌ Error al generar el gráfico. Inténtalo más tarde.");
      }
    }
  });
}
