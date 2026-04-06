const supabase = require('./supabaseClient');

async function testInsert() {
  console.log('🧪 Inserting a test question into question_bank...');
  
  const testQuestion = {
    question_text: "What is the capital of France?",
    ideal_answer: "Paris",
    key_points: ["Paris", "Europe", "City"],
    difficulty: "Easy",
    category: "general"
  };

  const { data, error } = await supabase
    .from('question_bank')
    .upsert(testQuestion, { onConflict: 'question_text' });

  if (error) {
    console.error('❌ Failed to insert test question:', error.message);
  } else {
    console.log('✅ Test question inserted successfully!');
  }
}

testInsert();
