/**
 * Migration Script: Populate key_points in Supabase question_bank
 * 
 * Reads questions from both local JSON files and updates ALL rows
 * in question_bank with matching key_points (paginated, no row limit).
 * 
 * Run: node scripts/migrateKeyPoints.js
 */

const supabase = require('../supabaseClient');
const path = require('path');

// ── Load both local JSON files ────────────────────────────────────────────────
const questionsData = require(path.join(__dirname, '../data/questions.json'));
const jobRoleData   = require(path.join(__dirname, '../data/jobRoleQuestions.json'));

// Merge both JSON arrays into one
const allLocalQuestions = [...questionsData, ...jobRoleData];

// Build a lookup map: question_text (lowercase trimmed) → key_points
const keyPointsMap = {};
for (const q of allLocalQuestions) {
  const text = (q.question || q.question_text || '').trim().toLowerCase();
  if (text && Array.isArray(q.key_points) && q.key_points.length > 0) {
    keyPointsMap[text] = q.key_points;
  }
}

const totalMapped = Object.keys(keyPointsMap).length;
console.log(`\n📚 Loaded ${allLocalQuestions.length} local questions.`);
console.log(`🔑 Found ${totalMapped} questions with key_points.\n`);

// ── Helper: Fetch ALL rows with pagination ────────────────────────────────────
async function fetchAllRows() {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('question_bank')
      .select('id, question_text, key_points')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    console.log(`  📄 Fetched rows ${from + 1} – ${from + data.length}...`);

    if (data.length < PAGE_SIZE) break; // last page
    from += PAGE_SIZE;
  }

  return allRows;
}

// ── Main Migration ────────────────────────────────────────────────────────────
async function migrate() {
  // 1. Fetch ALL rows using pagination
  console.log('⬇️  Fetching ALL rows from Supabase question_bank (paginated)...');
  let bankRows;
  try {
    bankRows = await fetchAllRows();
  } catch (err) {
    console.error('❌ Failed to fetch question_bank:', err.message);
    process.exit(1);
  }
  console.log(`\n✅ Total rows fetched: ${bankRows.length}\n`);

  // 2. Find rows with missing/empty key_points that CAN be matched
  const toUpdate = bankRows.filter(row => {
    const missing = !row.key_points || row.key_points.length === 0;
    const matchKey = (row.question_text || '').trim().toLowerCase();
    return missing && keyPointsMap[matchKey];
  });

  // Also find rows that HAVE key_points but maybe outdated — skip them for safety
  // Only update truly missing ones
  console.log(`🔍 Rows with missing key_points that have a local match: ${toUpdate.length}`);

  // 3. Report rows with missing key_points that CAN'T be matched
  const unmatched = bankRows.filter(row => {
    const missing = !row.key_points || row.key_points.length === 0;
    const matchKey = (row.question_text || '').trim().toLowerCase();
    return missing && !keyPointsMap[matchKey];
  });
  console.log(`⚠️  Rows with missing key_points but NO local match: ${unmatched.length}\n`);

  if (toUpdate.length === 0) {
    console.log('🎉 No rows need updating!');
    if (unmatched.length > 0) {
      console.log(`\n⚠️  These ${unmatched.length} rows still have empty key_points (no local match):`);
      unmatched.forEach(r => console.log(`   - "${(r.question_text || '').slice(0, 80)}"`));
    }
    process.exit(0);
  }

  // 4. Update in batches of 50 to avoid overwhelming Supabase
  const BATCH_SIZE = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);

    const updatePromises = batch.map(async (row) => {
      const matchKey = row.question_text.trim().toLowerCase();
      const kp = keyPointsMap[matchKey];
      const { error } = await supabase
        .from('question_bank')
        .update({ key_points: kp })
        .eq('id', row.id);

      if (error) {
        console.error(`  ❌ Failed: "${(row.question_text || '').slice(0, 50)}" → ${error.message}`);
        failCount++;
      } else {
        successCount++;
      }
    });

    await Promise.all(updatePromises);

    const processed = Math.min(i + BATCH_SIZE, toUpdate.length);
    console.log(`  ⏳ Updated ${processed} / ${toUpdate.length} rows...`);
  }

  // ── Final Summary ─────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log(`✅ Successfully updated : ${successCount} rows`);
  if (failCount > 0) {
    console.log(`❌ Failed to update    : ${failCount} rows`);
  }

  if (unmatched.length > 0) {
    console.log(`\n⚠️  ${unmatched.length} rows still have empty key_points (no local question matched):`);
    unmatched.forEach(r => console.log(`   - "${(r.question_text || '').slice(0, 80)}"`));
  }

  console.log('\n🎉 Migration complete!\n');
}

migrate().catch(err => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
