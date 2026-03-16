const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * A comprehensive, lowercase dictionary of technical skills, languages, frameworks, and IT terms.
 * This runs locally to match against the resume.
 */
const TECH_DICTIONARY = new Set([
  // Programming Languages
  'javascript', 'js', 'typescript', 'ts', 'python', 'java', 'c', 'c++', 'c#', 'csharp', 'ruby', 'php',
  'swift', 'kotlin', 'go', 'golang', 'rust', 'scala', 'r', 'dart', 'perl', 'shell', 'bash', 'powershell',
  'sql', 'nosql', 'html', 'html5', 'css', 'css3', 'sass', 'less', 'assembly', 'matlab', 'objective-c',
  
  // Frameworks & Libraries (Frontend & Backend)
  'react', 'reactjs', 'react.js', 'reactnative', 'angular', 'angularjs', 'vue', 'vuejs', 'vue.js',
  'svelte', 'next.js', 'nextjs', 'nuxt', 'express', 'express.js', 'expressjs', 'nestjs', 'node.js', 'nodejs', 'node',
  'django', 'flask', 'fastapi', 'spring', 'springboot', 'spring boot', 'laravel', 'symfony', 'rails',
  'rubyonrails', 'asp.net', '.net', 'dotnet', 'jquery', 'bootstrap', 'tailwind', 'tailwindcss', 'material-ui',
  'mui', 'redux', 'mobx', 'graphql', 'apollo',
  
  // Databases
  'mysql', 'postgresql', 'postgres', 'sqlite', 'oracle', 'sql server', 'mssql', 'mongodb', 'mongo',
  'redis', 'cassandra', 'dynamodb', 'couchbase', 'neo4j', 'firebase', 'supabase', 'mariadb', 'elasticsearch',
  
  // Devops, Cloud & Infrastructure
  'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ansible', 'chef', 'puppet', 'jenkins', 'gitlab cicd', 'github actions', 'circleci',
  'travisci', 'linux', 'unix', 'ubuntu', 'centos', 'nginx', 'apache', 'tomcat', 'iis', 'heroku',
  'vercel', 'netlify', 'digitalocean', 'cloudflare', 'maven', 'gradle', 'npm', 'yarn', 'webpack', 'vite',
  
  // Mobile App Dev
  'flutter', 'ios', 'android', 'xamarin', 'ionic',
  
  // Software Concepts & Methodologies
  'git', 'github', 'gitlab', 'bitbucket', 'agile', 'scrum', 'kanban', 'jira', 'confluence', 'trello',
  'ci/cd', 'cicd', 'oop', 'object-oriented', 'mvc', 'rest', 'restful', 'api', 'microservices', 'serverless',
  'tdd', 'bdd', 'jest', 'mocha', 'chai', 'cypress', 'selenium', 'puppeteer', 'playwright',
  
  // AI, Data Science & Machine Learning
  'machine learning', 'ml', 'artificial intelligence', 'ai', 'deep learning', 'dl', 'nlp', 'computer vision',
  'data science', 'pandas', 'numpy', 'scipy', 'scikit-learn', 'tensorflow', 'keras', 'pytorch', 'jupyter',
  'hadoop', 'spark', 'kafka', 'airflow', 'tableau', 'powerbi',
  
  // General IT/Computer Science
  'computer science', 'cse', 'it', 'information technology', 'software engineering', 'computer applications',
  'bca', 'mca', 'btech', 'mtech', 'algorithms', 'data structures', 'networking', 'operating systems', 'dbms'
]);

/**
 * Extracts specific technical words/skills from a PDF or DOCX file buffer.
 * 
 * @param {Buffer} buffer - File buffer to parse
 * @param {string} mimetype - MIME type of the file
 * @returns {Promise<{ rawText: string, words: string[], extractedSkills: string[] }>} 
 */
async function extractDocumentWords(buffer, mimetype) {
  let rawText = '';

  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    rawText = data.text;
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value;
  } else {
    throw new Error('Unsupported file type. Please provide a supported PDF or DOCX file.');
  }

  // Tokenization logic to extract exact words safely
  // E.g., removes punctuation but keeps spaces for exact phrase matching later if necessary
  const cleanText = rawText.toLowerCase().replace(/[^\w\s\.\+#-]/g, ' '); 
  
  // Split by whitespace to get independent words
  const words = cleanText
    .split(/\s+/)
    .filter(word => word.trim().length > 0);

  // Filter the extracted words by comparing them to our TECH_DICTIONARY
  const matchedSkillsSet = new Set();
  
  words.forEach(word => {
    // Exact word match
    if (TECH_DICTIONARY.has(word)) {
      matchedSkillsSet.add(word);
    }
  });

  // Also look for multi-word phrases directly in the clean text
  const multiWordTech = Array.from(TECH_DICTIONARY).filter(skill => skill.includes(' '));
  multiWordTech.forEach(phrase => {
    // Use regex to look for standalone phrases
    const regex = new RegExp(`\\b${phrase}\\b`, 'i');
    if (regex.test(cleanText)) {
      matchedSkillsSet.add(phrase);
    }
  });

  const extractedSkills = Array.from(matchedSkillsSet);

  return {
    rawText: rawText.trim(),
    words: words,
    extractedSkills: extractedSkills // <--- Brand new output just containing matched skills
  };
}

module.exports = {
  extractDocumentWords
};
