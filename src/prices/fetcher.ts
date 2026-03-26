export interface HourlyPrice {
  hour: number; // 0–23
  price: number; // EUR/MWh
  priceKwh: number; // c€/kWh
}

export class PricesNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricesNotAvailableError";
  }
}

const OCTOPUS_URL = "https://octopusenergy.es/precio-luz-hoy";

export async function fetchDayPrices(_date?: Date): Promise<HourlyPrice[]> {
  const res = await fetch(OCTOPUS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new PricesNotAvailableError(
      `Octopus Energy fetch error: ${res.status} ${res.statusText}`
    );
  }

  const html = await res.text();

  // Extract pvpcPrice array from React Query dehydrated state embedded in the page
  const match = html.match(/"pvpcPrice":(\[[\s\S]*?\])\s*[,}]/);
  if (!match) {
    throw new PricesNotAvailableError(
      "Could not find pvpcPrice data in Octopus Energy page"
    );
  }

  let entries: Array<{ effectiveAt: string; price: number }>;
  try {
    entries = JSON.parse(match[1]!);
  } catch {
    throw new PricesNotAvailableError("Failed to parse pvpcPrice JSON");
  }

  if (!entries || entries.length === 0) {
    throw new PricesNotAvailableError("No pvpcPrice entries found");
  }

  // Sort by effectiveAt and map to HourlyPrice
  const sorted = entries.sort(
    (a, b) =>
      new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime()
  );

  return sorted.map((entry, i) => {
    const priceEurMwh = entry.price; // already in €/MWh equivalent (price/1000 = €/kWh)
    return {
      hour: i,
      price: priceEurMwh, // EUR/MWh
      priceKwh: priceEurMwh / 10, // c€/kWh
    };
  });
}
