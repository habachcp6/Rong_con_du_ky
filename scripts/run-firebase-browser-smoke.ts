import { chromium } from "@playwright/test";

const baseUrl =
  process.env.FIREBASE_BROWSER_SMOKE_URL ?? "http://127.0.0.1:4174/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const browserErrors: string[] = [];
const firebaseResponses: Array<{ url: string; status: number }> = [];

page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes(":9099") || response.url().includes(":8080")) {
    firebaseResponses.push({ url: response.url(), status: response.status() });
  }
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
  const syncStatus = page.locator(".app-save-status");
  await syncStatus.waitFor({ state: "visible", timeout: 15_000 });

  let observedStatus = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    observedStatus = (await syncStatus.innerText()).trim();
    if (observedStatus === "Đã đồng bộ" || observedStatus === "Synced") break;
    await page.waitForTimeout(500);
  }

  const successfulAuth = firebaseResponses.some(
    (response) =>
      response.url.includes(":9099") &&
      response.status >= 200 &&
      response.status < 300,
  );
  const successfulFirestore = firebaseResponses.some(
    (response) =>
      response.url.includes(":8080") &&
      response.status >= 200 &&
      response.status < 300,
  );

  const evidence = {
    url: baseUrl,
    syncStatus: observedStatus,
    firebaseResponses: firebaseResponses.length,
    successfulAuth,
    successfulFirestore,
    browserErrors,
  };
  console.log(JSON.stringify(evidence));

  if (observedStatus !== "Đã đồng bộ" && observedStatus !== "Synced") {
    throw new Error(`Firebase sync did not become ready: ${observedStatus}`);
  }
  if (!successfulAuth || !successfulFirestore) {
    throw new Error(
      "Auth and Firestore emulator success responses were not observed",
    );
  }
  if (browserErrors.length > 0) {
    throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);
  }
} finally {
  await browser.close();
}
