const { chromium } = require("playwright");
const path = require("node:path");

const LIVE_URL =
  "https://followingdonnie.github.io/atlantic-coast-tours/";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(LIVE_URL, { waitUntil: "networkidle" });
  await page.locator("#message").fill(
    "Does the Connemara National Park Hike have spaces, and what will the weather be there tomorrow?"
  );
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
      evidence: element.querySelector(".evidence")?.textContent,
      hasError: element.classList.contains("error-message")
    }));

  await page.screenshot({
    path: path.join(__dirname, "..", "visual-qa", "live-e2e.png"),
    fullPage: true
  });

  console.log(JSON.stringify({ url: LIVE_URL, ...result }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
