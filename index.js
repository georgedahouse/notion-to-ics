const { Client } = require("@notionhq/client");
const ical = require("ical-generator");
const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;
const dateProperty = process.env.DATE_PROPERTY_NAME || "Datum";
const titleProperty = process.env.TITLE_PROPERTY_NAME || "Návyk";

app.get("/calendar.ics", async (req, res) => {
    const calendar = ical({ name: "Notion Habits" });

    try {
        const response = await notion.databases.query({ database_id: databaseId });

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
                calendar.createEvent({
                    start: new Date(dateObj.date.start),
                    end: new Date(dateObj.date.start),
                    summary: titleObj.title[0].plain_text,
                });
            }
        }

        res.setHeader("Content-Type", "text/calendar");
        calendar.serve(res);
    } catch (error) {
        console.error("Chyba při generování kalendáře:", error);
        res.status(500).send("Chyba při generování kalendáře.");
    }
});

app.get("/", (req, res) => {
    res.send("Notion to ICS běží. Přidej /calendar.ics pro export.");
});

app.listen(port, () => {
    console.log(`Server běží na http://localhost:${port}`);
});
