const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 420, height: 850 }
  });

  const page = await browser.newPage();
  
  await page.evaluateOnNewDocument(() => {
    const adminUser = {
      id: 'efe1bee5-f9df-46ce-83b6-50127a2334bd',
      email: 'minhkhang12042006@gmail.com',
      fullName: 'Minh Khang',
      username: 'minhkhang'
    };
    localStorage.setItem('auth_user', JSON.stringify(adminUser));
    localStorage.setItem('token', 'fake-jwt-token-for-testing');
  });

  console.log('Navigating to chat...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 6000));

  // Click on Quản trị viên Admin conversation
  await page.evaluate(() => {
    const el = document.querySelector('flt-glass-pane') || document.body;
    // Dispatch click to open conversation
  });

  // Click at (200, 390) which is Quản trị viên Admin in sidebar
  await page.mouse.click(200, 390);
  await new Promise(r => setTimeout(r, 4000));

  const shotPath = path.join(__dirname, 'admin_chat_verified.png');
  await page.screenshot({ path: shotPath });
  console.log(`Saved screenshot to ${shotPath}`);

  await browser.close();
}

run().catch(console.error);
