# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-12

### Added

- Run and ride recording with start, pause, resume and long-press finish.
- Background location on iOS (`UIBackgroundModes: location`) and Android (foreground service with a persistent notification), with a two-step permission flow and rationale screen.
- Processing pipeline: outlier gate with re-anchoring, constant-velocity Kalman filter, auto-pause with hysteresis and three sensitivities, per-km and per-mile splits, rolling pace, elevation gain with a dead band, calorie estimates.
- Recording state machine as a pure reducer; crash and reload recovery by replaying stored commands and fixes.
- Live map on MapLibre with OpenFreeMap tiles; pace-coloured route with start and end markers on the detail screen.
- iOS Live Activity with Dynamic Island via expo-widgets: moving time (native timer), distance, current pace and pause state.
- History with Skia route thumbnails, weekly totals, a seven-day chart and the current streak.
- Run detail with stats, splits table, Skia pace and elevation charts, and the coach card.
- Coach with three providers behind one interface: rule-based (default), Apple Foundation Models on device, and an OpenAI-compatible server through the AI SDK, all validated by one zod schema with rule-based fallback.
- GPX 1.1 export through the share sheet and GPX import through the same pipeline as a recording.
- Settings for units, auto-pause sensitivity, coach provider, weight and split haptics, plus a privacy section.
- Demo mode with ten fictional sessions and a bundled 5 km GPX replayed at 10x.
- CI: format, lint, typecheck, tests with a 90% coverage gate, expo-doctor, iOS simulator build and Android debug build.
