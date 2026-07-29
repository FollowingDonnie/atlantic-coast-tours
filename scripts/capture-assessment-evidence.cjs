const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const LIVE_URL =
  "https://followingdonnie.github.io/atlantic-coast-tours/";
const SHEET_EVIDENCE_URL =
  "https://docs.google.com/spreadsheets/d/1balBGf8QhZ5dc-RCCAPt2kcrcf6m_YRh0HL_r8bBtJw/gviz/tq?tqx=out:html&gid=120683740&tq=select%20*%20where%20A%3D%27ACT012%27%20or%20A%3D%27ACT017%27%20or%20A%3D%27ACT021%27";
const outputDir =
  process.env.EVIDENCE_DIR ||
  path.join(__dirname, "..", "visual-qa", "assessment");

const probes = [
  {
    filename: "01-off-topic-pizza.png",
    question: "Can I order a pepperoni pizza from the top of Croagh Patrick?"
  },
  {
    filename: "02-budget-judgement.png",
    question:
      "I have half a day, a budget of EUR 50, and I would rather not go on a boat. What would you suggest?"
  },
  {
    filename: "03-wildlife-judgement.png",
    question:
      "Which tour would suit someone interested in wildlife who dislikes boats?"
  },
  {
    filename: "04-special-offers.png",
    question: "Which tours currently have special offers, and what do they cost?"
  },
  {
    filename: "05-zero-availability.png",
    question: "Does the Sea Cave Kayaking at Kilkee have spaces this week?"
  },
  {
    filename: "06-implausible-price.png",
    question: "How much is the Aran Islands Sunset Boat Cruise?"
  },
  {
    filename: "07-combined-live-tools.png",
    question:
      "Does the Connemara National Park Hike have spaces, and what will the weather be there tomorrow?"
  }
];

const selectedProbes = process.env.PROBE_FILTER
  ? probes.filter((probe) => probe.filename.includes(process.env.PROBE_FILTER))
  : probes;

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });
  const results = [];

  for (const probe of selectedProbes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
    await page.goto(LIVE_URL, { waitUntil: "networkidle" });
    await page.locator("#message").fill(probe.question);
    await page.locator("#send-button").click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          ".assistant-message:not(.typing-message)"
        ).length >= 2,
      { timeout: 180_000 }
    );

    const result = await page
      .locator(".assistant-message:not(.typing-message)")
      .last()
      .evaluate((element) => ({
        reply: element.querySelector(".message-bubble")?.textContent,
        evidence: element.querySelector(".evidence")?.textContent || "",
        hasError: element.classList.contains("error-message")
      }));

    await page.addStyleTag({
      content:
        ".chat-panel{display:block!important;min-height:0!important}" +
        ".conversation{height:auto!important;overflow:visible!important}" +
        ".composer,.suggestions{display:none!important}"
    });

    await page.locator(".chat-panel").screenshot({
      path: path.join(outputDir, probe.filename)
    });
    results.push({ ...probe, ...result });
    await page.close();
  }

  const sheet = await browser.newPage({ viewport: { width: 1600, height: 700 } });
  await sheet.goto(SHEET_EVIDENCE_URL, { waitUntil: "networkidle" });
  await sheet.addStyleTag({
    content:
      "body{font-family:Arial,sans-serif;padding:20px;background:#fff}table{border-collapse:collapse;font-size:15px}th,td{padding:9px 11px;border:1px solid #9aa7a3;white-space:nowrap}th{background:#0b605b;color:#fff}"
  });
  await sheet.screenshot({
    path: path.join(outputDir, "08-live-sheet-trap-rows.png"),
    fullPage: true
  });
  await sheet.close();

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
