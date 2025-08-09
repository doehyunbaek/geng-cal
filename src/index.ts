import { getGenGMatches, type UFCEvent } from "./scrape.js";
import * as fs from "fs";
import { createEvents, type DateArray, type EventAttributes } from "ics";

/**
 * Pull upcoming Gen.G (LoL) matches via Leaguepedia Cargo API
 * and write them to GenG.ics in the repo root.
 */
async function createICS() {
  try {
    const events = await getGenGMatches();
    if (!events?.length) throw new Error("No events retrieved");

    const formattedEvents = events.map(formatEventForCalendar);

    console.log("\nDetailed events:");
    console.log(formattedEvents);

    // Create GenG.ics
    const { value } = createEvents(formattedEvents);
    if (value) fs.writeFileSync("GenG.ics", value);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

function formatEventForCalendar(event: UFCEvent): EventAttributes {
  // event.date is an ISO UTC string (ends with Z)
  const date = new Date(event.date);
  const start: DateArray = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];

  const title = event.name;
  let description = "";

  // For LoL: include metadata lines (BestOf / Round / Stream / Overview)
  if (event.fightCard.length) {
    description = `${event.fightCard.join("\n")}\n`;
  }

  // Append source URL
  if (description.length) description += "\n";
  description += `${event.url}`;

  // Stamp when this was generated (Berlin)
  const dateTimestr = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "Europe/Berlin",
    timeZoneName: "short",
  });
  description += `\n\nAccurate as of ${dateTimestr}`;

  const location = event.location;
  const uid = event.url.href;
  const calName = "Gen.G (LoL)";

  const calendarEvent: EventAttributes = {
    start,
    title,
    description,
    uid,
    calName,
    location,
    productId: "adamgibbons/ics",
  };

  return calendarEvent;
}

createICS();
