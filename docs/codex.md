# HTTP Relay Usage Guide

## Base URL

- Local relay: `http://127.0.0.1:9856`
- Auth: send `Authorization: Bearer <relay-token>`

## Persistent image API key

For image generation and image edits, store the upstream OpenAI key here and restart the relay:

```dotenv
OPENAI_API_KEY=<your-openai-api-key>
```

File path:

- `/home/faiezwaseem-openclaw/.codex/plugins/http-relay/plugins/http-relay/data/relay.env`

## Core endpoints

- `GET /health`
- `GET /v1/status`
- `GET /v1/usage`
- `GET /v1/models`
- `GET /v1/docs`
- `GET /v1/image/:jobId`
- `GET /v1/image/:jobId/file`
- `POST /v1/chat`
- `POST /v1/image`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/images/generations`
- `POST /v1/images/edits`
- `POST /v1/approvals/:requestId`
- `POST /v1/sessions/:sessionId/interrupt`
- `DELETE /v1/sessions/:sessionId`

## Session behavior

- Reuse a session with `x-session-id`.
- The relay stores thread continuity per session id.
- For OpenAI-compatible routes, `x-session-id`, `sessionId`, `metadata.sessionId`, or `user` can drive reuse.
- Default execution mode is `danger-full-access`, so the relay should not normally pause for approval prompts.

## Async image jobs

This relay also supports a Codex-driven async image job endpoint. This path asks Codex to create and save a `.png` image file into the relay image directory.

Start a job:

```bash
curl -s -X POST http://127.0.0.1:9856/v1/image \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a kid running on the beach"
  }'
```

Check status:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:9856/v1/image/<job-id>
```

Fetch the generated file:

```bash
curl -L -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:9856/v1/image/<job-id>/file
```

Possible statuses:

- `queued`
- `processing`
- `completed`
- `failed`

## Model switching

Set `model` per request. Example values that worked on this relay:

- `gpt-5.4-mini`
- `codex-default` behavior when omitted on the local relay side

## Usage tracking

The relay exposes Codex usage and reset windows here:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:9856/v1/usage
```

Notes:

- By default this refreshes live from Codex app-server.
- Use `GET /v1/usage?refresh=0` to read the cached snapshot only.
- The response includes the account rate-limit snapshot plus cached per-session token usage seen during relay turns.

## Fetch the guide itself

You can fetch this Markdown guide from the relay:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:9856/v1/docs
```

## Chat Completions

Example:

```bash
curl -s -X POST http://127.0.0.1:9856/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-session-id: demo-chat" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [
      {"role": "system", "content": "Be concise."},
      {"role": "user", "content": "Summarize the current repo."}
    ]
  }'
```

## SSE streaming

The relay supports SSE for:

- `POST /v1/chat/completions` with `"stream": true`
- `POST /v1/responses` with `"stream": true`

`/v1/chat/completions` ends with `data: [DONE]`.

## Tool calling

Supported on the OpenAI-compatible routes:

- `POST /v1/chat/completions`
- `POST /v1/responses`

Behavior:

- The relay returns OpenAI-style tool calls.
- Your local client executes the tool.
- You send the tool result back on the next request.

Chat Completions tool-call example:

```bash
curl -s -X POST http://127.0.0.1:9856/v1/chat/completions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-session-id: tool-chat" \
  -d '{
    "model": "gpt-5.4-mini",
    "tool_choice": "required",
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_time",
          "description": "Get time for a timezone.",
          "parameters": {
            "type": "object",
            "properties": {
              "timezone": {"type": "string"}
            },
            "required": ["timezone"]
          }
        }
      }
    ],
    "messages": [
      {"role": "user", "content": "What time is it in UTC? Use the tool."}
    ]
  }'
```

Then send the tool result back:

```json
{
  "messages": [
    {"role": "user", "content": "What time is it in UTC? Use the tool."},
    {
      "role": "assistant",
      "tool_calls": [
        {
          "id": "call_...",
          "type": "function",
          "function": {
            "name": "get_time",
            "arguments": "{\"timezone\":\"UTC\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_...",
      "name": "get_time",
      "content": "2026-05-07T05:02:15Z"
    }
  ]
}
```

## Image generation

### Generate a new image

```bash
curl -s -X POST http://127.0.0.1:9856/v1/images/generations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "A small red kite over a beach",
    "size": "1024x1024"
  }'
```

### Edit an image with JSON references

```bash
curl -s -X POST http://127.0.0.1:9856/v1/images/edits \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "Turn the sky into sunset colors",
    "images": [
      {
        "image_url": "https://example.com/input.png"
      }
    ]
  }'
```

### Edit an image with multipart upload

```bash
curl -s -X POST http://127.0.0.1:9856/v1/images/edits \
  -H "Authorization: Bearer $TOKEN" \
  -F "model=gpt-image-1" \
  -F "prompt=Turn the sky into sunset colors" \
  -F "image=@./input.png"
```

## Important image note

The image routes are upstream OpenAI proxies. They require `OPENAI_API_KEY` in the relay process environment. They are not generated by the local Codex-backed text session itself.

## Approvals

The relay defaults to full access, so you should not normally hit this path. It only matters if you explicitly send a lower `permissionLevel` and want approval-handling behavior:

```bash
curl -s -X POST http://127.0.0.1:9856/v1/approvals/<requestId> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"accept"}'
```

Allowed decisions:

- `accept`
- `acceptForSession`
- `decline`
- `cancel`

## Interrupt a running session

```bash
curl -s -X POST http://127.0.0.1:9856/v1/sessions/demo-chat/interrupt \
  -H "Authorization: Bearer $TOKEN"
```

## Delete a saved session

This removes the relay's stored session entry, including its saved Codex thread ID and cached usage for that session. The next request with the same `x-session-id` starts a fresh thread.

```bash
curl -s -X DELETE http://127.0.0.1:9856/v1/sessions/demo-chat \
  -H "Authorization: Bearer $TOKEN"
```

Notes:

- If the session is currently running, the relay returns `409`. Interrupt it first.
- If the session does not exist, the relay returns `404`.
