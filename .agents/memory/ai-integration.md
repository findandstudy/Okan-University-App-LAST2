---
name: AI integration patterns
description: Patterns for AI provider integration — encryption, SDK loading, FAQ schema fields
---

## API Key Encryption
- Store encrypted keys in `integrationSettings` table with `integrationType='ai'`
- Use AES-256-CBC with a random 16-byte IV: `iv.toString('hex') + ':' + encrypted.toString('hex')`
- `ENCRYPTION_KEY` env var holds a 64-char hex string (32 bytes); never change it after setting
- Never return `encryptedApiKey` to the client — strip it from GET responses

## SDK Loading
- Use dynamic `await import('@anthropic-ai/sdk')` and `await import('openai')` — lazy-load only when called
- For `pdf-parse`: use `require('pdf-parse')` not `import(...).default` — the ESM export has no `.default` property

**Why:** Avoids importing both SDKs at startup and keeps bundle smaller.

## FAQ Schema
- FAQ items use `questionByLang` and `answerByLang` (Record<SupportedLanguage, string>), NOT `question`/`answer`
- When creating FAQ items from AI, build a full `emptyLangs` object for all 10 languages and spread with the EN value

## Storage Pattern
- `getAISettings()` returns `{ provider, model, hasApiKey, encryptedApiKey? }` — include `encryptedApiKey` for internal use only
- `saveAISettings()` merges new data with existing, preserving `encryptedApiKey` if no new key provided
