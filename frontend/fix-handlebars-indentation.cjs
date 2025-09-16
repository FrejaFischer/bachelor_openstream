#!/usr/bin/env node

// SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { execSync } = require('child_process');

// Function to fix Handlebars partial block indentation
function fixHandlebarsIndentation(content) {
  const lines = content.split('\n');
  const fixedLines = [];
  let indentLevel = 0;
  const indentSize = 4; // 4 spaces per indent level

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for opening partial blocks
    if (trimmedLine.startsWith('{{#>') || trimmedLine.startsWith('{{#*inline')) {
      // Opening blocks should maintain their current indentation
      fixedLines.push(line);
      indentLevel++;
    }
    // Check for closing partial blocks
    else if (trimmedLine.startsWith('{{/')) {
      // Closing blocks should be indented at the same level as their opening
      indentLevel = Math.max(0, indentLevel - 1);
      const correctIndent = ' '.repeat(indentLevel * indentSize);
      fixedLines.push(correctIndent + trimmedLine);
    }
    // Regular lines
    else {
      fixedLines.push(line);
    }
  }

  return fixedLines.join('\n');
}

// Step 1: Format HTML with js-beautify
console.log('Step 1: Formatting HTML with js-beautify...');
try {
  execSync('npx js-beautify --type html --replace "src/pages/**/*.hbs"', { stdio: 'inherit' });
  console.log('✅ HTML formatting complete');
} catch (error) {
  console.error('❌ Error during HTML formatting:', error.message);
  process.exit(1);
}

// Step 2: Fix Handlebars partial indentation
console.log('\nStep 2: Fixing Handlebars partial indentation...');

// Find all .hbs files
const pattern = 'src/**/**/*.hbs';
const files = glob.sync(pattern);

console.log(`Found ${files.length} Handlebars files to process`);

let fixedCount = 0;
files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const fixedContent = fixHandlebarsIndentation(content);

    if (content !== fixedContent) {
      fs.writeFileSync(file, fixedContent, 'utf8');
      console.log(`✅ Fixed indentation in: ${file}`);
      fixedCount++;
    } else {
      console.log(`ℹ️  No changes needed in: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n🎉 Handlebars formatting complete!`);
console.log(`📊 Summary: ${fixedCount} files had indentation fixes applied`);
console.log(`💡 Combined HTML formatting + Handlebars partial alignment`);
