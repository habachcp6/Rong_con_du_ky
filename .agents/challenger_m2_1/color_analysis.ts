import fs from 'node:fs';
import path from 'node:path';

const files = ['my-khe.svg', 'linh-ung.svg', 'cham-museum.svg', 'han-market.svg'];
const dir = path.resolve('public/assets/landmarks');

for (const f of files) {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  
  // Find all fill and stroke attributes and inline styles
  const colors = new Set<string>();
  const fillMatches = svg.matchAll(/(?:fill|stroke)=["']([^"']+)["']/g);
  for (const m of fillMatches) {
    if (m[1] !== 'none' && m[1] !== 'transparent') {
      colors.add(m[1].toLowerCase());
    }
  }
  
  const styleMatches = svg.matchAll(/(?:fill|stroke):\s*([^;"']+)/g);
  for (const m of styleMatches) {
    if (m[1] !== 'none' && m[1] !== 'transparent') {
      colors.add(m[1].trim().toLowerCase());
    }
  }
  
  console.log(`\n${f}: Found ${colors.size} distinct fill/stroke colors:`);
  console.log(Array.from(colors).sort().join(', '));
}
