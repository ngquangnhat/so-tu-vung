import assert from 'node:assert';
import {
  calculateNextReview,
  BOX_INTERVALS_MS,
  BOX_INTERVALS_TEXT,
  isDueToday,
  normalizeAnswer,
  stripPatternPlaceholders,
  getPreviewIntervalText,
} from './srs.ts';
import { MASTERED_BOX_THRESHOLD, MAX_SPEECH_ATTEMPTS } from '../types/card.ts';

console.log('--- RUNNING ENHANCED SRS UNIT TESTS ---');

const baseDate = new Date(2026, 10, 19, 10, 0, 0);

// 1. Grade 'good' from Box 0 -> Box 1 (1 day)
{
  const res = calculateNextReview(0, 'good', baseDate);
  assert.strictEqual(res.nextBox, 1);
  const diffMs = res.nextDueDate.getTime() - baseDate.getTime();
  assert.strictEqual(diffMs, BOX_INTERVALS_MS[1]);
  console.log('✓ Test 1: calculateNextReview(0, good) passed');
}

// 2. Grade 'easy' from Box 0 -> Box 2 (3 days)
{
  const res = calculateNextReview(0, 'easy', baseDate);
  assert.strictEqual(res.nextBox, 2);
  const diffMs = res.nextDueDate.getTime() - baseDate.getTime();
  assert.strictEqual(diffMs, BOX_INTERVALS_MS[2]);
  console.log('✓ Test 2: calculateNextReview(0, easy) passed');
}

// 3. Grade 'forgot' from Box 4 -> Box 0 (10 mins)
{
  const res = calculateNextReview(4, 'forgot', baseDate);
  assert.strictEqual(res.nextBox, 0);
  const diffMs = res.nextDueDate.getTime() - baseDate.getTime();
  assert.strictEqual(diffMs, 10 * 60 * 1000);
  console.log('✓ Test 3: calculateNextReview(4, forgot) passed');
}

// 4. Grade 'hard' from Box 0 -> Box 0 (min 1 day)
{
  const res = calculateNextReview(0, 'hard', baseDate);
  assert.strictEqual(res.nextBox, 0);
  const diffMs = res.nextDueDate.getTime() - baseDate.getTime();
  assert.strictEqual(diffMs, BOX_INTERVALS_MS[1]);
  console.log('✓ Test 4: calculateNextReview(0, hard) passed');
}

// 5. Box capping at Box 5
{
  const resGood = calculateNextReview(5, 'good', baseDate);
  assert.strictEqual(resGood.nextBox, 5);

  const resEasy = calculateNextReview(4, 'easy', baseDate);
  assert.strictEqual(resEasy.nextBox, 5);
  console.log('✓ Test 5: Box capping at 5 passed');
}

// 6. isDueToday
{
  const todayMorning = new Date(2026, 10, 19, 8, 0, 0).toISOString();
  const todayNight = new Date(2026, 10, 19, 23, 58, 0).toISOString();
  const tomorrow = new Date(2026, 10, 20, 1, 0, 0).toISOString();

  assert.strictEqual(isDueToday(todayMorning, baseDate), true);
  assert.strictEqual(isDueToday(todayNight, baseDate), true);
  assert.strictEqual(isDueToday(tomorrow, baseDate), false);
  assert.strictEqual(isDueToday(''), false);
  console.log('✓ Test 6: isDueToday passed');
}

// 7. normalizeAnswer with hyphens & null guards
{
  assert.strictEqual(normalizeAnswer('  Act.  '), 'act');
  assert.strictEqual(normalizeAnswer('Give up!'), 'give up');
  assert.strictEqual(normalizeAnswer('ice-cream'), 'ice cream');
  assert.strictEqual(normalizeAnswer(null), '');
  assert.strictEqual(normalizeAnswer(undefined), '');
  console.log('✓ Test 7: normalizeAnswer with hyphens & null guards passed');
}

// 8. stripPatternPlaceholders
{
  assert.strictEqual(stripPatternPlaceholders('make sb do sth'), 'make  do');
  assert.strictEqual(stripPatternPlaceholders('give up'), 'give up');
  assert.strictEqual(stripPatternPlaceholders(''), '');
  console.log('✓ Test 8: stripPatternPlaceholders passed');
}

// 9. Constants verification
{
  assert.strictEqual(MASTERED_BOX_THRESHOLD, 4);
  assert.strictEqual(MAX_SPEECH_ATTEMPTS, 2);
  console.log('✓ Test 9: Constants verified');
}

console.log('--- ALL 9 SRS UNIT TESTS PASSED SUCCESSFULLY! ---');
