/**
 * Utility to normalize skill/category names to match those in questions.json
 * JSON categories: angular, c, c++, csharp, css, django, dsa, firebase, flask,
 *                  git, github, html, java, javascript, mongodb, mysql,
 *                  networking, nodejs, oop, operating_systems, postgresql,
 *                  python, react, typescript
 */
const ALIASES = {
  // JavaScript family
  'js': 'javascript',
  'javascip': 'javascript',
  'javascipt': 'javascript',
  'jscript': 'javascript',
  'ts': 'typescript',
  'node': 'nodejs',
  'node.js': 'nodejs',
  'nodejs': 'nodejs',
  'reactjs': 'react',
  'react.js': 'react',
  'angularjs': 'angular',
  'angular.js': 'angular',

  // C family
  'cpp': 'c++',
  'c plus plus': 'c++',
  'cplusplus': 'c++',
  'c#': 'csharp',
  'csharp': 'csharp',
  'visual c#': 'csharp',

  // Python & frameworks
  'py': 'python',

  // OOP
  'oop': 'oop',
  'oops': 'oop',
  'object oriented': 'oop',
  'object-oriented': 'oop',

  // DSA
  'dsa': 'dsa',
  'data structures': 'dsa',
  'algorithms': 'dsa',
  'data structures and algorithms': 'dsa',

  // Databases (each maps to its own JSON category)
  'mongo': 'mongodb',
  'mongodb': 'mongodb',
  'mysql': 'mysql',
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'sql': 'mysql',
  'dbms': 'mysql',
  'database': 'mysql',

  // Networking / OS
  'networking': 'networking',
  'computer networks': 'networking',
  'networks': 'networking',
  'os': 'operating_systems',
  'operating systems': 'operating_systems',
  'operating system': 'operating_systems',
  'operatingsystems': 'operating_systems',

  // HTML/CSS
  'htm': 'html',
  'html5': 'html',
  'css3': 'css',
  'cascading style sheets': 'css',

  // AI / ML
  'ml': 'machine learning',
  'ai': 'artificial intelligence',
};

// All known category keys from questions.json
const KNOWN = [
  'angular', 'c', 'c++', 'csharp', 'css', 'django', 'dsa', 'firebase',
  'flask', 'git', 'github', 'html', 'java', 'javascript', 'mongodb',
  'mysql', 'networking', 'nodejs', 'oop', 'operating_systems',
  'postgresql', 'python', 'react', 'typescript',
];

function normalizeCategory(category) {
  if (!category) return 'random';

  // Lowercase and trim, but keep special chars like +, #, .
  let term = String(category).toLowerCase().trim();

  // 1. Check alias table first (exact match on the trimmed string)
  if (ALIASES[term]) return ALIASES[term];

  // 2. Strip non-alphanumeric (except + and #) for a second alias lookup
  let stripped = term.replace(/[^a-z0-9+#]/g, '');
  if (ALIASES[stripped]) return ALIASES[stripped];

  // 3. Direct match against known categories
  if (KNOWN.includes(term)) return term;
  if (KNOWN.includes(stripped)) return stripped;

  // 4. Partial / substring fallback
  if (term.includes('javascript') || term === 'js') return 'javascript';
  if (term.includes('typescript')) return 'typescript';
  if (term.includes('python')) return 'python';
  if (term.includes('react')) return 'react';
  if (term.includes('angular')) return 'angular';
  if (term.includes('html')) return 'html';
  if (term.includes('css')) return 'css';
  if (term.includes('django')) return 'django';
  if (term.includes('flask')) return 'flask';
  if (term.includes('firebase')) return 'firebase';
  if (term.includes('mongo')) return 'mongodb';
  if (term.includes('mysql')) return 'mysql';
  if (term.includes('postgres')) return 'postgresql';
  if (term.includes('sql') || term.includes('database') || term.includes('dbms')) return 'mysql';
  if (term.includes('java') && !term.includes('script')) return 'java';
  if (term === 'c' || term.startsWith('c ')) return 'c';
  if (term.includes('c++') || term.includes('cpp')) return 'c++';
  if (term.includes('c#') || term.includes('csharp')) return 'csharp';
  if (term.includes('oops') || term.includes('oop') || term.includes('objectoriented')) return 'oop';
  if (term.includes('network')) return 'networking';
  if (term.includes('operating') || term === 'os') return 'operating_systems';
  if (term.includes('node')) return 'nodejs';
  if (term.includes('git') && term.includes('hub')) return 'github';
  if (term.includes('git')) return 'git';
  if (term.includes('dsa') || term.includes('data structure') || term.includes('algorithm')) return 'dsa';

  return term;
}

module.exports = { normalizeCategory };
