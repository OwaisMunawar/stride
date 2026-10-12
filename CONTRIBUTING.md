# Contributing

Thanks for taking a look. Stride is small enough to read in an afternoon; [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) is the map.

## Setup

```sh
npm ci
cp .env.example .env.local     # EXPO_PUBLIC_DEMO=1 seeds fictional runs
npx expo run:ios               # or run:android; Expo Go cannot run background location or widgets
```

## Before opening a pull request

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
```

CI runs the same commands, then builds the iOS simulator app and the Android debug APK.

## Ground rules

- Domain code under `src/**/lib/` stays free of React and native imports (ESLint enforces it). If a change needs the platform, put it behind an interface in `composition/`.
- Anything that changes distance, time, splits or pace needs a test on a synthetic track, preferably a property test.
- Migrations are append-only. Never edit a shipped one.
- No new network calls. The privacy section of the README is a promise; ESLint guards it.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `ci:`, `chore:`).

## Testing on a simulator without going outside

- Demo builds show **Simulate a 5 km run at 10x**, which replays a bundled GPX through the real pipeline.
- iOS: `xcrun simctl location <device> start --speed=3.2 <lat,lon> <lat,lon> ...` feeds waypoints to the real GPS path, including in the background.
- Android: the emulator's Extended controls > Location can play a GPX or KML route.
