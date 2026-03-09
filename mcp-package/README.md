# Invoica MCP Server

Let Claude, Cursor, Windsurf, and any MCP client create invoices and check settlements directly.

## Install (one command)

```bash
npx -y invoica-mcp
```

## Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "invoica": {
      "command": "npx",
      "args": ["-y", "@invoica/mcp"]
    }
  }
}
```

## Cursor / Windsurf (`.cursor/mcp.json` or `.windsurf/mcp.json`)

```json
{
  "mcpServers": {
    "invoica": {
      "command": "npx",
      "args": ["-y", "@invoica/mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `create_invoice` | Create an invoice — returns paymentUrl for on-chain settlement |
| `list_invoices` | List recent invoices for your API key |
| `check_settlement` | Check if an invoice is settled — returns txHash + chain |

Get your API key at **https://app.invoica.ai/api-keys**
