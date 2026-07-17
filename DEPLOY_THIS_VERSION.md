# Deploy this version to GitHub and Render

## GitHub

Upload every file and folder inside this package to the root of the existing GitHub repository. Do not upload the ZIP or create an extra nested folder.

The root must include:

- `dist/`
- `knowledge/`
- `public/`
- `reference/`
- `src/`
- `server.js`
- `workflowService.js`
- `package.json`
- `render.yaml`
- `supabase-schema.sql`
- `COPYRIGHT_AND_ORIGINALITY_COMPLIANCE.md`

## Render

The included Blueprint uses:

- Build command: `echo "Prebuilt app ready - no dependency installation required"`
- Start command: `node server.js`
- Health check: `/api/health`

After GitHub is updated, use **Manual Deploy → Clear build cache & deploy**.

## Essential secrets

- `OPENAI_API_KEY`
- `APP_ACCESS_CODE`

The default models are `gpt-5.6` and `gpt-image-2`.

## Copyright controls

Keep:

- `ENABLE_VISUAL_IP_AUDIT=true`
- `ESTIMATED_VISUAL_AUDIT_COST_USD=0.003`

Do not add downloaded web images, competitor artwork or third-party brand files to `reference/`. Every new asset must first be added to `reference/rights-manifest.json` with its rights basis and permitted use.

## Approval email secrets

- `RESEND_API_KEY`
- `EMAIL_FROM`
- confirm `APP_BASE_URL` matches the live Render URL

## LinkedIn publishing secrets

- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_ORGANIZATION_URN`
- confirm `LINKEDIN_VERSION` is currently supported

## Persistent workflow history

Run `supabase-schema.sql` in Supabase, then add:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The bot runs without Supabase, but local workflow history can reset on Render Free.
