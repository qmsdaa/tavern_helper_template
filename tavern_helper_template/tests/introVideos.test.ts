// 前端工程/tests/introVideos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTRO_CLIPS,
  TITLE_LOOP,
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

test('每拍时长与视频实测一致（5~6s），且有中文字幕日期标注', () => {
  const expected = { may: 5100, spring: 5000, summer: 6000, winter: 5100, heal: 5000, grad: 6000 };
  for (const clip of INTRO_CLIPS) {
    assert.equal(clip.durationMs, expected[clip.key], clip.key);
    assert.ok(clip.dateLabel.length > 0, clip.key);
  }
});

test('视频/首帧 URL：文件名无画幅后缀，附版本号', () => {
  const url = clipVideoUrl(INTRO_CLIPS[0]);
  assert.match(url, /intro_01_may\.mp4\?v=/);
  const poster = clipPosterUrl(INTRO_CLIPS[2]);
  assert.match(poster, /intro_03_summer\.webp\?v=/);
});

test('标题屏循环 URL', () => {
  assert.match(titleLoopVideoUrl(), /title_sakura_loop\.mp4\?v=/);
  assert.match(titleLoopPosterUrl(), /bg_sakura\.webp\?v=/);
});
