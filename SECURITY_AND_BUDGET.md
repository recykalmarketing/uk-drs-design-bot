# Security, rights and budget configuration

## Secrets

Keep every credential in Render environment variables. Never commit OpenAI, Resend, Supabase or LinkedIn credentials to GitHub or expose them through a `VITE_` browser variable.

The OpenAI key previously shared in chat must remain revoked. Use a replacement project or service-account key in `OPENAI_API_KEY`.

Set `APP_ACCESS_CODE` so the public Render URL cannot trigger paid generation. Reviewer links use separate random workflow tokens.

## Asset rights

Only files declared in `reference/rights-manifest.json` may be used as visual references. The existing ReteaRn UK logo and RVM references are marked as user-declared owned or authorised. The software does not independently verify ownership.

The bot does not automatically download Google Images, social posts, stock photographs, competitor artwork or platform creatives. Requests containing copying instructions, external asset URLs or unconfirmed rights are blocked.

## Budget target

Production defaults:

- text model: `gpt-5.6`
- image model: `gpt-image-2`
- image quality: `medium`
- visual IP audit: enabled
- 500 two-option batches per month
- 500 one-option regenerations per month
- estimated in-app ceiling: USD 95

GPT Image 2 is token-priced, so exact cost varies with size, prompt length and reference-image inputs. The app uses conservative request estimates and includes an estimated visual-audit allowance. This is an operational guard, not a billing guarantee.

RVM edits can cost more because two reference images are included. Monitor actual OpenAI project usage during the first production month and lower limits if needed.

## Persistent counters

Render Free storage is ephemeral. Use Supabase for durable approval history. The usage ledger defaults to a temporary Render file and may reset after redeploys, so configure OpenAI project budget alerts as a second control.

Never rely on one cost or rights control alone. Final publication also requires Brand Manager and Design Manager attestations.
