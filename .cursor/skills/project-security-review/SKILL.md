---
name: project-security-review
description: Review changes for secrets exposure, auth weaknesses, unsafe external calls, data handling, and operational security. Use for security review, secret check, or pre-deploy validation.
---

# Security Review

Security-first review. Read [_shared/read-stack.md](../_shared/read-stack.md) and [doc/stack.md](../../../doc/stack.md) first.

**要件段階の対応チェックリスト:** [security-checklist.md](../requirements-advisory/references/security-checklist.md)（[review-lifecycle.md](../_shared/review-lifecycle.md)）

## Security priorities

1. Secrets handling
2. Authentication and authorization
3. Input validation and outbound request safety
4. Logging and data exposure
5. Abuse, replay, and operational risks

## Stack-specific checks

Apply `secrets_policy` and `forbidden_secret_paths` from `doc/stack.md`.

Add checks from `stack-specific review notes` (e.g. webhook auth, binding config).

Generic checks (all stacks):

- No secrets or derived secrets committed
- Auth checks explicit and hard to bypass
- Untrusted input validated before use
- Errors do not leak sensitive details
- Network/state operations have safe failure modes

## Review checklist

- [ ] No secrets in tracked files listed in stack profile
- [ ] Auth on exposed endpoints/triggers where required
- [ ] Logs do not leak tokens or sensitive payloads
- [ ] Retries/concurrency do not create unsafe duplicate side effects

## Output format

Findings: `Critical` | `High` | `Medium` | `Low`

Then: attack surface, residual risks, missing security tests.

要件段階で拾えなかった問題は handoff に `review_root_cause: requirements-gap` を付与し、[review-lifecycle.md](../_shared/review-lifecycle.md) のフィードバックループへ。
