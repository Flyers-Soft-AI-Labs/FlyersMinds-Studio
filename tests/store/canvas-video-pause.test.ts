import { describe, expect, it } from 'vitest';
import { useCanvasStore } from '@/lib/store/canvas';

describe('canvas video pause state', () => {
  it('pauses and resumes a controlled video without clearing its element id', () => {
    const store = useCanvasStore.getState();
    store.stopVideo();

    store.playVideo('video-1');
    expect(useCanvasStore.getState().playingVideoElementId).toBe('video-1');
    expect(useCanvasStore.getState().videoPlaybackPaused).toBe(false);

    store.pauseVideo();
    expect(useCanvasStore.getState().playingVideoElementId).toBe('video-1');
    expect(useCanvasStore.getState().videoPlaybackPaused).toBe(true);

    store.resumeVideo();
    expect(useCanvasStore.getState().playingVideoElementId).toBe('video-1');
    expect(useCanvasStore.getState().videoPlaybackPaused).toBe(false);

    store.stopVideo();
    expect(useCanvasStore.getState().playingVideoElementId).toBe('');
  });
});
