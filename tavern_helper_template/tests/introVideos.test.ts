// 前端工程/tests/introVideos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_CLIPS,
  TITLE_LOOP,
  pickVariant,
  clipVideoUrl,
  clipPosterUrl,
  titleLoopVideoUrl,
  titleLoopPosterUrl,
} from './.build-opening/introVideos.ts';

test('序奏六拍：key 顺序与分镜脚本一致', () => {
  assert.deepEqual(
    INTRO_CLIPS.map(c => c.key),
    ['may', 'spring', 'summer', 'winter', 'heal', 'grad'],
  );
});

test('每拍 5s，且有中文字幕日期标注', () => {
  for (const clip of INTRO_CLIPS) {
    assert.equal(clip.durationMs, 5000, clip.key);
    assert.ok(clip.dateLabel.length > 0, clip.key);
  }
});

test('画幅选源：竖屏 _v，横屏/方形 _h', () => {
  assert.equal(pickVariant(390, 844), 'v');
  assert.equal(pickVariant(1920, 1080), 'h');
  assert.equal(pickVariant(1000, 1000), 'h');
});

test('视频/首帧 URL：文件名带画幅后缀，附版本号', () => {
  const url = clipVideoUrl(INTRO_CLIPS[0], 'v');
  assert.match(url, /intro_01_may_v\.mp4\?v=/);
  const poster = clipPosterUrl(INTRO_CLIPS[2], 'h');
  assert.match(poster, /intro_03_summer_h\.webp\?v=/);
});

test('标题屏循环 URL', () => {
  assert.match(titleLoopVideoUrl('v'), /title_sakura_loop_v\.mp4\?v=/);
  assert.match(titleLoopPosterUrl(), /bg_sakura\.webp\?v=/);
});
