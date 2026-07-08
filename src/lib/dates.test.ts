import test from 'node:test';
import assert from 'node:assert';
import { displayDate, shortDate, getDayNumber, getMonthKey, getDaysInMonth, getFirstDayOfWeek, isFutureDate } from './dates';

test('Dates Library - displayDate and shortDate formatting (timezone pinned)', () => {
  // Test 1: displayDate conversion with IST timezone pinning
  const display = displayDate('2026-07-04');
  assert.match(display, /Saturday/);
  assert.match(display, /4/);
  assert.match(display, /July/);
  assert.match(display, /2026/);

  // Test 2: shortDate formatting
  const short = shortDate('2026-07-04');
  assert.match(short, /4/);
  assert.match(short, /Jul/);
});

test('Dates Library - Numeric extraction and offsets', () => {
  // Test 3: getDayNumber extraction
  assert.strictEqual(getDayNumber('2026-07-04'), 4);
  assert.strictEqual(getDayNumber('2026-07-15'), 15);

  // Test 4: getFirstDayOfWeek for July 2026 (July 1st is Wednesday -> index 3)
  assert.strictEqual(getFirstDayOfWeek('2026-07'), 3);
});

test('Dates Library - Month generation and future bounds', () => {
  // Test 5: getDaysInMonth count for July 2026 (31 days)
  const days = getDaysInMonth('2026-07');
  assert.strictEqual(days.length, 31);
  assert.strictEqual(days[0], '2026-07-01');
  assert.strictEqual(days[30], '2026-07-31');

  // Test 6: getMonthKey shifting (0 = current month)
  const keyCurrent = getMonthKey(0);
  const now = new Date();
  const expectedKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  assert.strictEqual(keyCurrent, expectedKey);

  // Test 7: isFutureDate boundaries
  assert.strictEqual(isFutureDate('2020-01-01'), false);
  assert.strictEqual(isFutureDate('2050-12-31'), true);
});
