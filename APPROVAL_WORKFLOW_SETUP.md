# ReteaRn UK approval and publishing setup

## Workflow implemented

1. Creator selects product, topic, audience, size, creative type and a mandatory brief.
2. Creator confirms that every supplied brief and reference is owned, licensed, public-domain or authorised.
3. The server blocks copying, imitation and unlicensed external-reference instructions.
4. Bot generates two original image or infographic options.
5. Each option passes UK DRS, brief, design, accessibility, brand and copyright checks.
6. Only a creative scoring 95/100 or above with a passed copyright preflight can be submitted.
7. Brand Manager receives a secure review URL by email.
8. Brand Manager approves with a copy-rights attestation or requests changes.
9. Requested changes return to the same creative and repeat automated checks.
10. After Brand approval, Design Manager receives a secure review URL.
11. Design Manager approves with a visual/layout rights attestation or requests changes.
12. Only after both approvals does the server publish the approved PNG and caption to the configured ReteaRn UK LinkedIn organisation page.

## Reviewers

- Brand Manager: alokesh.sinha@recykal.com
- Design Manager: vinod.mylavarapu@recykal.com

## Rights declarations

Brand Manager:

`The copy is original, source-based and free of unapproved third-party marks.`

Design Manager:

`The layout and visual are original and use only approved or authorised assets.`

The Approve button remains disabled until the relevant declaration is checked.

## Required Render secrets

### Generation and visual audit

- `OPENAI_API_KEY`
- `ENABLE_VISUAL_IP_AUDIT=true`
- `ESTIMATED_VISUAL_AUDIT_COST_USD=0.003`

When an AI visual audit cannot run, the visual is marked for mandatory human attestation rather than automatically cleared.

### Email notifications

- `RESEND_API_KEY`
- `EMAIL_FROM` — a verified sender, for example `ReteaRn UK Design Bot <reviews@retearn.uk>`
- `APP_BASE_URL` — the public Render URL

Without these, the workflow remains available in the dashboard, but notifications are recorded as previews rather than sent.

### LinkedIn automatic publishing

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_ORGANIZATION_URN` — format `urn:li:organization:123456789`
- `LINKEDIN_VERSION` — a currently supported YYYYMM Marketing API version
- `LINKEDIN_PAGE_URL` — already set to the ReteaRn UK page

The LinkedIn app must be associated with the ReteaRn UK Page. The authenticated member must have an eligible Page role and `w_organization_social` permission.

### Persistent approval history

Recommended for production:

- Create a Supabase project.
- Run `supabase-schema.sql`.
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Render.

Without Supabase, the bot falls back to a local JSON file. Render Free storage is ephemeral, so records may reset after restarts.

## LinkedIn destination

https://www.linkedin.com/company/retearn-uk/posts/?feedView=all

The Page URL is not authentication. `LINKEDIN_ORGANIZATION_URN` controls the publishing destination.
