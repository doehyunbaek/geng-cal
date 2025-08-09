// Leaguepedia (lol.fandom) Cargo API client for Gen.G upcoming matches.
// We keep the UFCEvent shape used in the original project to minimize churn.
import { decode } from "html-entities";

export type UFCEvent = {
  name: string;
  url: URL;
  date: string; // ISO UTC string with trailing "Z"
  location: string;
  fightCard: string[];
  mainCard: string[];
  prelims: string[];
  earlyPrelims: string[];
  prelimsTime?: string | undefined;
  earlyPrelimsTime?: string | undefined;
};

type CargoRow = {
  "DateTime UTC": string; // "YYYY-MM-DD HH:MM:SS" (UTC)
  Team1: string;
  Team2: string;
  OverviewPage: string; // e.g., "LCK/2025 Season/Rounds 3-5"
  BestOf?: string;
  Round?: string | null;
  Stream?: string | null;
  HasTime?: string | number | boolean;
};

/**
 * Query Leaguepedia Cargo for upcoming Gen.G matches.
 * Returns raw Cargo rows.
 */
async function queryGenG(limit = 20): Promise<CargoRow[]> {
  const params = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    tables: "MatchSchedule",
    fields: [
      "DateTime_UTC=DateTime UTC",
      "Team1",
      "Team2",
      "OverviewPage",
      "BestOf",
      "Round",
      "Stream",
      "HasTime",
    ].join(","),
    where: '(Team1="Gen.G" OR Team2="Gen.G") AND DateTime_UTC > NOW()',
    order_by: "DateTime_UTC",
    limit: String(limit),
  });

  const url = `https://lol.fandom.com/api.php?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "geng-cal/0.1 (contact: gengcal@example.com)" },
  });
  if (!res.ok) {
    throw new Error(`Leaguepedia error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as any;
  return (json?.cargoquery ?? []).map((x: any) => x.title) as CargoRow[];
}

/**
 * Map Cargo rows to UFCEvent structure expected by index.ts
 * - date -> ISO string in UTC with 'Z'
 * - name -> "Gen.G vs. Opponent" (or "Opponent vs. Gen.G")
 * - fightCard -> metadata lines (BestOf, Round, Time precision, Stream, Overview)
 * - url -> Overview wiki page URL
 */
export async function getGenGMatches(): Promise<UFCEvent[]> {
  const rows = await queryGenG(20);

  return rows.map((r) => {
    const t1 = decode(r.Team1 || "");
    const t2 = decode(r.Team2 || "");
    const isGenGHome = t1 === "Gen.G";
    const opponent = isGenGHome ? t2 : t1;

    const bestOf = r.BestOf ? Number(r.BestOf) : undefined;
    const round = r.Round ? String(r.Round) : undefined;
    const hasExact =
      r.HasTime === true || r.HasTime === 1 || r.HasTime === "1";

    // Leaguepedia DateTime_UTC is naive UTC; append Z to force ISO UTC parsing.
    const isoUtc = `${r["DateTime UTC"]}Z`;

    // Build canonical wiki URL for the OverviewPage
    const page = (r.OverviewPage || "").replace(/\s/g, "_");
    const wikiUrl = new URL(`https://lol.fandom.com/wiki/${encodeURI(page)}`);

    const metaLines = [
      bestOf ? `Best of ${bestOf}` : null,
      round ? `Round: ${round}` : null,
      hasExact ? "Time: exact" : "Time: date only (TBD)",
      r.Stream ? `Stream: ${r.Stream}` : null,
      `Overview: ${wikiUrl.href}`,
    ].filter(Boolean) as string[];

    const name = isGenGHome ? `Gen.G vs. ${opponent}` : `${opponent} vs. Gen.G`;

    const ev: UFCEvent = {
      name,
      url: wikiUrl,
      date: isoUtc,
      location: "",
      fightCard: metaLines,
      mainCard: [],
      prelims: [],
      earlyPrelims: [],
      prelimsTime: undefined,
      earlyPrelimsTime: undefined,
    };

    return ev;
  });
}
