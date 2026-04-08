# Contributing to Connectplus

## Branching

1. From the latest default branch (`main`), create a branch: `feature/short-description` or `fix/issue-short-description`.
2. Keep changes **focused** on one concern when possible (easier review and rollback).
3. Open a **Pull Request** early if you want feedback before finishing.

## Before you push

- **Backend:** `npm run lint` in `backend/` if you changed server code.
- **Frontend:** `npm run lint` in `frontend/` or `frontend-mobile/` when relevant.
- **Database:** if `backend/prisma/schema.prisma` changed, include a migration from `npx prisma migrate dev` (name it clearly). Do not commit a broken migration history.

## API and contract changes

- Prefer **additive** changes (new optional fields, new endpoints) over breaking renames or payload shape changes.
- If you must break an endpoint, coordinate with consumers (web + mobile) and document the change in the PR description.

## Environment variables

- Add new variables to the appropriate **`.env.example`** in the same PR so others can update their local `.env`.
- Never commit secrets; use placeholders in examples only.

## Reviews

- Describe **what** changed and **how to test** (e.g. “create lead, open presales project”).
- Link issues or tickets if your team uses them.

## Merge conflicts

- Prefer rebasing or merging `main` into your branch before the final review so CI and reviewers see up-to-date code.
