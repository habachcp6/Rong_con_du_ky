const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '..', 'public', 'assets', 'landmarks');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

console.log('Found landmark SVG files:', files.length);

let totalViolations = 0;

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  
  // Extract all hex colors
  const hexes = content.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const uniqueHexes = new Set(hexes.map(c => c.toLowerCase()));
  
  // Extract rgb/rgba
  const rgbs = content.match(/rgba?\([^)]+\)/gi) || [];
  
  // Extract named color fills/strokes
  const fills = content.match(/\b(fill|stroke|stop-color|color)\s*=\s*["']([^"']+)["']/gi) || [];
  const nonHexFills = fills.filter(attr => !attr.includes('#') && !attr.includes('none') && !attr.includes('currentColor'));

  // Check SVG dimensions, viewBox, shape-rendering, data-pixel-art, data-alpha, gradients, filters, external images
  const viewBoxMatch = content.match(/viewBox=["']([^"']+)["']/i);
  const widthMatch = content.match(/width=["']([^"']+)["']/i);
  const heightMatch = content.match(/height=["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;
  const width = widthMatch ? widthMatch[1] : null;
  const height = heightMatch ? heightMatch[1] : null;

  const crisp = content.includes('shape-rendering="crispEdges"');
  const pixelArt = content.includes('data-pixel-art="true"');
  const dataAlphaMatch = content.match(/data-alpha=["']([^"']+)["']/i);
  const dataAlpha = dataAlphaMatch ? dataAlphaMatch[1] : null;

  const hasGradient = /<(linearGradient|radialGradient)/i.test(content);
  const hasFilter = /<filter/i.test(content);
  const hasImage = /<image/i.test(content);
  const hasExternalRef = /\b(href|xlink:href)\s*=\s*["']https?:\/\//i.test(content);

  const border4px = content.includes('#182433');

  console.log(`\n--- ${f} ---`);
  console.log(`  Size: ${content.length} bytes`);
  console.log(`  Width x Height: ${width} x ${height}, viewBox: ${viewBox}`);
  console.log(`  crispEdges: ${crisp} | data-pixel-art: ${pixelArt} | data-alpha: ${dataAlpha}`);
  console.log(`  Forbidden tags (gradient/filter/image/ext): ${hasGradient} / ${hasFilter} / ${hasImage} / ${hasExternalRef}`);
  console.log(`  Has #182433 border color: ${border4px}`);
  console.log(`  Unique hex colors count: ${uniqueHexes.size}`);
  console.log(`  RGB matches: ${rgbs.length}`);
  console.log(`  Non-hex fills: ${JSON.stringify(nonHexFills)}`);
  console.log(`  Hex color list (${uniqueHexes.size}):`, Array.from(uniqueHexes).sort());

  let fileValid = true;
  if (uniqueHexes.size > 24) {
    console.error(`  ❌ FAIL: Color count (${uniqueHexes.size}) > 24!`);
    fileValid = false;
  }
  if (width !== '320' || height !== '180' || viewBox !== '0 0 320 180') {
    console.error(`  ❌ FAIL: Dimensions/viewBox mismatch!`);
    fileValid = false;
  }
  if (!crisp || !pixelArt || dataAlpha === null) {
    console.error(`  ❌ FAIL: Missing root SVG attributes!`);
    fileValid = false;
  }
  if (hasGradient || hasFilter || hasImage || hasExternalRef) {
    console.error(`  ❌ FAIL: Contains forbidden SVG tags!`);
    fileValid = false;
  }
  if (!fileValid) {
    totalViolations++;
  }
});

console.log(`\nTotal SVG Violations: ${totalViolations}`);
