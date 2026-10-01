# Blog review UI

Reusable split-pane reviewer for draft posts (proposals, highlight comments, inline edits).

## Start a new post review

1. Write the draft HTML under `/blog/…`.
2. Copy `proposals.example.json` → e.g. `my-post-proposals.json` and fill in real proposals.
3. Open:

```
/blog/review/?post=/blog/my-post.html&proposals=./my-post-proposals.json
```

4. Approve / reject / comment, highlight text, or use **Edit mode**. Export JSON and paste it back in chat.
5. Keep `language-style.md` in sync with edits you accept.

Decisions are stored in `localStorage` per post path, so drafts don’t collide.
