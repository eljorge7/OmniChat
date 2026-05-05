const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const outDir = 'C:\\Users\\jorge\\Documents\\Antigravity\\RentControl\\frontend\\public\\images\\demos';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function capture() {
  const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();

  // 3. OmniChat
  console.log("Capturing OmniChat...");
  await page.goto('http://localhost:3003/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.type('input[type="email"]', 'eljorge7@gmail.com');
  await page.type('input[type="password"]', 'R@diotec');
  await page.click('button[type="submit"]');
  await wait(4000);
  await page.screenshot({ path: path.join(outDir, 'omnichat_1.png') });

  await page.goto('http://localhost:3003/settings/ai');
  await wait(2000);
  await page.screenshot({ path: path.join(outDir, 'omnichat_2.png') });

  await page.goto('http://localhost:3003/contacts');
  await wait(2000);
  await page.screenshot({ path: path.join(outDir, 'omnichat_3.png') });

  await browser.close();
  console.log("All captured!");
}

capture().catch(console.error);
