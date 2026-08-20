import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const openingSource = fs.readFileSync(
  path.join(projectRoot, 'tavern_helper_template', 'src', 'Counterfeit', '界面', '开场白', 'DlcSetup.vue'),
  'utf8',
);
const dialogueSource = fs.readFileSync(path.join(projectRoot, '角色卡工程', '脚本', '对话渲染.js'), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBalancedBlock(source, selectorPattern) {
  const match = selectorPattern.exec(source);
  assert.ok(match, `missing selector/block: ${selectorPattern}`);
  const open = source.indexOf('{', match.index);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`unbalanced selector/block: ${selectorPattern}`);
}

function selectorBlock(source, selector) {
  return findBalancedBlock(source, new RegExp(`${escapeRegExp(selector)}\\s*\\{`, 'g'));
}

function declaration(body, property, valuePattern) {
  return new RegExp(`(?:^|;)\\s*${escapeRegExp(property)}\\s*:\\s*${valuePattern}(?:\\s*;|\\s*$)`, 's');
}

function assertDeclaration(body, property, valuePattern) {
  assert.match(body, declaration(body, property, valuePattern));
}

test('开场白窄屏角色卡图片区占满宽度并居中 contain', () => {
  assertDeclaration(selectorBlock(openingSource, '.dlc-pov-card'), 'width', '100%');
  assertDeclaration(selectorBlock(openingSource, '.dlc-pov-card'), 'min-width', '0');
  assertDeclaration(selectorBlock(openingSource, '.pov-art'), 'width', '100%');
  assertDeclaration(selectorBlock(openingSource, '.pov-art'), 'min-width', '0');
  const artImage = selectorBlock(openingSource, '.pov-art img');
  assertDeclaration(artImage, 'display', 'block');
  assertDeclaration(artImage, 'max-width', '100%');
  assertDeclaration(artImage, 'margin-inline', 'auto');
  const mobile = findBalancedBlock(openingSource, /@media\s*\(\s*max-width\s*:\s*520px\s*\)\s*\{/g);
  const mobileArt = selectorBlock(mobile, '.pov-art');
  assertDeclaration(mobileArt, 'height', String.raw`clamp\(\s*210px\s*,\s*68vw\s*,\s*310px\s*\)`);
  const mobileArtImage = selectorBlock(mobile, '.pov-art img');
  assertDeclaration(mobileArtImage, 'width', String.raw`min\(\s*100%\s*,\s*360px\s*\)`);
  assertDeclaration(mobileArtImage, 'height', '100%');
  assertDeclaration(mobileArtImage, 'object-fit', 'contain');
  assertDeclaration(mobileArtImage, 'object-position', String.raw`center\s+bottom`);
});

test('对话头像放大层使用浅色展示卡且不裁切', () => {
  const mask = selectorBlock(dialogueSource, '.cf-zoom-mask');
  assertDeclaration(mask, 'background', String.raw`rgba\(\s*104\s*,\s*91\s*,\s*85\s*,\s*\.24\s*\)`);
  assertDeclaration(mask, 'backdrop-filter', String.raw`blur\(\s*6px\s*\)`);
  assert.doesNotMatch(mask, /var\s*\(/);
  const image = selectorBlock(dialogueSource, '.cf-zoom-mask img');
  assertDeclaration(image, 'max-width', String.raw`min\(\s*420px\s*,\s*82vw\s*\)`);
  assertDeclaration(image, 'object-fit', 'contain');
  assertDeclaration(image, 'background', '#f4f1ea');
  assert.doesNotMatch(image, /var\s*\(/);
  const caption = selectorBlock(dialogueSource, '.cf-zoom-mask .cf-zoom-caption');
  assertDeclaration(caption, 'color', '#5b4a4f');
  const fallback = selectorBlock(dialogueSource, '.cf-zoom-mask-fallback');
  assertDeclaration(fallback, 'background', '#f4f1ea');
  assertDeclaration(fallback, 'color', '#a5737f');
  assert.doesNotMatch(dialogueSource, /\.cf-zoom-mask\s+img\s*\{[^}]*aspect-ratio\s*:\s*9\s*\/\s*13/s);
  assert.doesNotMatch(dialogueSource, /\.cf-zoom-mask\s+img\s*\{[^}]*object-fit\s*:\s*cover/s);
});
