# Finding Format

Use this structure for both JSON artifacts and markdown reports.

## JSON shape

```json
{
  "transcript": "<path to transcript>",
  "generated_at": "<ISO-8601 timestamp>",
  "findings": [
    {
      "id": "finding-1",
      "target": "<repository-relative file path>",
      "signal": "user_correction",
      "category": "ambiguity",
      "description": "What went wrong and why it matters.",
      "suggested_fix_direction": "What local edit should likely be made.",
      "evidence": [
        "Short sanitized evidence snippet."
      ]
    }
  ]
}
```

## Markdown shape

```markdown
# Self Retrospective

- Transcript: `<path>`
- Generated at: `<timestamp>`

### Finding 1
- Target: `<path>`
- Signal: `user_correction`
- Category: `ambiguity`
- Description: ...
- Suggested fix direction: ...
- Evidence:
  - ...
```

## Category guidance

Use one of these categories:

- `ambiguity`
- `missing-branch`
- `wrong-default`
- `rules-conflict`
- `other`

## Formatting rules

- Keep evidence short and sanitized
- Prefer repository-relative paths
- One finding should map to one local edit target
- Do not include raw secrets, tokens, or private absolute paths
