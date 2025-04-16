// 🌱 Notion → iCal .ics generator
// Ready-to-deploy on Vercel (Node.js + Express + ical-generator)

const express = require("express");
const { Client } = require("@notionhq/client");
const ical = require("ical-generator");
require("dotenv").config();

const app = express();
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

app.get("/calendar.ics", async (req, res) => {
  const calendar = ical({ name: "Notion Habits" });

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });

    response.results.forEach((page) => {
      const props = page.properties;

      const nameProp = props["Návyk"];
      const dateProp = props["Tento týden"];

      const title = nameProp?.title?.[0]?.plain_text ?? "Návyk";

      if (dateProp?.date?.start) {
        calendar.createEvent({
          start: new Date(dateProp.date.start),
          end: new Date(dateProp.date.start),
          summary: title,
          uid: page.id,
        });
      }
    });

    res.setHeader("Content-Type", "text/calendar");
    calendar.serve(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Chyba při generování kalendáře.");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Running on http://localhost:${port}`);
});
