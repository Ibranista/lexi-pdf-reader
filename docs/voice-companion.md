# Voice companion

The PDF reader owns a keyed `LexiSheet` for the document's lifetime. Its `open`
prop controls only the sidebar. Hidden sessions render `VoiceController`; idle
sessions render the expandable assistant menu. The demo reader has no document
and does not open a live connection.

`useRealtimeVoice` tracks off, connecting, listening, thinking, speaking, and
paused, plus a separate muted flag. A process-wide audio lease prevents live
voice and dictation from acquiring the microphone together. Cancelling an async
start invalidates its generation before cleanup; a late native initialization
must finish cleanup before another owner can start.

Reader blur, app background, native interruption, or unmount stops recording,
closes the socket, removes the audio listener, flushes queued playback, and tears
down native audio. Return never automatically enables the microphone. A same-book
resume marker expires after five minutes; Resume establishes a fresh transport
and the backend restores bounded prior conversation history. Five minutes with
no speech/reply/control activity ends an active call too.

Reflow reports paragraphs in the visible portion of its most visible PDF page
450 ms after scrolling settles. The reader debounces its context for 500 ms
(150 ms for selection), keeps at most 4,000 current characters plus 1,000 recent
characters, and prefers selection over visible text. Native PDF mode has no
viewport paragraph offsets, so it explicitly uses page text. These are bounded
`clientContent` updates with `turnComplete: false`, not new model requests.
A turn freezes the last context sent to the model, and its source quote appears
in chat and the floating controller. Scanned pages without extracted text are
reported as unavailable, not filled with guessed text.

Voice preference is persisted in the existing MMKV app settings. Catalog data
comes from authenticated `GET /v1/ai/voices`; previews play only saved files.
The cache hashes versioned URLs and writes complete downloads before playback.
New preview requests, language changes, drawer close, route blur, and app
background cancel pending playback intent and stop the previous preview.

## Verification

- `pnpm test:voice`: React lifecycle tests with mocked native audio and WebSockets.
- Run TypeScript and lint on changed files; the repository currently has unrelated
  type failures in legacy theme/atom components and old test imports.
- On Android and iOS development builds: start voice, close chat, scroll, mute
  during a response, reopen chat, leave/return, and switch books. Verify the OS
  recording indicator goes out when leaving, while muting retains output.
- Deny permission, background while permission/connection setup is pending,
  interrupt with a phone call, disconnect the network, and wait five idle minutes.
- Check drag bounds, large text and screen-reader controls in portrait/landscape.
- Preview all available languages, switch rapidly while downloading, close settings
  by swipe/back, and confirm played samples work offline.

Native-device checks require a running development build and were not automated
by the unit tests. Deploy the backend metadata route and `public/voices` assets
alongside this app change; see the backend's `docs/voice-previews.md`.
