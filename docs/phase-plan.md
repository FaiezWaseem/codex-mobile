# Codex Mobile App Plan

## Phase 1: UI Prototype

Goal: ship a polished Expo React Native prototype with mock data only.

### Screen breakdown

1. Home / Assistant screen
   - Greeting hero with active workspace switcher (`MTC` / `Code`)
   - Capability chips for suggested actions
   - Composer area with add, mic, and primary action buttons
   - Entry points to settings and task history

2. Tasks list screen
   - Large "All tasks" heading
   - Recent task rows with category, workspace, and update time
   - Floating action button that starts a new assistant flow
   - Profile shortcut to settings

3. Task detail screen
   - Header with back, task title, and quick actions
   - Prompt card for the original request
   - Agent identity row and work duration
   - Summary section with deliverables
   - Sticky composer for follow-up prompts

4. Settings screen
   - Bottom sheet presentation
   - Profile block, plan badge, and edit button
   - Theme selector: `system`, `light`, `dark`
   - Rows for account, language, notifications, connectors, privacy, and logout

### Phase 1 component map

- `ThemeProvider`: resolves system theme and manual override
- `AppShell`: lightweight state navigation between prototype screens
- `Composer`: reusable input shell used on home and detail
- `TaskRow`: reusable task history item
- `SettingsRow`: reusable settings list item

## Phase 2: Backend Integration

Goal: replace mock data and local state with real services.

### Recommended backend modules

1. Auth and profile
   - Sign in, sign out, session refresh
   - User profile and subscription tier

2. Conversations
   - Create conversation
   - List conversations
   - Get conversation detail
   - Append message / stream assistant response

3. Tasks and runs
   - Start a task in `MTC` or `Code`
   - Track status, elapsed time, and outputs
   - Fetch task summaries and artifacts

4. Settings and preferences
   - Persist language
   - Persist theme override
   - Manage notification preferences
   - Manage connected tools / connectors

### Suggested data contracts

- `User`
- `Conversation`
- `Message`
- `Task`
- `TaskRun`
- `Preference`
- `Connector`

### Integration order

1. Add React Navigation for production routing.
2. Add a data layer with API clients and request hooks.
3. Replace mock task list and profile payloads.
4. Wire composer submission and streaming task detail updates.
5. Persist settings and restore them on app boot.
