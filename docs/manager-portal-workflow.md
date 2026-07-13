# Manager portal workflow

## Architecture

The application is a React/Vite frontend packaged with Electron. It calls an Express API that authenticates users with the existing JWT middleware. The API uses the existing Supabase REST client. Roles remain separate from employee types: `Manager` is a role, while `lead_generator` and `caller` are employee types on `Employee` users.

## Deployment requirement

Run `server/database/manager-portal-workflow-migration.sql` once in the Supabase SQL Editor before deploying this application version. The migration is non-destructive, preserves existing leads, backfills legacy caller ownership and workflow states, and can be run again safely. Then run `server/database/supabase-access-fix.sql` if the deployment uses the project's current direct Supabase REST access model.

## Workflow

`new` -> `assigned_to_manager` -> `assigned_to_lead_generator` -> `lead_generation_in_progress` -> `submitted_by_lead_generator` -> `under_manager_review` -> `approved_for_caller` -> `assigned_to_caller` -> `caller_in_progress` -> `caller_completed` -> `manager_follow_up` -> `manager_completed`, `converted`, or `not_interested`.

Return, rejection, reassignment, cancellation, and assignment removal use explicitly validated transitions. Assignment, status, caller outcome, email, Manager outcome, and activity records are retained as history.

## API surface

- `GET /api/manager/dashboard`
- `GET /api/manager/leads`
- `GET /api/manager/leads/:id`
- `POST /api/manager/leads/:id/assign-lead-generator`
- `POST /api/manager/leads/:id/return-to-lead-generator`
- `POST /api/manager/leads/:id/approve`
- `POST /api/manager/leads/:id/reject`
- `POST /api/manager/leads/:id/assign-caller`
- `POST /api/manager/leads/:id/email`
- `POST /api/manager/leads/:id/complete`
- `GET /api/caller/leads`
- `GET /api/caller/leads/:id`
- `POST /api/caller/leads/:id/start`
- `POST /api/caller/leads/:id/complete`
- `POST /api/admin/leads/:id/assign-manager`
- `DELETE /api/admin/leads/:id/manager`
- `GET /api/admin/leads/completed-by-manager`
- `GET /api/admin/leads/:id/full-history`
- `POST /api/leads/:id/submit`

Every role-specific endpoint derives identity from the authenticated JWT. Manager and Caller queries include ownership filters, and hidden records return 404 where appropriate.

## Email rule

The Initial, Day 3, Day 7, and Day 14 dates are all calculated from the Initial Email record. Editable templates are provided in the Manager composer. Because this repository has no configured, verified mail provider, email attempts are deliberately stored as `draft`; they are never falsely marked `sent`. `sent_at`, provider ID, failure reason, and delivery statuses are ready for a provider integration later.
