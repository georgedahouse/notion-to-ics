const { Client } = require("@notionhq/client");
const ical = require("ical-generator");
const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ---- helpers ----
function getTitle(props, name) {
  const p = props?.[name];
  if (!p) return "";
  if (p.type === "title") return (p.title?.[0]?.plain_text || "").trim();
  if (p.type === "rich_text") return (p.rich_text?.[0]?.plain_text || "").trim();
  return "";
}

function getText(props, name) {
  const p = props?.[name];
  if (!p) return "";
  if (p.type === "rich_text") return (p.rich_text?.[0]?.plain_text || "").trim();
  if (p.type === "title") return (p.title?.[0]?.plain_text || "").trim();
  if (p.type === "select") return (p.select?.name || "").trim();
  if (p.type === "multi_select") return (p.multi_select?.map((x) => x.name).join(", ") || "").trim();
  return "";
}

function getNumber(props, name) {
  const p = props?.[name];
  if (!p) return null;
  if (p.type === "number") return p.number;
  return null;
}

function getDateStart(props, name) {
  const p = props?.[name];
  if (!p) return null;
  if (p.type === "date" && p.date?.start) return p.date.start;
  return null;
}

function formatCZK(n) {
  if (n === null || n === undefined) return "";
  try {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} CZK`;
  }
}

// ---- NAVYKY ----
app.get("/navyky.ics", async (req, res) => {
  const calendar = ical({ name: "Notion Návyky" });

  try {
    const databaseId =
      process.env.NOTION_NAVYKY_DATABASE_ID || process.env.NOTION_DATABASE_ID;
    const dateProperty = process.env.DATE_PROPERTY_NAME || "Datum";
    const titleProperty = process.env.TITLE_PROPERTY_NAME || "Návyk";

    if (!databaseId) {
      return res.status(500).send("Chybí env var: NOTION_NAVYKY_DATABASE_ID (nebo NOTION_DATABASE_ID)");
    }

    const response = await notion.databases.query({ database_id: databaseId });

    for (const page of response.results) {
      const props = page.properties;

      const title = getTitle(props, titleProperty);
      const start = getDateStart(props, dateProperty);
      if (!title || !start) continue;

      const startDate = new Date(start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      calendar.createEvent({
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        summary: title,
        allDay: true,
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    calendar.serve(res);
  } catch (error) {
    console.error("Chyba při generování návyků:", error);
    res.status(500).send("Chyba při generování návyků.");
  }
});

// ---- MATURAKY ----
app.get("/maturaky.ics", async (req, res) => {
  const calendar = ical({ name: "Notion Maturáky" });

  try {
    const databaseId = process.env.NOTION_MATURAKY_DATABASE_ID;
    if (!databaseId) {
      return res.status(500).send("Chybí env var: NOTION_MATURAKY_DATABASE_ID");
    }

    // názvy properties v Notion DB "Maturitní plesy" (podle tvého screenu)
    const dateProp = "Datum";
    const titleProp = "Místo konání"; // je to title sloupec (první)
    const mestoProp = "Město";
    const variantaProp = "Varianta";
    const zalohaProp = "Záloha";

    const response = await notion.databases.query({ database_id: databaseId });

    for (const page of response.results) {
      const props = page.properties;

      const start = getDateStart(props, dateProp);
      if (!start) continue;

      const title = getTitle(props, titleProp) || "Maturák";

      const mesto = getText(props, mestoProp);
      const varianta = getText(props, variantaProp);
      const zaloha = getText(props, zalohaProp);

      const descriptionLines = [];
      if (title) descriptionLines.push(`Místo konání: ${title}`);
      if (mesto) descriptionLines.push(`Město: ${mesto}`);
      if (varianta) descriptionLines.push(`Varianta: ${varianta}`);
      if (zaloha) descriptionLines.push(`Záloha: ${zaloha}`);

      const startDate = new Date(start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      calendar.createEvent({
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        summary: title,
        description: descriptionLines.join("\n"),
        allDay: true,
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    calendar.serve(res);
  } catch (error) {
    console.error("Chyba při generování maturáků:", error);
    res.status(500).send("Chyba při generování maturáků.");
  }
});

// ---- HRANI ----
app.get("/hrani.ics", async (req, res) => {
  const calendar = ical({ name: "Notion Hraní" });

  try {
    const databaseId = process.env.NOTION_HRANI_DATABASE_ID;
    if (!databaseId) {
      return res.status(500).send("Chybí env var: NOTION_HRANI_DATABASE_ID");
    }

    // názvy properties v Notion DB "Hraní"
    const dateProp = "Datum";
    const klubProp = "Klub";
    const mestoProp = "Město";
    const poznamkaProp = "Poznámka";

    const response = await notion.databases.query({ database_id: databaseId });

    for (const page of response.results) {
      const props = page.properties;

      const start = getDateStart(props, dateProp);
      if (!start) continue;

      const klub = getText(props, klubProp);
      const mesto = getText(props, mestoProp);

      // Title: "Klub - Město"
      const summary = [klub, mesto].filter(Boolean).join(" - ") || "Hraní";

      // Description: jen Poznámka
      const poznamka = getText(props, poznamkaProp);
      const description = poznamka ? `Poznámka: ${poznamka}` : "";

      const startDate = new Date(start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      calendar.createEvent({
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        summary,
        description,
        allDay: true,
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    calendar.serve(res);
  } catch (error) {
    console.error("Chyba při generování hraní:", error);
    res.status(500).send("Chyba při generování hraní.");
  }
});

app.get("/", (req, res) => {
  res.send("Notion to ICS běží. /navyky.ics | /maturaky.ics | /hrani.ics");
});

app.listen(port, () => {
  console.log(`Server běží na http://localhost:${port}`);
});
