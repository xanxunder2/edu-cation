const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

// Route: /result?board=dhaka&roll=123456&reg=789101&year=2023
app.get("/result", async (req, res) => {
  try {
    const board = req.query.board?.toLowerCase();
    const roll = req.query.roll;
    const reg = req.query.reg;
    const year = req.query.year;

    if (!board || !roll || !reg || !year) {
      return res.status(400).json({
        status: "error",
        message: "Missing required query params: board, roll, reg, year"
      });
    }

    const validBoards = [
      "barisal","chittagong","comilla","dhaka","dinajpur",
      "jessore","mymensingh","rajshahi","sylhet",
      "madrasah","tec","dibs"
    ];

    if (!validBoards.includes(board)) {
      return res.status(400).json({ status: "error", message: "Invalid board" });
    }

    // Puppeteer launch
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox","--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto("https://www.educationboardresults.gov.bd/", { waitUntil: "networkidle2" });

    await page.select("select[name='exam']", "ssc");
    await page.select("select[name='year']", year);
    await page.select("select[name='board']", board);
    await page.type("input[name='roll']", roll);
    await page.type("input[name='reg']", reg);

    await page.waitForTimeout(1500);

    await page.click("input[type='submit']");
    await page.waitForSelector("table.black12", { timeout: 15000 });

    const data = await page.evaluate(() => {
      const getText = (label) => {
        const td = document.evaluate(
          `//td[normalize-space(text())="${label}"]/following-sibling::td[1]`,
          document,
          null,
          XPathResult.FIRST_ORDER_NODE_TYPE,
          null
        ).singleNodeValue;
        return td ? td.innerText.trim() : "";
      };

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
              grade: td[2].innerText.trim()
            });
          }
        }
      }

      return {
        name: getText("Name"),
        gpa: getText("GPA"),
        result: getText("Result"),
        subjects
      };
    });

    await browser.close();

    res.json({
      status: "success",
      board,
      roll,
      reg,
      year,
      data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status:"error", message:"Could not fetch result", error: err.toString() });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
