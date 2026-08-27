# -*- coding: utf-8 -*-
"""开场白横版视频超分：720p → 1080p（Real-ESRGAN anime 模型 + ffmpeg 逐帧管线）。

用法：python assets/tools/upscale_opening_videos.py <输入目录> <输出目录>
输入目录放 Seedance 直出的 *_h.mp4（1280×720）；输出为 1920×1080、无声、CRF 20。
"""
import os
import subprocess
import sys
import tempfile

FPS_PROBE = ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0']


def run(cmd):
    subprocess.run(cmd, check=True)


def upscale(src, dst):
    with tempfile.TemporaryDirectory() as tmp:
        frames_in = os.path.join(tmp, 'in')
        frames_out = os.path.join(tmp, 'out')
        os.makedirs(frames_in)
        os.makedirs(frames_out)
        fps = subprocess.run(FPS_PROBE + [src], capture_output=True, text=True, check=True).stdout.strip()
        run(['ffmpeg', '-y', '-i', src, os.path.join(frames_in, 'f%06d.png')])
        run(['realesrgan-ncnn-vulkan', '-i', frames_in, '-o', frames_out,
             '-n', 'realesr-animevideov3', '-s', '2', '-f', 'png'])
        # 720p ×2 = 1440p，再缩到 1080p（比直接 ×1.5 画质更稳）
        run(['ffmpeg', '-y', '-framerate', fps, '-i', os.path.join(frames_out, 'f%06d.png'),
             '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264',
             '-crf', '20', '-pix_fmt', 'yuv420p', '-an', dst])


def main():
    src_dir, dst_dir = sys.argv[1], sys.argv[2]
    os.makedirs(dst_dir, exist_ok=True)
    for name in sorted(os.listdir(src_dir)):
        if name.endswith('_h.mp4'):
            print(f'超分: {name}')
            upscale(os.path.join(src_dir, name), os.path.join(dst_dir, name))
            print(f'  -> {os.path.getsize(os.path.join(dst_dir, name)) // 1024}KB')


if __name__ == '__main__':
    main()
