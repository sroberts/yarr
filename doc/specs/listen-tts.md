# Shape: Listen to Article (on-device TTS)

> Design brief (`/impeccable shape`) for #76. Planning only — no code until approved.
> Anchored to PRODUCT.md (local-first, no telemetry; read without distraction) and
> the accessibility section (keyboard-first, respects reduced-motion).

## 1. Feature summary
A "Listen" control that reads the current article aloud using the browser's
**on-device** Web Speech API (`speechSynthesis`) — no network, no accounts, no
audio ever leaving the device. Turns reading into listening for hands/eyes-busy
moments and adds a real accessibility path.

## 2. Primary user action
Press Listen (or a keyboard shortcut) and have the open article read aloud, with
pause/resume; in triage, optionally continue into the next card.

## 3. Design direction
- **Color strategy:** Restrained — one toolbar control matching the existing icon
  buttons; the accent only marks the active/playing state.
- **Scene sentence:** *Someone cooking or commuting, phone down, listening to the
  article they'd otherwise have to read.* → follows theme.
- **Anchor references:** Safari "Listen to Page", Pocket's listen mode, iOS Speak
  Screen. Utilitarian, not a media-player spectacle.

## 4. Scope
Production-ready. Breadth: the article reading toolbar + a minimal playing state;
plus a triage-mode hook. Interactivity: shipped component. Graceful degradation
where `speechSynthesis` is unavailable.

## 5. Layout strategy
- A **Listen** icon button in the article toolbar (next to Read-Here / Instapaper),
  same size/vocabulary as its neighbors.
- Playing state: the button toggles to a pause/stop glyph and takes the accent
  "active" treatment (reuse `.toolbar-item.active`). No separate transport bar in
  v1 — one toggle button; press again to pause/resume, and stop on close/next.
- Optional quiet indicator that TTS is active (e.g., the button pulsing subtly —
  gated by reduced-motion).

## 6. Key states
- **Idle / supported:** Listen button visible and enabled.
- **Unsupported browser** (`!('speechSynthesis' in window)`): hide the control
  entirely (no dead button) — progressive enhancement.
- **Playing:** button shows pause; article scrolls to keep the spoken sentence in
  view? (v2 — see open questions). v1: no auto-scroll.
- **Paused:** button shows resume.
- **Ended / article closed / navigated away:** speech stops and resets (must cancel
  `speechSynthesis` on unmount/close — no audio bleeding across articles).
- **Reduced motion:** any active-pulse animation is disabled; audio is unaffected.

## 7. Interaction model
- Click Listen → strip the article to plain text (reuse readability/`ExtractText`
  output) and feed it to `speechSynthesis.speak(utterance)`.
- Click again → pause; again → resume (`speechSynthesis.pause/resume`).
- Keyboard: extend the existing shortcut map — a mnemonic like **`p`** (play) is
  free; document it in the `?` modal. Esc/close/next stops speech.
- **Triage mode:** on card open, Listen reads the card; on finishing or manual
  advance, optionally auto-listen the next card (off by default — a setting).
- Cancel speech on: article close, navigation (j/k/next/prev), triage exit, and
  component unmount. This is the main correctness risk — centralize stop().

## 8. Content requirements
- Source text: the sanitized/extracted article text (no markup read aloud). Skip
  code blocks / URLs where feasible (they read terribly) — at least don't read raw
  HTML.
- Copy: button title "Listen" / "Pause"; `?`-modal row ("`p` — listen / pause");
  no other UI text.
- Voice/rate: use the platform default voice; expose rate later if requested.
- Ranges: very short items (a sentence) to longreads (many minutes) — must handle
  both; chunk long text if a browser caps utterance length.

## 9. Technical notes & constraints
- **Pure client, on-device.** Web Speech `speechSynthesis` — zero network, zero
  deps, zero telemetry. Nothing server-side; no Go changes.
- Chunk long articles into sentence/paragraph utterances (some engines truncate a
  single long utterance) and queue them so pause/resume/stop work cleanly.
- Feature-detect and hide when unavailable; iOS Safari requires a user gesture to
  start (the button click satisfies this).
- Respect `prefers-reduced-motion` for any visual pulse only.

## 10. Recommended references
`harden.md` (cancel-on-navigate correctness, unsupported/degrade, long-text
chunking), `animate.md` (the restrained active indicator), `clarify.md` (button +
shortcut copy).

## Open questions (defaults asserted)
- **Auto-advance in triage:** off by default, opt-in setting. *Asserted.*
- **Sentence-follow auto-scroll / highlight:** v2, not v1 (adds complexity). *Asserted.*
- **Voice/rate controls:** default voice only in v1; add a rate control if users ask.
  *Asserted.*
- **Shortcut key:** `p` for play/pause (free in the current map). *Asserted; confirm
  no future conflict.*
