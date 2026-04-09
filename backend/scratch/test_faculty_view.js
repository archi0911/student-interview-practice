const supabase = require('../supabaseClient');

async function testAsFaculty() {
  const isFaculty = true; // Mocking the role check
  
  console.log('--- Testing /stats ---');
  let sessionQuery = supabase.from('interview_sessions').select('is_verified, overall_score, mode');
  if (isFaculty) {
    sessionQuery = sessionQuery.in('mode', ['topic', 'role']);
  }
  const { data: statsSessions } = await sessionQuery;
  const pending = statsSessions.filter(s => !s.is_verified).length;
  console.log('Pending count for faculty:', pending);
  console.log('Modes found in stats:', [...new Set(statsSessions.map(s => s.mode))]);

  console.log('\n--- Testing /sessions/pending ---');
  let pendingQuery = supabase.from('interview_sessions').select('*').eq('is_verified', false);
  if (isFaculty) {
    pendingQuery = pendingQuery.in('mode', ['topic', 'role']);
  }
  const { data: pendingSessions } = await pendingQuery;
  console.log('Pending sessions count:', pendingSessions.length);
  console.log('Modes found in pending:', [...new Set(pendingSessions.map(s => s.mode))]);

  console.log('\n--- Testing /users sessions filtering ---');
  let usersSessionQuery = supabase.from('interview_sessions').select('user_id, id, mode');
  if (isFaculty) {
    usersSessionQuery = usersSessionQuery.in('mode', ['topic', 'role']);
  }
  const { data: usersSessions } = await usersSessionQuery;
  console.log('Total sessions for faculty:', usersSessions.length);
  console.log('Modes found in users sessions:', [...new Set(usersSessions.map(s => s.mode))]);
}

testAsFaculty();
