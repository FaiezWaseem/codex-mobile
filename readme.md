# Codex Mobile App

Codex is an Expo React Native mobile app prototype inspired by the attached reference UI.  
Phase 1 focuses on polished interface work with mock data. Phase 2 is intended for backend integration.

## Current scope

This project currently includes:

- Home assistant screen
- Tasks list screen
- Task detail screen
- Settings bottom sheet
- Light and dark theme support
- React Navigation native stack setup
- `@gorhom/bottom-sheet` integration for settings
- Mock data for profile, capabilities, and tasks

## Tech stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- React Navigation
- Gorhom Bottom Sheet
- React Native Reanimated
- React Native Gesture Handler

## Project structure

```text
src/
  components/      Reusable UI components
  data/            Mock data for Phase 1
  navigation/      Navigation types, routes, theme, navigator
  screens/         App screens
  theme/           Theme provider and design tokens
  AppShell.tsx     App-level theme to navigator bridge
  types.ts         Shared app types
```

## Screens

### 1. Home

- Greeting hero
- Suggested capability chips
- Fixed header
- Fixed bottom composer

### 2. Tasks

- Task history list
- Avatar shortcut to settings
- Floating action button back to the chat flow

### 3. Task detail

- Fixed header
- Prompt summary card
- Task result summary
- Fixed bottom composer

### 4. Settings

- Built with `@gorhom/bottom-sheet`
- Theme mode switcher: `system`, `light`, `dark`
- Safe-area aware bottom padding for edge-to-edge Android devices

## Navigation

Navigation lives in [src/navigation](/abs/c:/Users/Faiez/development/test/codex/src/navigation).

Key files:

- [src/navigation/AppNavigator.tsx](/abs/c:/Users/Faiez/development/test/codex/src/navigation/AppNavigator.tsx)
- [src/navigation/types.ts](/abs/c:/Users/Faiez/development/test/codex/src/navigation/types.ts)
- [src/navigation/routes.ts](/abs/c:/Users/Faiez/development/test/codex/src/navigation/routes.ts)
- [src/navigation/navigationTheme.ts](/abs/c:/Users/Faiez/development/test/codex/src/navigation/navigationTheme.ts)

The app uses a native stack with these routes:

- `Home`
- `Tasks`
- `TaskDetail`
- `Settings`

## Theme system

Theme tokens live in [src/theme/tokens.ts](/abs/c:/Users/Faiez/development/test/codex/src/theme/tokens.ts).  
Theme state is handled by [src/theme/ThemeProvider.tsx](/abs/c:/Users/Faiez/development/test/codex/src/theme/ThemeProvider.tsx).

Supported modes:

- `system`
- `light`
- `dark`

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the project

```bash
npm start
```

Or run directly on a platform:

```bash
npm run android
npm run ios
npm run web
```

## Android notes

This app uses Reanimated, Gesture Handler, and Gorhom Bottom Sheet.  
For Expo SDK 54, compatible versions matter.

If Android throws runtime errors after dependency changes:

1. Stop Metro completely.
2. Run:

```bash
npx expo start --clear
```

3. Reopen the app.

If you are using a development build, also uninstall the app from the device/emulator and rebuild it.

## Verification

Type-check the app with:

```bash
npx tsc --noEmit
```

## Phase 2 direction

Planned backend integration areas:

- Authentication and profile
- Conversations and messages
- Tasks and task runs
- Preferences and connectors

See [docs/phase-plan.md](/abs/c:/Users/Faiez/development/test/codex/docs/phase-plan.md) for the current breakdown.

## Useful files

- [App.tsx](/abs/c:/Users/Faiez/development/test/codex/App.tsx)
- [src/AppShell.tsx](/abs/c:/Users/Faiez/development/test/codex/src/AppShell.tsx)
- [src/screens/HomeScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/HomeScreen.tsx)
- [src/screens/TasksScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/TasksScreen.tsx)
- [src/screens/TaskDetailScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/TaskDetailScreen.tsx)
- [src/screens/SettingsScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/SettingsScreen.tsx)

## Status

This repo is currently a UI-first prototype with mock data and production-style navigation/theme foundations.
