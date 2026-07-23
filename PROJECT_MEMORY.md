# Paseo local collaboration memory

Read this file at the start of every task in this repository, after `CLAUDE.md`.
Keep it current when user-specific implementation decisions or pending integration work changes.
Never record API keys, access tokens, or other secrets here.

## Provider and model work

- The user wants Paseo to manage third-party providers similarly to OpenCode.
- AIMAPI/Codex-compatible endpoint used for validation: model `gpt-5.6-terra`.
- For a Codex-compatible endpoint, the base URL includes `/v1`.
- The same AIMAPI endpoint accepts Anthropic Messages requests for Claude Code, but its Claude base URL must omit `/v1`: Claude Code appends it itself.
- Model reasoning efforts belong to a provider's **Add model** workflow, not its **Add provider** workflow. They are stored as model `thinkingOptions` and displayed by the composer beneath the input for the selected model.

## Local commits to preserve while integrating upstream

- `717835c` — configure reasoning efforts for Codex endpoints.
- `32adc6c` — configure reasoning when adding provider models.
- `22467a2` — keep reasoning settings with provider models.

## Packaging

- The current Linux package is `packages/desktop/release/Paseo-0.2.0-beta.3-amd64.deb`.
- The current Windows x64 installer is `packages/desktop/release/Paseo-Setup-0.2.0-beta.3-x64.exe`.
- Do not restart the production Paseo daemon on port 6767 without explicit permission.
