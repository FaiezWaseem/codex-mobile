# Codex Mobile App

Codex is an Expo React Native mobile app for chatting with a relay-backed Codex assistant on mobile.

The app has moved beyond a UI-only prototype. It now includes live relay chat, persisted sessions, streaming responses, image attachments, model switching, local chat history, and a richer mobile chat experience.

## Current progress

What is working today:

- Relay-backed chat using the configured base URL and bearer token
- Streaming chat responses via the OpenAI SDK client
- Home chat plus saved multi-session chat threads
- Task list with saved thread history
- Delete chat flow with relay session cleanup
- Image attachment picking and upload through the relay
- Image rendering in chat bubbles
- Markdown-style chat bubble rendering
- Copy-to-clipboard and timestamps on messages
- In-chat model switching
- Cached Codex usage panel in settings
- Light and dark theme support
- Branded splash screen

## Tech stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- React Navigation
- Gorhom Bottom Sheet
- React Native Reanimated
- React Native Gesture Handler
- Expo SQLite
- Expo Image Picker
- Expo Clipboard
- OpenAI JavaScript SDK

## Key features

### Relay chat

- Configured through a relay `baseUrl` and `bearerToken`
- Uses `x-session-id` to maintain conversation continuity
- Streams assistant replies in chat
- Supports image input on chat turns

### Chat sessions

- Default home chat session
- New chat creates a distinct session id
- Session history is stored locally in SQLite
- Saved chats appear in the task list
- Long-press a saved chat to delete it

### Message experience

- Assistant bubbles render markdown-like formatting
- Links are tappable
- Images can render inline
- Each message shows a timestamp
- Each message can be copied to clipboard

### Attachments

- Pick images from the media library
- Upload images to the relay through `/v1/uploads`
- Send uploaded images back to the chat API as image content parts
- Persist attachment metadata with chat history

### Model switching

Available in the composer:

- `gpt-5.5`
- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.3-codex`
- `gpt-5.2`

The selected model is persisted with the app config and reused on future requests.

### Settings and usage

- Theme switching: `system`, `light`, `dark`
- Agent configuration management
- Cached usage snapshot from `/v1/usage`
- Refreshes from live relay data after loading cache

## Project structure

```text
src/
  components/      Reusable UI building blocks
  config/          App config persistence
  data/            Mock task/profile data still used in some surfaces
  hooks/           Relay chat logic and chat state
  navigation/      App navigator, routes, and nav theme
  screens/         App screens
  storage/         SQLite persistence for chat sessions
  theme/           Theme provider and design tokens
  AppShell.tsx     App-level theme/config bridge
  types.ts         Shared app types
docs/
  codex.md         Relay integration notes and API examples
```

## Main screens

### Home

- Main assistant chat screen
- Saved-session aware
- Attachment picker
- Model picker in composer

### Tasks

- Saved chat thread list
- Pull to refresh
- FAB for a fresh chat
- Long-press delete confirmation bottom sheet

### Task detail

- Task summary UI plus relay-backed chat thread
- Uses its own task session id

### Settings

- Bottom sheet presentation
- Cached Codex usage card
- Theme switcher
- Agent config entry point

### Splash

- Branded startup experience shown while config boots

## Configuration

The app expects:

- Relay base URL
- Relay bearer token

These are saved locally with AsyncStorage.

The app normalizes config by:

- trimming the base URL
- removing trailing slashes
- trimming the bearer token
- defaulting the model to `gpt-5.4-mini`

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

## Useful commands

Type-check the app:

```bash
npx tsc --noEmit
```

If Metro gets confused after dependency changes:

```bash
npx expo start --clear
```

## Useful files

- [App.tsx](/abs/c:/Users/Faiez/development/test/codex/App.tsx)
- [src/AppShell.tsx](/abs/c:/Users/Faiez/development/test/codex/src/AppShell.tsx)
- [src/navigation/AppNavigator.tsx](/abs/c:/Users/Faiez/development/test/codex/src/navigation/AppNavigator.tsx)
- [src/hooks/useRelayChat.ts](/abs/c:/Users/Faiez/development/test/codex/src/hooks/useRelayChat.ts)
- [src/screens/HomeScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/HomeScreen.tsx)
- [src/screens/TasksScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/TasksScreen.tsx)
- [src/screens/TaskDetailScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/TaskDetailScreen.tsx)
- [src/screens/SettingsScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/SettingsScreen.tsx)
- [src/screens/SplashScreen.tsx](/abs/c:/Users/Faiez/development/test/codex/src/screens/SplashScreen.tsx)
- [src/components/ChatMessageBubble.tsx](/abs/c:/Users/Faiez/development/test/codex/src/components/ChatMessageBubble.tsx)
- [src/components/Composer.tsx](/abs/c:/Users/Faiez/development/test/codex/src/components/Composer.tsx)
- [src/storage/chatDb.ts](/abs/c:/Users/Faiez/development/test/codex/src/storage/chatDb.ts)
- [docs/codex.md](/abs/c:/Users/Faiez/development/test/codex/docs/codex.md)

## Current status

This repo is now a working mobile relay client with live chat behavior and persisted conversation UX, not just a static prototype.

There is still room to harden and polish:

- better message rendering depth
- richer attachment states and upload progress
- improved mobile image auth/render edge cases
- more task data coming from backend instead of mock data
