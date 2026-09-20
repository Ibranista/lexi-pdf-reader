const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");
const React = require("react");
const nativeRequire = createRequire(
  require.resolve("expo-module-scripts/package.json"),
);
const { create, act } = nativeRequire("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, "../..");
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

function environment() {
  const cache = new Map();
  const appListeners = new Set();
  const nativeListeners = new Map();
  const intervals = new Map();
  const timeouts = new Map();
  let now = 1000,
    timerId = 0;
  const events = {
    permissions: 0,
    initializes: 0,
    recording: false,
    tears: 0,
    played: 0,
    errors: [],
    turns: [],
    questions: [],
  };
  let permission = () => Promise.resolve({ granted: true });
  let initialize = () => Promise.resolve(true);
  const app = {
    currentState: "active",
    addEventListener: (_, fn) => {
      appListeners.add(fn);
      return { remove: () => appListeners.delete(fn) };
    },
  };
  const native = {
    requestMicrophonePermissionsAsync: () => {
      events.permissions++;
      return permission();
    },
    initialize: () => {
      events.initializes++;
      return initialize();
    },
    toggleRecording: (value) => {
      events.recording = value;
      return value;
    },
    tearDown: () => {
      events.recording = false;
      events.tears++;
    },
    playPCMData: () => events.played++,
    addExpoTwoWayAudioEventListener: (name, fn) => {
      nativeListeners.set(name, fn);
      return { remove: () => nativeListeners.delete(name) };
    },
  };
  class Socket {
    static OPEN = 1;
    static instances = [];
    readyState = 1;
    sent = [];
    constructor() {
      Socket.instances.push(this);
    }
    send(value) {
      this.sent.push(JSON.parse(value));
    }
    close() {
      this.readyState = 3;
    }
    receive(value) {
      this.onmessage?.({ data: JSON.stringify(value) });
    }
  }
  const mockApi = {
    api: {
      post: async () => ({ data: { model: "model", clientSecret: "token" } }),
    },
  };
  const mocks = {
    react: React,
    "react-native": { AppState: app },
    "expo-router": { useFocusEffect: (cb) => React.useEffect(cb, [cb]) },
    "@speechmatics/expo-two-way-audio": native,
    "@/stores/app-store": {
      useToastStore: {
        getState: () => ({ showToast: (s) => events.errors.push(s) }),
      },
    },
    "@/utils/axios": mockApi,
    "@/services/lexi-ai": { asQuotaError: () => null },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(
      fs.readFileSync(path.join(root, file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText;
    const localRequire = (id) =>
      id in mocks
        ? mocks[id]
        : id.startsWith("@/")
        ? load(`src/${id.slice(2)}.ts`)
        : require(id);
    vm.runInNewContext(
      code,
      {
        exports: module.exports,
        module,
        require: localRequire,
        console,
        Uint8Array,
        ArrayBuffer,
        TextDecoder,
        TextEncoder,
        WebSocket: Socket,
        Date: class extends Date {
          static now() {
            return now;
          }
        },
        setInterval: (fn) => {
          const id = ++timerId;
          intervals.set(id, fn);
          return id;
        },
        clearInterval: (id) => intervals.delete(id),
        setTimeout: (fn) => {
          const id = ++timerId;
          timeouts.set(id, fn);
          return id;
        },
        clearTimeout: (id) => timeouts.delete(id),
        btoa: (s) => Buffer.from(s, "binary").toString("base64"),
        atob: (s) => Buffer.from(s, "base64").toString("binary"),
      },
      { filename: file },
    );
    return module.exports;
  }
  const { useRealtimeVoice } = load("src/hooks/use-realtime-voice.ts");
  let value, renderer;
  let book = {
    docKey: "a".repeat(64),
    page: 1,
    excerpt: "First paragraph",
    source: "visible",
  };
  function Owner() {
    value = useRealtimeVoice({
      context: () => book,
      handlers: {
        onAsk: (text, context) => events.questions.push({ text, context }),
        onReplyProgress: () => {},
        onTurn: (turn) => events.turns.push(turn),
        onError: (error) => events.errors.push(error),
      },
    });
    return null;
  }
  return {
    events,
    Socket,
    intervals,
    timeouts,
    load,
    get voice() {
      return value;
    },
    get ws() {
      return Socket.instances.at(-1);
    },
    setPermission: (fn) => {
      permission = fn;
    },
    setInitialize: (fn) => {
      initialize = fn;
    },
    mount: async () =>
      act(async () => {
        renderer = create(React.createElement(Owner));
      }),
    unmount: async () =>
      act(async () => {
        renderer.unmount();
      }),
    render: async () =>
      act(async () => renderer.update(React.createElement(Owner))),
    start: async () =>
      act(async () => {
        value.start();
      }),
    ready: async () =>
      act(async () => {
        Socket.instances.at(-1).onopen();
        Socket.instances.at(-1).receive({ setupComplete: {} });
      }),
    background: async () =>
      act(async () => {
        app.currentState = "background";
        appListeners.forEach((fn) => fn("background"));
      }),
    foreground: async () =>
      act(async () => {
        app.currentState = "active";
        appListeners.forEach((fn) => fn("active"));
      }),
    emit: async (name, data) =>
      act(async () => nativeListeners.get(name)?.({ data })),
    context: async (next) => {
      book = { ...book, ...next };
      await act(async () => renderer.update(React.createElement(Owner)));
    },
    tick: async (elapsed = 1000) =>
      act(async () => {
        now += elapsed;
        [...intervals.values()].forEach((fn) => fn());
      }),
    receive: async (content) =>
      act(async () =>
        Socket.instances.at(-1).receive({ serverContent: content }),
      ),
  };
}

test("double-start is serialized and ending during permission does not open the mic", async () => {
  const e = environment(),
    permission = deferred();
  e.setPermission(() => permission.promise);
  await e.mount();
  await e.start();
  await e.start();
  assert.equal(e.events.permissions, 1);
  await act(async () => e.voice.stop());
  await act(async () => permission.resolve({ granted: true }));
  assert.equal(e.events.initializes, 0);
  assert.equal(e.events.recording, false);
  assert.equal(e.voice.phase, "off");
  await e.unmount();
});

test("the permission dialog backgrounding the app is not leaving the book", async () => {
  const e = environment(),
    permission = deferred();
  e.setPermission(() => permission.promise);
  await e.mount();
  await e.start();
  await e.background();
  assert.equal(e.voice.phase, "connecting");
  assert.deepEqual(e.events.errors, []);
  await e.foreground();
  await act(async () => permission.resolve({ granted: true }));
  await e.ready();
  assert.equal(e.voice.phase, "listening");
  assert.equal(e.events.recording, true);
  assert.deepEqual(e.events.errors, []);
  await e.unmount();
});

test("navigation during native initialization tears down late resources", async () => {
  const e = environment(),
    initialization = deferred();
  e.setInitialize(() => initialization.promise);
  await e.mount();
  await e.start();
  await e.background();
  await act(async () => initialization.resolve(true));
  assert.equal(e.events.recording, false);
  assert.equal(e.voice.phase, "paused");
  assert.equal(e.Socket.instances.length, 0);
  await e.unmount();
});

test("rerender/sidebar visibility leaves call alive; mute blocks input but keeps output", async () => {
  const e = environment();
  await e.mount();
  await e.start();
  await e.ready();
  await e.render();
  assert.equal(e.voice.microphoneActive, true);
  assert.equal(e.Socket.instances.length, 1);
  await act(async () => e.voice.toggleMute());
  assert.equal(e.events.recording, false);
  assert.equal(e.voice.microphoneActive, false);
  const sent = e.ws.sent.length;
  await e.emit("onMicrophoneData", Uint8Array.of(1, 2));
  assert.equal(e.ws.sent.length, sent);
  await e.receive({
    modelTurn: {
      parts: [
        {
          inlineData: {
            data: Buffer.alloc(640).toString("base64"),
            mimeType: "audio/pcm;rate=16000",
          },
        },
      ],
    },
  });
  assert.ok(e.events.played > 0);
  assert.equal(e.voice.phase, "speaking");
  assert.equal(e.voice.microphoneActive, false);
  await act(async () => e.voice.toggleMute());
  assert.equal(e.events.recording, true);
  await e.unmount();
  assert.equal(e.events.recording, false);
  assert.equal(e.ws.readyState, 3);
});

test("background pauses without auto-resume; explicit resume opens a fresh connection", async () => {
  const e = environment();
  await e.mount();
  await e.start();
  await e.ready();
  const old = e.ws;
  await e.background();
  assert.equal(old.readyState, 3);
  assert.equal(e.voice.phase, "paused");
  await e.foreground();
  assert.equal(e.events.recording, false);
  await e.start();
  await e.ready();
  assert.equal(e.Socket.instances.length, 2);
  assert.equal(e.events.recording, true);
  old.receive({ serverContent: { inputTranscription: { text: "stale" } } });
  assert.equal(e.events.questions.length, 0);
  await e.unmount();
});

test("context is bounded, deduplicated, frozen per question, and scoped to one book", async () => {
  const e = environment();
  await e.mount();
  await e.start();
  await e.ready();
  const initial = e.ws.sent.length;
  await e.tick();
  assert.equal(e.ws.sent.length, initial);
  await e.context({ page: 2, excerpt: "Second paragraph" });
  await e.tick();
  await e.receive({ inputTranscription: { text: "Explain this" } });
  await e.context({ page: 3, excerpt: "Third paragraph" });
  await e.tick();
  await e.receive({
    outputTranscription: { text: "Answer" },
    turnComplete: true,
  });
  assert.equal(e.events.questions[0].context.page, 2);
  assert.equal(e.events.turns[0].context.page, 2);
  await e.context({ docKey: "b".repeat(64), page: 10 });
  const count = e.ws.sent.length;
  await e.tick();
  assert.equal(e.ws.sent.length, count);
  assert.equal(e.voice.phase, "off");
  assert.equal(e.events.recording, false);
  const message = e
    .load("src/services/realtime.ts")
    .liveContextMessage({ docKey: "a", page: 1, excerpt: "x".repeat(9000) });
  assert.equal(message.clientContent.turnComplete, false);
  assert.equal(
    JSON.parse(
      message.clientContent.turns[0].parts[0].text.slice(
        "READING_CONTEXT ".length,
      ),
    ).passage.length,
    4000,
  );
  await e.unmount();
});

test("inactivity ends the connection and releases all timers on unmount", async () => {
  const e = environment();
  await e.mount();
  await e.start();
  await e.ready();
  await e.tick(300001);
  assert.equal(e.voice.phase, "off");
  assert.equal(e.events.recording, false);
  assert.equal(e.ws.readyState, 3);
  await e.unmount();
  assert.equal(e.intervals.size, 0);
  assert.equal(e.timeouts.size, 0);
});

test("native interruption pauses, and denied permission never creates a socket", async () => {
  const e = environment();
  e.setPermission(async () => ({ granted: false }));
  await e.mount();
  await e.start();
  assert.equal(e.Socket.instances.length, 0);
  assert.equal(e.events.recording, false);
  e.setPermission(async () => ({ granted: true }));
  await e.start();
  await e.ready();
  await e.emit("onAudioInterruption", "began");
  assert.equal(e.voice.phase, "paused");
  assert.equal(e.events.recording, false);
  await e.unmount();
});

test("embedded reflow script parses and reports a bounded visible passage", () => {
  const source = fs.readFileSync(
    path.join(root, "src/components/reader/PdfReflowView.tsx"),
    "utf8",
  );
  const begin = source.indexOf("  /* One bounded visible passage");
  const end = source.indexOf("  /* ---- report reading position", begin);
  const script = vm.runInNewContext("`" + source.slice(begin, end) + "`");
  const messages = [];
  const block = {
    innerText: "x".repeat(6000),
    getBoundingClientRect: () => ({ top: 100, bottom: 400 }),
  };
  const section = {
    children: [block],
    getBoundingClientRect: block.getBoundingClientRect,
    getAttribute: () => "4",
  };
  vm.runInNewContext(
    script + "\nreportVisibleContext();reportVisibleContext();",
    {
      document: { querySelectorAll: () => [section] },
      innerHeight: 800,
      window: { addEventListener: () => {} },
      post: (m) => messages.push(m),
      setTimeout,
      clearTimeout,
    },
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].page, 4);
  assert.equal(messages[0].text.length, 4000);
});

test("stopping during socket setup cancels its timer and ignores late setup", async () => {
  const e = environment();
  await e.mount();
  await e.start();
  const ws = e.ws;
  await act(async () => e.voice.stop());
  await act(async () => ws.receive({ setupComplete: {} }));
  assert.equal(e.events.recording, false);
  assert.equal(e.timeouts.size, 0);
  assert.equal(e.voice.phase, "off");
  await e.unmount();
});

test("same-book unmount leaves a resumable marker without native resources", async () => {
  const e = environment();
  await e.mount();
  await e.start();
  await e.ready();
  await e.unmount();
  assert.equal(e.events.recording, false);
  await e.mount();
  assert.equal(e.voice.phase, "paused");
  assert.equal(e.events.recording, false);
  await e.start();
  await e.ready();
  assert.equal(e.events.recording, true);
  await e.unmount();
});

test("the process-wide lease excludes dictation and other voice owners", async () => {
  const e = environment();
  const lease = e.load("src/utils/audio-session.ts");
  const dictation = Symbol("other recorder");
  assert.equal(lease.acquireAudioSession(dictation), true);
  await e.mount();
  await e.start();
  assert.equal(e.events.permissions, 0);
  lease.releaseAudioSession(dictation);
  await e.start();
  await e.ready();
  assert.equal(lease.acquireAudioSession(dictation), false);
  await e.unmount();
  assert.equal(lease.acquireAudioSession(dictation), true);
  lease.releaseAudioSession(dictation);
});
