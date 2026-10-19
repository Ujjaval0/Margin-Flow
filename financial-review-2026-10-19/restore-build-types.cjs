const fs=require('node:fs');
const before=fs.readFileSync('financial-review-2026-10-19/build-tsconfig-before.json','utf8');
const current=fs.readFileSync('tsconfig.json','utf8');
const normalized=value=>{const parsed=JSON.parse(value);parsed.include=parsed.include.filter(p=>!p.startsWith('.next-financial-')).sort();return JSON.stringify(parsed);};
if(normalized(before)!==normalized(current))throw Error('TypeScript configuration changed independently; original retained for review.');
fs.writeFileSync('tsconfig.json',before);
