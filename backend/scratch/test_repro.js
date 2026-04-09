
const supabase = require('../supabaseClient');

async function verifyConstraint() {
  const dummySessionId = '3320c6bc-b945-4634-8169-1a99b8ceb085'; // From previous successful insert
  
  console.log('--- Test 1: Lowercase difficulty (should fail) ---');
  const { error: error1 } = await supabase
    .from('responses')
    .insert({
      session_id: dummySessionId,
      question_text: 'Test?',
      difficulty: 'easy'
    });
  
  if (error1) {
    console.log('Expected failure occurred:', error1.message);
  } else {
    console.warn('Unexpected success with lowercase difficulty!');
  }

  console.log('\n--- Test 2: Uppercase difficulty (should succeed) ---');
  const { data, error: error2 } = await supabase
    .from('responses')
    .insert({
      session_id: dummySessionId,
      question_text: 'Test Uppercase?',
      difficulty: 'Easy'
    })
    .select('id')
    .single();

  if (error2) {
    console.error('Unexpected failure with uppercase difficulty:', error2);
  } else {
    console.log('Success with uppercase difficulty! ID:', data.id);
  }
}

verifyConstraint();
