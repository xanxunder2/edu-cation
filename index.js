// index.js
import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/result", async (req, res) => {
  try {
    const board = req.query.board;
    const roll = req.query.roll;
    const reg = req.query.reg;
    const year = req.query.year;

    if (!board || !roll || !reg || !year) {
      return res.status(400).json({
        error: "Missing required query params: board, roll, reg, year",
      });
    }

    const url = "https://www.educationboardresults.gov.bd/";

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // Select fields
    await page.select("select[name='exam']", "ssc"); // তুমি চাইলে dynamic করতে পারো
    await page.select("select[name='year']", year);
    await page.select("select[name='board']", board);

    await page.type("input[name='roll']", roll);
    await page.type("input[name='reg']", reg);

    await page.waitForTimeout(1000);

    // Submit Exam Form
    await page.click("input[type='submit']");
    await page.waitForSelector("table.black12", { timeout: 15000 });

    // Extract Data
    const data = await page.evaluate(() => {
      const getText = (label) => {
        const td = document.evaluate(
          `//td[normalize-space(text())="${label}"]/following-sibling::td[1]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
        return td ? td.innerText.trim() : "";
      };

      // Subject Table
      const tables = document.querySelectorAll("table.black12");
      let subjects = [];

      if (tables.length >= 2) {
        const rows = tables[1].querySelectorAll("tr");
        for (let i = 1; i < rows.length; i++) {
          const td = rows[i].querySelectorAll("td");
          if (td.length >= 3) {
            subjects.push({
              code: td[0].innerText.trim(),
              subject: td[1].innerText.trim(),
              grade: td[2].innerText.trim(),
            });
          }
        }
      }

      return {
        name: getText("Name"),
        gpa: getText("GPA"),
        result: getText("Result"),
        subjects,
      };
    });

    await browser.close();

    res.json({
      status: "success",
      board,
      roll,
      reg,
      year,
      data,
    });
  } catch (error) {
    console.error(error);
    res.json({
      status: "error",
      message: "Could not fetch result",
      error: error.toString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
