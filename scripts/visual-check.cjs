const { chromium } = require("playwright");
const path = require("node:path");

(async () => {
  const outputDir = path.join(__dirname, "..", "visual-qa");
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await desktop.goto("http://localhost:5174", { waitUntil: "networkidle" });
  await desktop.screenshot({
    path: path.join(outputDir, "desktop.png"),
    fullPage: true
  });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  await mobile.goto("http://localhost:5174", { waitUntil: "networkidle" });
  await mobile.screenshot({
    path: path.join(outputDir, "mobile.png"),
    fullPage: true
  });

  const checks = await Promise.all(
    [desktop, mobile].map((page) =>
      page.evaluate(() => {
        const overflowing = [...document.querySelectorAll("body *")]
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1
          )
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            width: [element.clientWidth, element.scrollWidth],
            height: [element.clientHeight, element.scrollHeight]
          }))
          .filter(
            (item) =>
              !String(item.className).includes("conversation") &&
              !String(item.className).includes("suggestions") &&
              !String(item.className).includes("textarea")
          );

        return {
          viewport: [innerWidth, innerHeight],
          body: [document.body.scrollWidth, document.body.scrollHeight],
          overflowing
        };
      })
    )
  );

  console.log(JSON.stringify(checks, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
