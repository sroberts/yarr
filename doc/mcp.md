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

## Quick check

```sh
curl -s -XPOST http://127.0.0.1:7070/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```
