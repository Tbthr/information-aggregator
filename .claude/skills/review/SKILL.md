# Pre-Push Code Review

Review staged changes before committing. Catches issues early.

## Workflow

1. **Gather Changes**
   - Run `git diff --cached --stat` for staged changes summary
   - Run `git diff --cached` for full diff (if large, summarize key files)

2. **Review Checklist**

   Check for:
   - [ ] TypeScript types correct (no `any` without reason)
   - [ ] No console.log or debugger statements
   - [ ] No hardcoded credentials or secrets
   - [ ] Error handling present for API calls
   - [ ] Components use shadcn/ui patterns
   - [ ] No unused imports or dead code

3. **Report**
   - Summarize changes in 2-3 sentences
   - List any issues found
   - Suggest improvements if any

4. **Decision**
   - If issues found: ask user if they want to fix before commit
   - If clean: confirm ready to commit

## Usage

```
/review
```

Review specific files:
```
/review components/Button.tsx lib/api-client.ts
```
