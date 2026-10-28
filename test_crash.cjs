const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173');
  console.log('Page loaded');
  
  // Wait for the app to load and tokens to appear
  await page.waitForSelector('.momentum-table', { timeout: 10000 });
  
  console.log('App loaded, clicking a token...');
  // Click on the first token card/row in the UI
  await page.evaluate(() => {
    const row = document.querySelector('.momentum-table > div > div'); // Find first token
    if (row) row.click();
  });
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  process.exit(0);
})();
