const fs = require('fs');
const path = require('path');

const dir = path.resolve('public/assets/landmarks');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

console.log(`Checking ${files.length} landmark SVG files:`);
let allPass = true;

files.forEach(f => {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  const widthOk = Boolean(svg.match(/width=["'](320|320px)["']/));
  const heightOk = Boolean(svg.match(/height=["'](180|180px)["']/));
  const viewBoxOk = Boolean(svg.match(/viewBox=["']0 0 320 180["']/));
  const crispOk = Boolean(svg.match(/shape-rendering=["']crispEdges["']/));
  const pixelArtOk = Boolean(svg.match(/data-pixel-art=["']true["']/));
  const alphaOk = Boolean(svg.match(/data-alpha=["']false["']/));
  const borderOk = Boolean(svg.match(/#182433/i));
  
  const hexColors = new Set((svg.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(c => c.toLowerCase()));
  const colorCountOk = hexColors.size <= 24;

  const ok = widthOk && heightOk && viewBoxOk && crispOk && pixelArtOk && alphaOk && borderOk && colorCountOk;
  if (!ok) allPass = false;

  console.log(`- ${f}: ${ok ? 'PASS' : 'FAIL'} (colors: ${hexColors.size}, w:${widthOk}, h:${heightOk}, vb:${viewBoxOk}, crisp:${crispOk}, pixel:${pixelArtOk}, alpha:${alphaOk}, border:${borderOk})`);
});

console.log(`Overall SVG checks pass: ${allPass}`);
