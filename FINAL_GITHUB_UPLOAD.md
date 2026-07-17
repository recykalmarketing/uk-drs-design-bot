# Final GitHub upload checklist

1. Extract the ZIP.
2. Open the extracted folder.
3. Upload every item inside it to the root of the existing GitHub repository.
4. Replace existing files when GitHub asks.
5. Do not upload the ZIP and do not create an extra outer folder.

The repository root must show:

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

Before committing, confirm:

- no `.env` file is present
- no API keys are present
- no downloaded competitor or web images are present
- every reference asset appears in `reference/rights-manifest.json`

Commit message:

`Deploy ReteaRn UK copyright-compliant approval workflow`

Then in Render choose **Manual Deploy → Clear build cache & deploy**.
