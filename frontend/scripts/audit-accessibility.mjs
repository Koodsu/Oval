import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = path.resolve(process.cwd(), 'src');
const appFile = path.resolve(process.cwd(), 'App.tsx');
const findings = [];

/**
 * Text allowed to scale below 200%. Each entry must be a glyph functioning as
 * an image rather than prose — WCAG 1.4.4 applies to text, not graphics.
 * Adding to this list is a deliberate accessibility decision; document why.
 */
const FONT_SCALE_EXCEPTIONS = [
  {
    file: path.join('src', 'screens', 'clubs', 'CreateClubScreen.tsx'),
    match: 'styles.avatarEmoji',
    reason: 'Club avatar glyph is a picked image, not readable prose.',
  },
];

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    return entry.isFile() && fullPath.endsWith('.tsx') && !fullPath.includes('__tests__') && !fullPath.endsWith('.test.tsx')
      ? [fullPath]
      : [];
  });
}

function tagName(node) {
  const tag = node.tagName;
  return ts.isIdentifier(tag) ? tag.text : tag.getText();
}

function hasProp(node, prop) {
  return node.attributes.properties.some(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === prop,
  );
}

function isInteractive(node) {
  const tag = tagName(node);
  if (['Pressable', 'TouchableOpacity', 'TouchableWithoutFeedback'].includes(tag)) return true;
  if (['Slab', 'Button', 'IconButton', 'Chip', 'ListRow'].includes(tag)) {
    return hasProp(node, 'onPress') || hasProp(node, 'onLongPress');
  }
  return false;
}

function interactiveAncestor(node) {
  let parent = node.parent;
  while (parent) {
    if (ts.isJsxElement(parent)
      && parent.openingElement !== node
      && isInteractive(parent.openingElement)) {
      return tagName(parent.openingElement);
    }
    parent = parent.parent;
  }
  return null;
}

function addFinding(file, source, node, message) {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  findings.push(`${path.relative(process.cwd(), file)}:${position.line + 1}:${position.character + 1} ${message}`);
}

for (const file of [appFile, ...walkFiles(root)]) {
  const sourceText = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);

      if (['Pressable', 'TouchableOpacity', 'TouchableWithoutFeedback'].includes(tag)) {
        if (!hasProp(node, 'accessibilityRole')) {
          addFinding(file, source, node, `<${tag}> is missing accessibilityRole`);
        }
        if (!hasProp(node, 'accessibilityLabel')) {
          addFinding(file, source, node, `<${tag}> is missing accessibilityLabel`);
        }
      }

      if (tag === 'Slab' && (hasProp(node, 'onPress') || hasProp(node, 'onLongPress'))
        && !hasProp(node, 'accessibilityLabel')) {
        addFinding(file, source, node, '<Slab> with an action is missing accessibilityLabel');
      }

      const ancestor = isInteractive(node) ? interactiveAncestor(node) : null;
      if (ancestor) {
        addFinding(file, source, node, `<${tag}> is nested inside interactive <${ancestor}>`);
      }

      if (tag === 'TextInput' && !hasProp(node, 'accessibilityLabel')) {
        addFinding(file, source, node, '<TextInput> is missing accessibilityLabel');
      }

      if (tag === 'Text' && /allowFontScaling\s*=\s*(?:\{false\}|["']false["'])/.test(node.getText(source))) {
        addFinding(file, source, node, '<Text> disables system font scaling');
      }

      // WCAG 1.4.4 requires text to reach 200%. maxFontSizeMultiplier is the
      // only thing in this codebase that can silently cap it, and capping is
      // invisible to every other check, so anything below 2 must be an
      // explicitly allowlisted exception.
      const multiplierMatch = node.getText(source).match(/maxFontSizeMultiplier\s*=\s*\{([0-9.]+)\}/);
      if (multiplierMatch) {
        const multiplier = Number.parseFloat(multiplierMatch[1]);
        const relative = path.relative(process.cwd(), file);
        const allowed = FONT_SCALE_EXCEPTIONS.some(
          (exception) => relative === exception.file && node.getText(source).includes(exception.match),
        );
        if (multiplier < 2 && !allowed) {
          addFinding(
            file,
            source,
            node,
            `<Text> caps Dynamic Type at ${multiplier}x; WCAG 1.4.4 requires 200% (use 2, or add a documented exception)`,
          );
        }
      }

      if ((tag === 'Image' || tag === 'Animated.Image')
        && !hasProp(node, 'accessible')
        && !hasProp(node, 'accessibilityLabel')) {
        addFinding(file, source, node, `<${tag}> must be explicitly labeled or marked accessible={false}`);
      }

      if (tag === 'Switch' && !hasProp(node, 'accessibilityLabel')) {
        addFinding(file, source, node, '<Switch> is missing accessibilityLabel');
      }


      if (tag === 'SpotIllustration'
        && !hasProp(node, 'decorative')
        && !hasProp(node, 'accessibilityLabel')) {
        addFinding(file, source, node, '<SpotIllustration> must be labeled or marked decorative');
      }

      if (tag === 'MapView' && !hasProp(node, 'accessibilityLabel')) {
        addFinding(file, source, node, '<MapView> is missing accessibilityLabel');
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

const appConfigPath = path.resolve(process.cwd(), 'app.json');
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
if (appConfig?.expo?.orientation !== 'default') {
  findings.push('app.json: Expo orientation must remain "default" for accessibility');
}

if (findings.length) {
  console.error(`Accessibility audit found ${findings.length} issue${findings.length === 1 ? '' : 's'}:\n`);
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Accessibility static audit passed.');
}
