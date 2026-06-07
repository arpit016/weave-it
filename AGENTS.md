---
description: 
alwaysApply: true
---

# Agent instructions

## Codebase context lookup

This repository may have an indexed codebase context provider available, such as codebase-memory-mcp.

Before using broad glob, rg, grep, or reading many files, check whether a codebase context MCP/tool is available.

If available, prefer it for:
- architecture discovery
- symbol, class, method, route, and module lookup
- caller/callee tracing
- impact analysis
- locating relevant files before reading source

If no such tool is available, or if it is stale/insufficient, fall back to normal repo exploration using glob, rg, grep, and file reads.

Always verify important findings against the actual source files before making code changes.
