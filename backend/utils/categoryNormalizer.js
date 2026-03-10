/**
 * Utility to normalize skill/category names to match those in questions.json
 */
const ALIASES = {
  // JavaScript
  'js': 'javascript',
  'javascip': 'javascript',
  'javascipt': 'javascript',
  'jscript': 'javascript',
  'node': 'node.js',
  'nodejs': 'node.js',
  'reactjs': 'react',
  'react.js': 'react',
  
  // C family
  'cpp': 'c++',
  'c plus plus': 'c++',
  'cplusplus': 'c++',
  'c#': 'csharp',
  'csharp': 'csharp',
  'visual c#': 'csharp',
  
  // Python & Data Science
  'py': 'python',
  'ml': 'machine learning',
  'ai': 'artificial intelligence',
  
  // OOP
  'oop': 'oops',
  'oops': 'oops',
  'object oriented': 'oops',
  'object-oriented': 'oops',
  
  // Others
  'dbms': 'sql',
  'postgres': 'sql',
  'postgresql': 'sql',
  'mysql': 'sql',
  'database': 'sql',
  'mongodb': 'sql', // Mapping Mongo to General SQL/DB questions for fallback if needed
  
  // HTML/CSS
  'htm': 'html',
  'html5': 'html',
  'css3': 'css',
  'cascading style sheets': 'css'
};

function normalizeCategory(category) {
  if (!category) return 'random';
  
  let term = String(category).toLowerCase().trim().replace(/[^a-z0-9+#]/g, ''); // Keep common tech chars
  
  // 1. Direct match in expanded aliases
  if (ALIASES[term]) return ALIASES[term];
  
  // 2. Exact match check
  const known = ['html', 'css', 'sql', 'java', 'c', 'c++', 'python', 'oops', 'javascript', 'react', 'csharp'];
  if (known.includes(term)) return term;

  // 3. Partial/Substring matches
  if (/^j.*v.*s.*c.*t$/.test(term) || term.includes('javascript') || term === 'js') return 'javascript';
  if (term.includes('python')) return 'python';
  if (term.includes('react')) return 'react';
  if (term.includes('html')) return 'html';
  if (term.includes('css')) return 'css';
  if (term.includes('sql') || term.includes('database') || term.includes('dbms')) return 'sql';
  if (term.includes('java') && !term.includes('script')) return 'java';
  if (term === 'c' || term.startsWith('c ')) return 'c';
  if (term.includes('c++') || term.includes('cpp')) return 'c++';
  if (term.includes('c#') || term.includes('csharp')) return 'csharp';
  if (term.includes('oops') || term.includes('objectoriented')) return 'oops';

  return term; 
}

module.exports = { normalizeCategory };
