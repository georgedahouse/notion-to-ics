const { Client } = require("@notionhq/client");
const ical = require("ical-generator");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Helpers
function getPlainTextFromTitleProp(prop) {
  if (!prop) return "";
  // Notion title property
  if (prop.type === "title" && Array.isArray(prop.title)) {
    return prop.title.map(t => t.plain_text).join("").trim();
  }
  // Notion rich_text property (kdybys někdy použil)
  if (prop.type === "rich_text" && Array.isArray(prop.rich_text)) {
    return prop.rich_text.map(t => t.plain_text).join("").trim();
  }
  return "";
}

function getSelectName(prop) {
  if (!prop) return "";
  if (prop.type === "select" && prop.select) return prop.select.name || "";
  if (prop.type === "status" && prop.status) return prop.status.name || "";
  return "";
}

function getNumber(prop) {
  if (!prop) return "";
  if (prop.type === "number" && typeof prop.number === "number") return String(prop.number);
  return "";
}

function getDateStart(prop) {
  if (!prop) return null;
  if (prop.type === "date" && prop.date && prop.date.start) return prop.date.start;
  return null;
}

async function queryAllPages(database_id) {
  const results = [];
  let cursor = undefined;

  do {
    const resp = await notion.databases.query({
      database_id,
      start_cursor: cursor
    });
    results.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  return results;
}

// =======================
// 1) NAVYKY FEED
// =======================
app.get("/navyky.ics", async (req, res) => {
  const databaseId = process.env.NOTION_NAVYKY_DATABASE_ID;
  const dateProperty = process.env.HABITS_DATE_PROPERTY || "Datum";
  const titleProperty = process.env.HABITS_TITLE_PROPERTY || "Návyk";

  if (!databaseId) {
    return res.status(500).send("Chybí NOTION_NAVYKY_DATABASE_ID ve Vercelu.");
  }

  const calendar = ical({ name: "Notion Návyky" });

  try {
    const pages = await queryAllPages(databaseId);

    for (const page of pages) {
      const props = page.properties || {};
      const titleObj = props[titleProperty];
      const dateObj = props[dateProperty];

      const title = getPlainTextFromTitleProp(titleObj);
      const start = getDateStart(dateObj);

      if (!title || !start) continue;

      const startDate = new Date(start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1); // all-day end exclusive

      calendar.createEvent({
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        summary: title,
        allDay: true
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    calendar.serve(res);
  } catch (err) {
    console.error("Chyba při generování návyků:", err);
    res.status(500).send("Chyba při generování návyků.");
  }
});

// =======================
// 2) MATURÁKY FEED (+ NOTES)
// =======================
app.get("/maturaky.ics", async (req, res) => {
  const databaseId = process.env.NOTION_MATURAKY_DATABASE_ID;

  // Tyhle názvy si nech, pokud máš přesně takhle v Notionu
  const titleProperty = process.env.MATURE_TITLE_PROPERTY || "Místo konání";
  const dateProperty = process.env.MATURE_DATE_PROPERTY || "Datum";

  // Notes fields (podle tvýho požadavku)
  const cityProperty = "Město";
  const variantProperty = "Varianta";
  const depositProperty = "Záloha";

  if (!databaseId) {
    return res.status(500).send("Chybí NOTION_MATURAKY_DATABASE_ID ve Vercelu.");
  }

  const calendar = ical({ name: "Maturitní plesy" });

  try {
    const pages = await queryAllPages(databaseId);

    for (const page of pages) {
      const props = page.properties || {};

      const title = getPlainTextFromTitleProp(props[titleProperty]);
      const start = getDateStart(props[dateProperty]);

      if (!title || !start) continue;

      const mesto = (props[cityProperty]?.type === "select" || props[cityProperty]?.type === "status")
        ? getSelectName(props[cityProperty])
        : getPlainTextFromTitleProp(props[cityProperty]);

      const varianta = getSelectName(props[variantProperty]) || getPlainTextFromTitleProp(props[variantProperty]);
      const zaloha = getSelectName(props[depositProperty]) || getPlainTextFromTitleProp(props[depositProperty]) || getNumber(props[depositProperty]);

      const descriptionLines = [
        `Místo konání: ${title || "-"}`,
        `Město: ${mesto || "-"}`,
        `Varianta: ${varianta || "-"}`,
        `Záloha: ${zaloha || "-"}`
      ];

      const startDate = new Date(start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      calendar.createEvent({
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        summary: `Maturitní ples – ${title}`,
        location: [title, mesto].filter(Boolean).join(", "),
        description: descriptionLines.join("\n"),
        allDay: true
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    calendar.serve(res);
  } catch (err) {
    console.error("Chyba při generování maturáků:", err);
    res.status(500).send("Chyba při generování maturáků.");
  }
});

// Root
app.get("/", (req, res) => {
  res.send("Notion → ICS běží. Feed: /navyky.ics a /maturaky.ics");
});

app.listen(port, () => {
  console.log(`Server běží na http://localhost:${port}`);
});
