const { Client } = require("@notionhq/client");
const ical = require("ical-generator");
const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

/* =========================
   ======= NÁVYKY ==========
   ========================= */

const navykyDbId =
  process.env.NOTION_DATABASE_ID ||
  process.env.NOTION_NAVYKY_DATABASE_ID;

const dateProperty = process.env.DATE_PROPERTY_NAME || "Datum";
const titleProperty = process.env.TITLE_PROPERTY_NAME || "Návyk";

app.get("/navyky.ics", async (req, res) => {
  const calendar = ical({ name: "Notion Habits" });

  try {
    const response = await notion.databases.query({
      database_id: navykyDbId,
    });

    for (const page of response.results) {
      const properties = page.properties;

      const titleObj = properties[titleProperty];
      const dateObj = properties[dateProperty];

      if (
        titleObj &&
        titleObj.type === "title" &&
        titleObj.title.length > 0 &&
        dateObj &&
        dateObj.type === "date" &&
        dateObj.date &&
        dateObj.date.start
      ) {
        const startDate = new Date(dateObj.date.start);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);

        calendar.createEvent({
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
          summary: titleObj.title[0].plain_text,
          allDay: true,
        });
      }
    }

    res.setHeader("Content-Type", "text/calendar");
    calendar.serve(res);
  } catch (error) {
    console.error("Chyba při generování návyků:", error);
    res.status(500).send("Chyba při generování kalendáře.");
  }
});

/* =========================
   ====== MATURÁKY =========
   ========================= */

const maturakyDbId = process.env.NOTION_MATURAKY_DATABASE_ID;

const matDateProp = process.env.MAT_DATE_PROPERTY_NAME || "Datum";
const matTitleProp =
  process.env.MAT_TITLE_PROPERTY_NAME || "Místo konání";
const matCityProp = process.env.MAT_CITY_PROPERTY_NAME || "Město";
const matDepositProp =
  process.env.MAT_DEPOSIT_PROPERTY_NAME || "Záloha";
const matVariantProp =
  process.env.MAT_VARIANT_PROPERTY_NAME || "Varianta";

function getText(prop) {
  if (!prop) return "";
  if (prop.type === "title")
    return (prop.title || []).map((t) => t.plain_text).join("");
  if (prop.type === "rich_text")
    return (prop.rich_text || []).map((t) => t.plain_text).join("");
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "multi_select")
    return (prop.multi_select || []).map((s) => s.name).join(", ");
  return "";
}

app.get("/maturaky.ics", async (req, res) => {
  const calendar = ical({ name: "Maturitní plesy" });

  try {
    if (!maturakyDbId)
      return res
        .status(500)
        .send("Chybí NOTION_MATURAKY_DATABASE_ID");

    const response = await notion.databases.query({
      database_id: maturakyDbId,
      sorts: [{ property: matDateProp, direction: "ascending" }],
    });

    for (const page of response.results) {
      const p = page.properties;

      const dateObj = p[matDateProp];
      if (
        !dateObj ||
        dateObj.type !== "date" ||
        !dateObj.date?.start
      )
        continue;

      const startDate = new Date(dateObj.date.start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const misto = getText(p[matTitleProp]) || "Maturitní ples";
      const mesto = getText(p[matCityProp]);
      const varianta = getText(p[matVariantProp]);
      const zaloha = getText(p[matDepositProp]);

      const summary = misto;

      const description = [
        misto ? `Místo konání: ${misto}` : "",
        mesto ? `Město: ${mesto}` : "",
        varianta ? `Varianta: ${varianta}` : "",
        zaloha ? `Záloha: ${zaloha}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      calendar.createEvent({
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        summary,
        description,
        location: [misto, mesto]
          .filter(Boolean)
          .join(", "),
        allDay: true,
      });
    }

    res.setHeader("Content-Type", "text/calendar");
    calendar.serve(res);
  } catch (error) {
    console.error("Chyba při generování maturáků:", error);
    res.status(500).send("Chyba při generování maturáků.");
  }
});

/* ========================= */

app.get("/", (req, res) => {
  res.send(
    "Notion to ICS běží. /navyky.ics = návyky, /maturaky.ics = maturáky"
  );
});

app.listen(port, () => {
  console.log(`Server běží na http://localhost:${port}`);
});
