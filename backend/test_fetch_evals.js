require('dotenv').config();
const supabase = require('./supabaseClient');

async function test() {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2);

  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

test();
