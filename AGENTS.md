# Agent instructions

## Codebase navigation rule

This repository is indexed with codebase-memory-mcp.

Before using glob, rg, grep, or reading many files, prefer codebase-memory-mcp tools for codebase exploration.

Use:
- list_projects to identify the indexed project
- get_graph_schema to understand available node/edge types
- get_architecture for high-level architecture questions
- search_graph to find classes, functions, routes, modules, and files
- trace_call_path to understand callers/callees
- detect_changes for impact analysis from git diffs
- get_code_snippet when exact function/class code is needed
- search_code only when structural search is not enough

Use normal file reads only after MCP identifies the relevant files or symbols.