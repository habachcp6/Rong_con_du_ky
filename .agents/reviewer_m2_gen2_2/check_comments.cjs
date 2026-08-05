const fs = require('fs');
const path = require('path');

const dir = path.resolve('public/assets/landmarks');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, '');
  
  const rawMatches = content.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const cleanMatches = withoutComments.match(/#[0-9a-fA-F]{3,8}\b/g) || [];

  const rawSet = new Set(rawMatches.map(c => c.toLowerCase()));
  const cleanSet = new Set(cleanMatches.map(c => c.toLowerCase()));

  if (rawSet.size !== cleanSet.size) {
    console.log(`Difference in ${f}: raw=${rawSet.size}, clean=${cleanSet.size}`);
  } else {
    console.log(`${f}: raw=${rawSet.size}, clean=${cleanSet.size} (IDENTICAL)`);
  }
});
