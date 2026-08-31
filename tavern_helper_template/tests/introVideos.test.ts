// 前端工程/tests/introVideos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OP_DESKTOP_BASE,
  OP_MOBILE_BASE,
  OP_PICTURE_END,
  isPortraitViewport,
  opPosterUrl,
  opVideoBase,
  opVideoUrl,
  titleLoopPosterUrl,
  titleLoopVideoUrl,
} from './.build-opening/introVideos.ts';

test('OP 双画幅源：桌面 16:9 / 移动竖屏', () => {
  assert.equal(OP_DESKTOP_BASE, 'op_desktop');
  assert.equal(OP_MOBILE_BASE, 'op_mobile');
});

test('OP 画面段时长 84s（到点交棒标题屏 BGM）', () => {
  assert.equal(OP_PICTURE_END, 84);
});

test('node 环境（无 window）默认桌面版', () => {
  assert.equal(isPortraitViewport(), false);
  assert.equal(opVideoBase(), 'op_desktop');
});

test('OP 视频/poster URL：附版本号', () => {
  assert.match(opVideoUrl(), /op_desktop\.mp4\?v=/);
  assert.match(opPosterUrl(), /op_desktop\.webp\?v=/);
});

test('标题屏循环 URL', () => {
  assert.match(titleLoopVideoUrl(), /title_sakura_loop\.mp4\?v=/);
  assert.match(titleLoopPosterUrl(), /bg_sakura\.webp\?v=/);
});
