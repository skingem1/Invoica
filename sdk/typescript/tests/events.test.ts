import { SdkEventEmitter } from '../src/events';

describe('SdkEventEmitter', () => {
  it('calls listener on emit', () => {
    const emitter = new SdkEventEmitter();
    const calls: any[] = [];
    emitter.on('request:start', (data) => calls.push(data));
    emitter.emit('request:start', { method: 'GET', url: '/test' });
    expect(calls).toEqual([{ method: 'GET', url: '/test' }]);
  });

  it('removes listener with off', () => {
    const emitter = new SdkEventEmitter();
    const calls: any[] = [];
    const listener = (data: any) => calls.push(data);
    emitter.on('request:start', listener);
    emitter.off('request:start', listener);
    emitter.emit('request:start', { method: 'GET', url: '/test' });
    expect(calls).toEqual([]);
  });

  it('removeAllListeners clears everything', () => {
    const emitter = new SdkEventEmitter();
    const calls: any[] = [];
    emitter.on('request:start', (data) => calls.push(data));
    emitter.on('request:end', (data) => calls.push(data));
    emitter.removeAllListeners();
    emitter.emit('request:start', { method: 'GET', url: '/test' });
    expect(calls).toEqual([]);
  });
});