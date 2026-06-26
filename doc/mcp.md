# MCP server

yarr exposes a [Model Context Protocol](https://modelcontextprotocol.io)
server so you can connect an AI client (Claude Code, Claude Desktop) and
browse and triage your news articles in natural language — "show me unread
articles about Go", "star that one", "save it to Instapaper".

The server speaks JSON-RPC 2.0 over the Streamable HTTP transport at a single
endpoint:

```
POST http://127.0.0.1:7070/mcp
```

With a `--base` path it is `http://127.0.0.1:7070/<base>/mcp`.

## Authentication

When yarr is started with credentials (`--auth user:pass` / `YARR_AUTH`), the
MCP endpoint requires a bearer token. The token is the same value the Fever API
uses: the hex MD5 of `username:password`.

```sh
# macOS
TOKEN=$(printf '%s' 'user:pass' | md5)
# Linux
TOKEN=$(printf '%s' 'user:pass' | md5sum | cut -d' ' -f1)
```

Send it as `Authorization: Bearer <token>`. If yarr runs without credentials,
the endpoint is open (same behaviour as the Fever API).

## Connecting

**Claude Code** (native HTTP transport):

```sh
claude mcp add --transport http yarr http://127.0.0.1:7070/mcp \
  --header "Authorization: Bearer $TOKEN"
```

**Claude Desktop** (via the [`mcp-remote`](https://github.com/geelen/mcp-remote)
bridge) — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yarr": {
      "command": "npx",
      "args": [
        "mcp-remote", "http://127.0.0.1:7070/mcp",
        "--header", "Authorization: Bearer <token>"
      ]
    }
  }
}
```

## Using it from Claude

Once connected, just talk to Claude — it picks the right tools. The natural
flow is the yarr triage loop: **read → star / save → next.** Some prompts that
work well:

- *"What's unread in my feeds?"* → `list_articles` with `status: unread`
- *"Summarize the top 5 unread articles, newest first."* → `list_articles` then
  `get_article` on each
- *"Show me anything about Go generics."* → `list_articles` with `search`
- *"Read me article 42, then star it."* → `get_article` then `star`
- *"Save that one to Instapaper and mark the rest of this feed read."* →
  `save_to_instapaper` then `mark_all_read` with a `feed_id`
- *"Triage my Tech folder: list unread, I'll tell you which to keep."* →
  `list_folders` + `list_articles` with `folder_id`, then `star` / `mark_read`

Articles are referred to by the numeric **id** shown in `list_articles`
(`[42] Some headline …`). Statuses are exclusive — an article is `unread`,
`read`, or `starred`. `unstar` and `save_to_instapaper` both leave the article
`read`.

## Tools

| Tool | Description |
|------|-------------|
| `list_feeds` | List subscribed feeds with folder and unread/starred counts |
| `list_folders` | List folders |
| `list_articles` | List articles, filter by `feed_id` / `folder_id` / `status` / `search`, with `limit` and `newest_first` |
| `get_article` | Full text of one article by `id` |
| `mark_read` / `mark_unread` | Set an article's read status |
| `star` / `unstar` | Star / remove star |
| `save_to_instapaper` | Save an article to Instapaper (requires Instapaper credentials in Settings) |
| `mark_all_read` | Mark everything read, optionally limited to a `feed_id` or `folder_id` |

## Driving it directly

The endpoint is plain JSON-RPC 2.0, so you can script against it too. A
`tools/call` wraps the tool name and its arguments:

```sh
# 20 newest unread articles
curl -s -XPOST http://127.0.0.1:7070/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"list_articles","arguments":{"status":"unread","limit":20}}}'

# full text of one article
curl -s -XPOST http://127.0.0.1:7070/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"get_article","arguments":{"id":42}}}'

# star it
curl -s -XPOST http://127.0.0.1:7070/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"star","arguments":{"id":42}}}'
```

Each `tools/call` returns a result of the form
`{"content":[{"type":"text","text":"…"}],"isError":false}`. Tool-level problems
(an unknown id, missing Instapaper credentials) come back with `isError: true`
and a human-readable message rather than a transport error, so Claude can read
and recover from them.

List the available tools and their argument schemas at any time:

```sh
curl -s -XPOST http://127.0.0.1:7070/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Quick check

```sh
curl -s -XPOST http://127.0.0.1:7070/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```
