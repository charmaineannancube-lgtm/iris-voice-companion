# Iris Voice Companion

# Iris — Full Build Prompt (v2)

> Naming note: we moved off "Pinkk" and off "Jarvis" — Jarvis is a registered Marvel trademark (Class 9, personal-digital-assistant software) and Marvel has issued cease-and-desists over it before (it's why Jarvis.ai had to rebrand to Jasper). **Iris** is unowned and free to use. Swap the name throughout if you'd rather use Nova, Vale, Solace, or Echo — the rest of the spec doesn't change.

---

## Copy/paste prompt for your coding assistant

```

You are an expert robotics/AI engineer and software architect. Design and

generate a complete build plan for a personal voice assistant named "Iris."

Iris should feel like a polished, humanoid-presented assistant with reliable

voice interaction, smart automation, a modular skills system, and an animated

on-screen presence (not just a status widget).

TARGET PLATFORM (fixed — do not ask):

- OS: Windows 10/11

- Activation: wake word ("Hey Iris" default, user-configurable), with

  push-to-talk as a fallback/override

- Hardware: standard consumer PC, one mic, one speaker/headset

- Interface: a humanoid avatar UI (2D animated character minimum viable,

  3D/rigged as a stretch goal) that visibly listens, thinks, and speaks —

  not a static waveform or spinner

- Avatar behavior on activation: the avatar is NOT permanently on-screen at

  full presence. At idle it stays minimal/hidden (a small tray icon, a

  faint glow, or fully absent). The instant the wake word is detected, the

  avatar "builds" itself onto the screen — a deliberate assemble-in/

  materialize animation (e.g. particles converging, a fade-and-scale-up,

  or a construct-line-by-line effect), landing in its listening pose within

  under ~500ms of wake-word detection. This build-in animation is a first-

  class requirement, not a nice-to-have.

- Color palette: dark pink and black throughout the entire UI — avatar,

  dashboard, logs, buttons, backgrounds. Background should be near-black,

  with dark/deep pink (not pastel/light pink) as the primary accent for

  the avatar's glow, active states, highlights, and interactive elements.

  No other accent colors unless needed for critical states (e.g. a red or

  amber tint reserved only for error/warning states, everything else stays

  pink-on-black).

======================================================================

1) CORE GOALS

======================================================================

Iris must:

- Detect the wake word continuously in the background with low CPU overhead,

  and support push-to-talk as an override.

- Listen, transcribe speech accurately, preferring local/offline STT.

- Understand intent via an LLM (local or cloud — choose the best option for

  Windows consumer hardware and justify the choice).

- Execute actions via a structured "skills" framework (timers, reminders,

  smart home, web search, notes, opening apps/files).

- Speak responses with high-quality TTS, synced to avatar mouth movement.

- Maintain conversation context and user preferences (lightweight memory).

- Drive a humanoid avatar with distinct visual states: idle, listening,

  thinking, speaking, error, muted.

- Show a small dashboard alongside the avatar: current state, last

  transcript, last response, a scrollable log, and skill toggles.

- Log all activity with privacy controls (configurable retention, redaction

  of sensitive fields, one-click "clear my data").

======================================================================

2) ENVIRONMENT & CONSTRAINTS

======================================================================

- OS: Windows 10/11 only for v1. Note anything that would block macOS/Linux

  portability later, but don't build for it now.

- Runs as a normal user app in dev; document how it could become a background

  service via Task Scheduler or NSSM for "always listening" mode.

- Budget: assume low-to-medium — prefer free/open-source components; call

  out paid API usage explicitly and give an offline fallback for each.

- Privacy: local processing preferred for STT/wake-word; cloud LLM allowed

  if justified, but must be swappable for a local model (e.g. via Ollama).

======================================================================

3) REQUIRED ARCHITECTURE

======================================================================

Produce a full architecture covering:

- Audio pipeline: mic input → wake-word detector → VAD → STT → intent/LLM

  → tool execution → response text → TTS → audio output, with the avatar

  state machine wired to each stage

- LLM "brain": intent handling + tool/function calling

- Skills/tool system: tool schemas, registry, permission levels

- State/memory: conversation context, user settings, persisted reminders/notes

- Orchestrator: event-driven command handling (async event bus, not polling)

- Avatar/UI layer: state machine (idle/listening/thinking/speaking/error),

  animation triggers, lip-sync approach, and the dashboard (status, logs,

  transcript, settings, skill enable/disable)

- Config system: environment variables + a YAML/JSON config file, including

  wake-word sensitivity, voice selection, and avatar style

======================================================================

4) IMPLEMENTATION REQUIREMENTS

======================================================================

Provide:

- A recommended tech stack for Windows (Python preferred unless you justify

  another choice), including which libraries handle wake-word detection,

  STT, TTS, and the avatar rendering (e.g. a local web view with an

  animated SVG/Lottie/rigged sprite, or a lightweight game-engine-style

  renderer — pick one and justify it)

- A full directory structure for the project

- A requirements.txt / dependency list, Windows-specific notes included

  (e.g. PyAudio wheel issues, driver requirements)

- A complete config template with inline explanations

- Step-by-step build instructions:

  - Installation on Windows

  - Running locally (dev mode)

  - Packaging/production steps (running at startup, background service,

    auto-restart on crash)

- Example code for:

  - Wake-word detection (continuous listening, low false-positive rate)

  - STT integration

  - TTS integration with viseme/phoneme timing data for lip-sync

  - One LLM tool call end-to-end ("set a timer")

  - One smart-home skill (Home Assistant REST call, or a generic adapter

    if the user doesn't have Home Assistant)

  - Avatar state transitions driven by pipeline events

  - Dashboard status updates (live, not polled on a slow interval)

- Logging: structured JSON logs, clear error-handling strategy

- Safety:

  - Restrict dangerous actions (file deletion, purchases, system commands)

    behind an explicit confirmation step

  - Always allow "stop"/interrupt while Iris is speaking, mid-sentence

  - Never execute an action skill silently if it has irreversible effects

======================================================================

5) FEATURE SET — BUILD IN THIS ORDER

======================================================================

1. Wake word ("Hey Iris") + push-to-talk fallback

2. Conversation loop (user speaks → Iris responds), with avatar animating

   through listening → thinking → speaking

3. Timer skill ("Iris, set a timer for 5 minutes")

4. Notes skill ("Iris, remember that... / write a note...")

5. Smart home hooks (Home Assistant if available; otherwise a generic

   abstract adapter with one working example, e.g. a REST-controlled plug)

6. Web search tool, with clearly scoped boundaries (read-only, no purchases,

   no form submission without confirmation)

7. Reminders, persisted locally, with due-time notifications

8. Dashboard: current state, last transcript, last response, log view,

   skill enable/disable toggles

9. Humanoid avatar: hidden/idle state, a "build-in" materialize animation

   that triggers the instant the wake word fires, listening pose, "thinking"

   pose, talking animation synced to TTS output, a distinct error pose, and

   a reverse dissolve/hide animation on timeout or sleep — all rendered in

   a dark pink + black color theme (near-black background, deep pink as the

   primary accent, no unrelated accent colors except for error states)

======================================================================

6) TOOL / SKILL DESIGN

======================================================================

- Define each tool with a JSON schema (name, description, parameters,

  required confirmation: yes/no)

- Build a skills registry that's easy to extend (new skill = new file +

  one registration line, not a core-code edit)

- Build a permission system: tools tagged "safe" run without confirmation;

  tools tagged "sensitive" require a spoken or on-screen confirmation

- Give 3–5 example user utterances mapped to the correct tool call for each

  skill above, to serve as the model's few-shot grounding

======================================================================

7) HUMANOID INTERFACE SPEC

======================================================================

- Define the avatar as a state machine with these states at minimum:

  hidden/idle, building (wake-word just detected, avatar materializing),

  listening, thinking, speaking, error, muted/asleep

- Specify how state transitions are triggered by pipeline events: wake-word

  detected → building (materialize animation plays) → listening once the

  build-in completes; STT complete → thinking; TTS starts → speaking; a

  timeout or explicit "go to sleep" returns it to hidden/idle, playing a

  reverse/dissolve version of the build animation on the way out

- Specify the exact build-in animation approach for the wake-word moment

  (e.g. CSS/SVG particle converge, scale-and-fade, line-draw reveal) and

  keep it under ~500ms so it reads as responsive, not sluggish

- Color system: define CSS variables/tokens for a dark pink + black theme

  (e.g. background near-black, primary accent a deep/dark pink, secondary

  a slightly muted pink-grey for less prominent text, error state the only

  non-pink accent). Apply these tokens consistently across the avatar glow,

  dashboard chrome, buttons, and log view — no unrelated accent colors.

- Specify the lip-sync approach: either phoneme/viseme timestamps from the

  TTS engine mapped to mouth-shape frames, or a simpler amplitude-driven

  mouth-open approximation if the TTS engine doesn't expose visemes —

  pick one, justify it, and note the visual quality trade-off

- Specify the rendering approach: a local web view (HTML/CSS/JS or a

  lightweight animation library) is the pragmatic default for a v1; note

  what a native/3D-rigged upgrade path would require later

- The avatar and the dashboard should coexist in one window, not two

  separate apps

======================================================================

8) OUTPUT FORMAT REQUIREMENTS

======================================================================

Your response must include:

- A system architecture diagram (ASCII is fine)

- A detailed, numbered step-by-step build plan

- Code scaffolding: key files with sample contents

- Milestones with acceptance criteria for each stage

- A "known issues & troubleshooting" section (Windows-specific gotchas:

  mic permissions, PyAudio install pain, wake-word false positives, etc.)

- A "next upgrades after MVP" section (e.g. 3D avatar, multi-user voice

  profiles, on-device LLM upgrade path)

======================================================================

9) STYLE FOR IRIS'S RESPONSES

======================================================================

- Friendly, concise, confident — not overly robotic

- Natural language, minimal filler

- Occasional short status lines while working ("Setting that timer now,"

  "Still thinking...") so the user isn't left wondering if it heard them

- No baby-talk, no excessive emoji — a couple of light touches are fine,

  not a personality overload

Now produce the full architecture + build plan as requested. Do not ask

clarifying questions — every input needed (OS, activation method, hardware

assumption, name) is already fixed above. If something genuinely can't be

decided from this brief (e.g. exact wake-word engine choice), pick the best

default and state your reasoning in one line, then continue.

```

---

## What changed from the last version

- **Name**: Pinkk → **Iris** (Jarvis is a live Marvel trademark, worth avoiding for anything you might ever ship or share publicly)

- **OS/activation locked in**: Windows, wake word + push-to-talk fallback — the prompt no longer stops to ask, so your coding assistant can go straight to a plan

- **Section 7 (humanoid interface)**: state machine, lip-sync approach, and rendering strategy, so the avatar isn't an afterthought bolted onto the dashboard

- **Wake-word "build-in" behavior**: the avatar now stays hidden/minimal at idle and plays a deliberate materialize animation the instant the wake word is detected (under ~500ms), landing in its listening pose — this is now a first-class requirement in both the core goals and the interface spec, not just a passive on-screen avatar

- **Color palette locked in**: dark pink + black across the entire UI (avatar, dashboard, logs, buttons) — near-black background, deep pink as the sole primary accent, no stray colors except a reserved tint for error states

- **Milestone 9** updated to include the build-in and sleep/dissolve animations alongside the existing avatar states

## Still worth deciding before you run this

- **Local vs. cloud LLM**: local (via something like Ollama) keeps everything private and free but needs decent hardware; cloud is faster to stand up and higher quality but costs money and sends audio transcripts off-device

- **Home Assistant**: do you already run it, or should the plan default to the generic REST adapter?

- **Avatar fidelity for v1**: a 2D animated sprite/SVG is much faster to ship than a 3D rigged character — worth starting there and upgrading later

If you tell me where you land on those three, I can tighten the prompt further before you hand it to a coding assistant.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e4ce7ecd-791c-4e13-afbe-a3f3202de3a4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
