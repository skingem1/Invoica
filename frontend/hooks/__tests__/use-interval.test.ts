import { renderHook, act } from '@testing-library/react';
import { useInterval } from '../use-interval';

describe('useInterval', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls callback after delay', () => {
    const cb = jest.fn();
    renderHook(() => useInterval(cb, 1000));
    act(() => jest.advanceTimersByTime(1000));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('calls callback repeatedly', () => {
    const cb = jest.fn();
    renderHook(() => useInterval(cb, 1000));
    act(() => jest.advanceTimersByTime(3000));
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('does not call callback immediately', () => {
    const cb = jest.fn();
    renderHook(() => useInterval(cb, 1000));
    expect(cb).not.toHaveBeenCalled();
  });

  it('pauses when delay is null', () => {
    const cb = jest.fn();
    renderHook(() => useInterval(cb, null));
    act(() => jest.advanceTimersByTime(1000));
    expect(cb).not.toHaveBeenCalled();
  });

  it('cleans up on unmount', () => {
    const cb = jest.fn();
    const { unmount } = renderHook(() => useInterval(cb, 1000));
    unmount();
    act(() => jest.advanceTimersByTime(1000));
    expect(cb).not.toHaveBeenCalled();
  });

  it('updates callback without resetting interval', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const { rerender } = renderHook(({ fn, delay }) => useInterval(fn, delay), {
      initialProps: { fn: cb1, delay: 1000 },
    });
    rerender({ fn: cb2, delay: 1000 });
    act(() => jest.advanceTimersByTime(1000));
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});