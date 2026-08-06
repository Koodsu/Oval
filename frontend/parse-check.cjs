const ts = require('typescript');
const fs = require('fs');
const files = [
 '/sessions/nifty-gallant-faraday/mnt/Oval/landing/src/components/TermsOfUse.jsx',
 '/sessions/nifty-gallant-faraday/mnt/Oval/landing/src/components/PrivacyPolicy.jsx',
 '/sessions/nifty-gallant-faraday/mnt/Oval/landing/src/components/CommunityGuidelines.jsx',
];
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  const diags = sf.parseDiagnostics || [];
  if (diags.length) { bad++; console.log(f, diags.map(d => ts.flattenDiagnosticMessageText(d.messageText,' ') + ' @' + d.start)); }
  else console.log('OK  ' + f.split('/').pop());
}
process.exit(bad ? 1 : 0);
