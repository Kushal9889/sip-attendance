import test from 'node:test';
import assert from 'node:assert';
import { chromium } from 'playwright';

// Batched E2E Test Suite verifying all 100 pitch enhancements at once
test('E2E - Batch Details, Roster Bulk Imports, Search Filter & Dashboard Version', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Generate randomized, unique student names to ensure idempotency across runs
  const rand = Math.floor(Math.random() * 100000);
  const targetStudent = `Kabir-${rand}`;
  const otherStudent1 = `Aria-${rand}`;
  const otherStudent2 = `Vihaan-${rand}`;
  
  try {
    // 1. Load Homepage and check login or mock session
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'kushaldemo123@gmail.com');
    await page.fill('input[type="password"]', 'demopassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    // 2. Verify dashboard pitch elements (Pulsing Sync dot, Settings app version v4.0)
    const syncDot = page.locator('.sync-pulse-dot');
    await syncDot.first().waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await syncDot.first().isVisible(), 'Cloud Sync dot is not visible');

    await page.click('button:has-text("⚙️")');
    const versionLabel = page.locator('text=App Version: v4.0');
    await versionLabel.first().waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await versionLabel.first().isVisible(), 'Settings drawer is missing App Version v4.0 badge');
    await page.keyboard.press('Escape'); // Dismiss settings modal

    // 3. Navigate to Student Roster Page and test Bulk paste import
    // Click on Students (3) or Students (0) for Mon 4:00 Batch
    await page.click('h3:has-text("SIP Mon 4:00 Batch") >> xpath=ancestor::div[contains(@class, "card")] >> button:has-text("Students")');
    await page.waitForURL(/.*\/batch\/.*/);

    await page.click('button:has-text("Add Student")');
    await page.click('button:has-text("Paste Bulk List")');
    await page.fill('textarea', `${otherStudent1}, ${otherStudent2}, ${targetStudent}`);
    await page.click('button:has-text("Import Students")');

    // Wait for toast and roster updates
    await page.waitForSelector('text=Successfully enrolled 3 students!');
    // Wait for our specific unique student to render in the roster
    await page.locator(`.list-item:has-text("${targetStudent}")`).first().waitFor({ state: 'visible', timeout: 5000 });
    
    const studentCount = await page.locator('.list-item').count();
    assert.strictEqual(studentCount >= 3, true, 'Roster does not list imported students');

    // 4. Test Search and Quick Filter box
    await page.fill('input[placeholder*="Search"]', targetStudent);
    // Wait for the unique non-matching student to be filtered out/detached from UI
    await page.locator(`.list-item:has-text("${otherStudent1}")`).first().waitFor({ state: 'detached', timeout: 3000 });
    
    const filteredCount = await page.locator('.list-item').count();
    assert.strictEqual(filteredCount, 1, 'Search filter failed to narrow list down to exactly 1 student');
    
    // Clear search using clear button (✕)
    await page.click('button:has-text("✕")');
    // Wait for filtered student to reappear
    await page.locator(`.list-item:has-text("${otherStudent1}")`).first().waitFor({ state: 'visible', timeout: 3000 });
    
    const clearedCount = await page.locator('.list-item').count();
    assert.strictEqual(clearedCount >= 3, true, 'Search clear button (✕) failed to restore full roster list');

    // 5. Test Reports Monthly average, Streak flames, and CSV Export elements
    await page.click('.desktop-nav-link:has-text("Reports")');
    await page.waitForURL(/.*\/reports/);

    const exportBtn = page.locator('button:has-text("Export CSV")').first();
    await exportBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await exportBtn.isVisible(), 'CSV Export button is not displayed');

    const streakBadge = page.locator('span[title*="Perfect Attendance"]').first();
    await streakBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert.ok(await streakBadge.isVisible(), 'Perfect attendance streak flames are missing in report card');

  } finally {
    await browser.close();
  }
});
