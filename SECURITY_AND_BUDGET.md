# Security and Budget Configuration

## API key

The OpenAI API key must only exist as a backend environment variable named `OPENAI_API_KEY`.

Never place it in:

- `src/` files
- `index.html`
- `public/`
- `render.yaml` as a literal value
- a variable beginning with `VITE_`
- GitHub commits

Use a dedicated project or service-account key rather than a personal key shared with the whole team.

Set `APP_ACCESS_CODE` in Render so the public URL cannot trigger paid generation without the internal code. The code is stored only in browser session storage and sent to the backend in a request header.

## Key rotation

Any key pasted into chat, email, Slack or a ticket should be treated as exposed. Revoke it and create a replacement before deployment.

## Cost plan

Configured plan:

| Item | Setting |
|---|---:|
| Initial batches | 500/month |
| Options per batch | 2 images |
| Regenerations | 500/month |
| Image model | gpt-image-1.5 |
| Image quality | medium |
| Text model | gpt-5.6-luna |
| In-app guard | $95/month estimated |

Published image list-price assumptions used by the app:

| Output | Medium image cost |
|---|---:|
| 1024×1024 | $0.034 |
| 1024×1536 | $0.050 |
| 1536×1024 | $0.050 |

A full two-option batch therefore has an image cost of about $0.068–$0.10. The app adds a conservative $0.008 text allowance.

Estimated 500-batch cost: approximately $38–$54.

Estimated 500 additional one-image regenerations: approximately $19–$27.

Planned combined estimate: approximately $57–$81.

## Important limitation

The in-app usage ledger is stored on the Render runtime filesystem. It survives normal requests but may reset after a redeploy, restart or instance replacement. It is useful as a practical secondary guard, not as the sole billing control.

Set OpenAI project budget notifications as well. Platform project budgets are soft thresholds and do not stop requests, so the application guard remains important.
