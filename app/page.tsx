import BoatList, { type Boat } from "./components/BoatList";

function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;

  // casos típicos n8n
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;

  if (data && typeof data === "object") return [data];
  return [];
}

function mapBoat(r: any): Boat {
  return {
    id: r["Id"] ?? r["id"],
    name: r["Boat Name"] ?? r["name"],
    rating: r["Rating"] ?? r["rating"],
    model: r["Model"] ?? r["model"],
    serviceType: r["Service Type"] ?? r["serviceType"],
    boatType: r["Boat Type"] ?? r["boatType"],
    base: r["Base"] ?? r["base"],
    country: r["Country"] ?? r["country"],
    lengthFt: r["Lenght (ft)"] ?? r["Length (ft)"] ?? r["lengthFt"] ?? r["length_ft"],
    image: r["Image"] ?? r["Main Image"] ?? r["image"],
    defaultCurrency: r["Currency"] ?? r["currency"],
    defaultPrice: r["Default Price"] ?? r["defaultPrice"],
  };
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.log("webhook error", res.status, text.slice(0, 300));
    return null;
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function getBoats(): Promise<Boat[]> {
  const url = process.env.WEBHOOK_URL;
  if (!url) return [];

  const data = await postJson(url, {});
  const raw = extractArray(data);
  return raw.map(mapBoat);
}

async function getItineraries(): Promise<{ id: string; title: string }[]> {
  const url = process.env.WEBHOOK_ITINERARIES_URL;
  if (!url) return [];

  const data = await postJson(url, {});
  const raw = extractArray(data);
  return raw
    .map((r: any) => ({
      id: String(r.id ?? r["Id"]),
      title: String(r.title ?? r["Title"] ?? r["Name"] ?? "Itinerary"),
    }))
    .filter((x) => x.id && x.title);
}

export default async function Home() {
  const [boats, itineraries] = await Promise.all([getBoats(), getItineraries()]);
  return <BoatList boats={boats} itineraries={itineraries} />;
}
