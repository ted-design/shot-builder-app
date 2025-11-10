#!/usr/bin/env node

/**
 * Migration Script: gray-* → slate-*
 *
 * This script migrates all Tailwind gray-* color classes to slate-*
 * across the src/ directory.
 *
 * Pattern: \bgray-(\d{2,3})\b → slate-$1
 *
 * Examples:
 * - gray-50 → slate-50
 * - text-gray-900 → text-slate-900
 * - dark:bg-gray-800 → dark:bg-slate-800
 * - hover:border-gray-300 → hover:border-slate-300
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = path.join(__dirname, '..', 'src');
const FILE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.md'];
const DRY_RUN = process.argv.includes('--dry-run');

// Statistics
const stats = {
  filesScanned: 0,
  filesChanged: 0,
  totalReplacements: 0,
  fileDetails: []
};

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!file.startsWith('.') && file !== 'node_modules') {
        getAllFiles(filePath, fileList);
      }
    } else {
      // Only process specified file extensions
      const ext = path.extname(file);
      if (FILE_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Migrate gray-* to slate-* in a file
 */
function migrateFile(filePath) {
  stats.filesScanned++;

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Count before replacements
  const beforeMatches = content.match(/\bgray-(\d{2,3})\b/g);
  const beforeCount = beforeMatches ? beforeMatches.length : 0;

  // Perform replacement: gray-{number} → slate-{number}
  content = content.replace(/\bgray-(\d{2,3})\b/g, 'slate-$1');

  // Count after replacements
  const afterMatches = content.match(/\bslate-(\d{2,3})\b/g);
  const afterCount = afterMatches ? afterMatches.length : 0;

  // Calculate actual replacements made
  const replacements = beforeCount;

  if (replacements > 0) {
    stats.filesChanged++;
    stats.totalReplacements += replacements;

    const relativePath = path.relative(process.cwd(), filePath);

    stats.fileDetails.push({
      file: relativePath,
      replacements
    });

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ ${relativePath} (${replacements} replacements)`);
    } else {
      console.log(`[DRY RUN] ${relativePath} (${replacements} replacements)`);
    }
  }
}

/**
 * Main migration function
 */
function runMigration() {
  console.log('🎨 Gray → Slate Migration Script\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files will be modified)' : 'LIVE (files will be modified)'}\n`);
  console.log(`Scanning: ${SRC_DIR}\n`);

  const files = getAllFiles(SRC_DIR);

  console.log(`Found ${files.length} files to scan\n`);
  console.log('Processing...\n');

  files.forEach(file => migrateFile(file));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Files changed: ${stats.filesChanged}`);
  console.log(`Total replacements: ${stats.totalReplacements}`);
  console.log('='.repeat(60));

  if (stats.filesChanged > 0) {
    console.log('\n📁 Changed files:');
    stats.fileDetails.forEach(({ file, replacements }) => {
      console.log(`  • ${file} (${replacements})`);
    });
  }

  console.log('\n✨ Migration complete!\n');

  if (DRY_RUN) {
    console.log('💡 To apply changes, run without --dry-run flag\n');
  } else {
    console.log('💡 Review changes with: git diff\n');
  }
}

// Run the migration
runMigration();
