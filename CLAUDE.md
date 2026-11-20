## Working agreements
- Claude never runs `git commit` or `git push`. Leave changes uncommitted and say what
  is ready; the developer reviews and commits manually.

## Tooling
- The UI uses Mantine 9. Before writing or changing Mantine code, look up the component's
  props and Styles API with the `mantine` MCP server (`.mcp.json`) instead of relying on
  memory. Keep its version pinned to the installed `@mantine/core` version.
