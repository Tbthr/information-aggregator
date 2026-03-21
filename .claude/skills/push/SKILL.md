# Git Push with Validation

Standardized git commit and push workflow with pre-push validation.

## Workflow

1. **Check Status**
   - Run `git status` to see all changes
   - Run `git diff --stat` for change summary

2. **Validation** (required before commit)
   - Run `pnpm typecheck` - must pass with no errors
   - Run `pnpm build` - must succeed
   - If any validation fails: show errors and STOP

3. **Commit**
   - Show recent commits for message style reference: `git log --oneline -5`
   - Draft commit message following project style
   - Ask user to confirm or edit the message
   - Commit with confirmed message

4. **Push**
   - Run `git push`
   - Confirm success

## Error Handling

- If typecheck fails: show errors, ask if user wants to proceed anyway
- If build fails: show errors, do NOT proceed without user override
- If push fails: show error and suggest resolution

## Usage

```
/push
```

Or with custom message:
```
/push "feat: add new feature"
```
