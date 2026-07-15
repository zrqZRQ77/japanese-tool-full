#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../kuromoji-worker-poc.js', import.meta.url), 'utf8');
const workers = [];

class FakeWorker {
  constructor(url) {
    this.url = url;
    this.messages = [];
    this.terminated = false;
    this.listeners = { message: new Set(), error: new Set() };
    workers.push(this);
  }

  addEventListener(type, listener) {
    this.listeners[type].add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners[type].delete(listener);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, payload) {
    for (const listener of [...this.listeners[type]]) {
      listener(type === 'message' ? { data: payload } : payload);
    }
  }
}

const context = vm.createContext({
  window: {},
  Worker: FakeWorker,
  performance,
  setTimeout,
  clearTimeout,
  console
});
vm.runInContext(source, context, { filename: 'kuromoji-worker-poc.js' });
const api = context.window.KuromojiWorkerClient;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const resultFor = (id, surface) => ({
  id,
  type: 'result',
  paragraphs: [{ index: 0, text: surface, tokens: [] }],
  tokens: [{
    surface,
    basicForm: surface,
    pos: '名詞',
    posDetail: '',
    conjugatedType: '',
    conjugatedForm: '',
    rawReading: '',
    rawPronunciation: '',
    reading: '',
    pronunciation: '',
    paragraphIndex: 0,
    start: 0
  }],
  metrics: { tokenizeMs: 1 }
});

{
  const client = api.createClient({ initTimeoutMs: 100, tokenizeTimeoutMs: 100 });
  const first = client.analyze('一');
  const second = client.analyze('二');
  assert.equal(workers.length, 1, 'concurrent cold requests must create one Worker');
  const worker = workers.at(-1);
  assert.equal(worker.messages.filter(message => message.type === 'initialize').length, 1);
  worker.emit('message', { id: worker.messages[0].id, type: 'ready', metrics: { initMs: 12 } });
  await delay(0);
  const tokenizeMessages = worker.messages.filter(message => message.type === 'tokenize');
  assert.equal(tokenizeMessages.length, 2);
  worker.emit('message', resultFor(tokenizeMessages[0].id, '一'));
  worker.emit('message', resultFor(tokenizeMessages[1].id, '二'));
  assert.deepEqual((await Promise.all([first, second])).map(result => result.tokens[0].surface), ['一', '二']);
  assert.equal(client.debugState().pendingCount, 0);
  client.terminate();
  assert.equal(worker.listeners.message.size + worker.listeners.error.size, 0);
}

{
  const client = api.createClient({ initTimeoutMs: 100, tokenizeTimeoutMs: 100 });
  const fastTimeout = client.analyze('旧一', { tokenizeTimeoutMs: 8 });
  const sharedPending = client.analyze('旧二', { tokenizeTimeoutMs: 80 });
  const settlement = Promise.allSettled([fastTimeout, sharedPending]);
  const oldWorker = workers.at(-1);
  const lateErrorListeners = [...oldWorker.listeners.error];
  oldWorker.emit('message', { id: oldWorker.messages[0].id, type: 'ready', metrics: { initMs: 1 } });
  const settled = await settlement;
  assert.ok(settled.every(result => result.status === 'rejected'), 'one shared-worker timeout must reject its generation');
  assert.equal(client.debugState().pendingCount, 0, 'timeout must clear every pending request and timer');
  assert.equal(client.debugState().hasWorker, false);
  assert.equal(oldWorker.terminated, true);
  assert.equal(oldWorker.listeners.message.size + oldWorker.listeners.error.size, 0);

  const rebuilt = client.analyze('新');
  const newWorker = workers.at(-1);
  assert.notEqual(newWorker, oldWorker);
  lateErrorListeners.forEach(listener => listener({ message: 'late old error' }));
  assert.equal(newWorker.terminated, false, 'late old error must not terminate the new generation');
  newWorker.emit('message', { id: newWorker.messages[0].id, type: 'ready', metrics: { initMs: 2 } });
  await delay(0);
  const tokenize = newWorker.messages.find(message => message.type === 'tokenize');
  newWorker.emit('message', resultFor(tokenize.id, '新'));
  assert.equal((await rebuilt).tokens[0].surface, '新');
  client.terminate();
}

{
  const client = api.createClient({ initTimeoutMs: 60, tokenizeTimeoutMs: 6 });
  const request = client.analyze('分離');
  const worker = workers.at(-1);
  await delay(15);
  assert.equal(client.debugState().hasWorker, true, 'cold initialization must not use the hot tokenize timeout');
  worker.emit('message', { id: worker.messages[0].id, type: 'ready', metrics: { initMs: 15 } });
  await assert.rejects(request, /tokenization timed out after 6ms/);
  assert.equal(client.debugState().pendingCount, 0);
}

process.stdout.write('Kuromoji Worker lifecycle tests passed.\n');
