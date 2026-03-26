import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import type { HourlyPrice } from "../prices/fetcher";

const WIDTH = 900;
const HEIGHT = 500;

const renderer = new ChartJSNodeCanvas({
  width: WIDTH,
  height: HEIGHT,
  backgroundColour: "#000000",
});

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function getBarColor(price: number, medianPrice: number): string {
  if (price < medianPrice * 0.85) return "#4ade80"; // green — cheap
  if (price < medianPrice * 1.15) return "#facc15"; // yellow — medium
  return "#f87171"; // red — expensive
}

function formatDateSpanish(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Europe/Madrid",
  });
}

export interface ChartResult {
  buffer: Buffer;
  caption: string;
}

export async function generatePriceChart(
  prices: HourlyPrice[],
  date?: Date
): Promise<ChartResult> {
  if (prices.length === 0) throw new Error("prices array is empty");
  const target = date ?? new Date();
  const priceValues = prices.map((p) => p.priceKwh);
  const maxPrice = Math.max(...priceValues);
  const minPrice = Math.min(...priceValues);
  const avgPrice = priceValues.reduce((sum, v) => sum + v, 0) / priceValues.length;
  const medianPrice = median(priceValues);

  const nowHour = new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid", hour: "numeric", hour12: false });
  const currentHour = parseInt(nowHour, 10);
  const isToday = (() => {
    const now = new Date();
    const t = target;
    return (
      now.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" }) ===
      t.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })
    );
  })();

  const labels = prices.map((p) => `${String(p.hour).padStart(2, "0")}h`);
  const data = prices.map((p) => parseFloat(p.priceKwh.toFixed(4)));
  const colors = prices.map((p) => getBarColor(p.priceKwh, medianPrice));
  const borderWidths = prices.map((p) =>
    isToday && p.hour === currentHour ? 3 : 1
  );
  const borderColors = prices.map((p, i) =>
    isToday && p.hour === currentHour ? "#ffffff" : (colors[i] ?? "#facc15")
  );

  const cheapHours = prices
    .filter((p) => p.priceKwh < medianPrice * 0.85)
    .map((p) => `${String(p.hour).padStart(2, "0")}h`);
  const expensiveHours = prices
    .filter((p) => p.priceKwh >= medianPrice * 1.15)
    .map((p) => `${String(p.hour).padStart(2, "0")}h`);

  const dateStr = formatDateSpanish(target);
  const titleDate = `${dateStr.charAt(0).toUpperCase()}${dateStr.slice(1)}`;
  const title = `⚡ Precios luz — ${titleDate}`;

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Precio (c€/kWh)",
          data,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: borderWidths,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: [title, "🟢 Barato  ·  🟡 Normal  ·  🔴 Caro"],
          color: "#e2e8f0",
          font: { size: 16, weight: "bold" },
          padding: { bottom: 16 },
        },
      },
      scales: {
        x: {
          ticks: { color: "#94a3b8", font: { size: 11 } },
          grid: { color: "#3d3d5e" },
        },
        y: {
          ticks: {
            color: "#94a3b8",
            font: { size: 11 },
            callback: (value) => `${Number(value).toFixed(2)}`,
          },
          grid: { color: "#3d3d5e" },
          title: {
            display: true,
            text: "c€/kWh",
            color: "#94a3b8",
            font: { size: 12 },
          },
        },
      },
    },
  };

  const buffer = await renderer.renderToBuffer(config);

  const minHour = String(prices.find((p) => p.priceKwh === minPrice)?.hour ?? 0).padStart(2, "0");
  const maxHour = String(prices.find((p) => p.priceKwh === maxPrice)?.hour ?? 0).padStart(2, "0");

  const caption =
    `⚡ *Precios luz — ${titleDate}*\n\n` +
    (cheapHours.length > 0 ? `🟢 *Horas baratas:* ${cheapHours.join(", ")}\n\n` : "") +
    (expensiveHours.length > 0 ? `🔴 *Horas caras:* ${expensiveHours.join(", ")}\n` : "") +
    `\n` +
    `💰 Más barata: *${minHour}h → ${minPrice.toFixed(2)} c€/kWh*\n` +
    `💸 Más cara: *${maxHour}h → ${maxPrice.toFixed(2)} c€/kWh*\n\n` +
    `📊 Media del día: *${avgPrice.toFixed(2)} c€/kWh*`;

  return { buffer, caption };
}
