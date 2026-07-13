# ReteaRn UK DRS Design Bot

A deployable Node.js + React application that helps non-designers generate factual, brand-safe UK Deposit Return Scheme creatives.

## What the bot does

- Select a topic, target audience, output size and creative type.
- Generate two distinct creative options in one click.
- Generate a social caption with each creative.
- Keep the supplied ReteaRn logo as an exact SVG overlay. The AI never redraws the logo.
- Compose all headlines and body copy in Poppins.
- Generate text-free visual backgrounds with OpenAI, then add accurate typography and infographic elements in the browser.
- Edit copy and metrics directly.
- Submit feedback and regenerate one option independently.
- Keep or replace the current visual during regeneration.
- Download each design as a PNG at the selected pixel dimensions.
- Run without an API key in demo mode using procedural, non-stock visuals.

## Secure OpenAI setup

The API key is deliberately not included in the repository, browser bundle or downloadable ZIP. The frontend calls the Express backend, and only the backend reads `OPENAI_API_KEY`.

For local use:

```bash
npm install
cp .env.example .env
# Paste a newly created project/service-account key into .env
npm run dev
```

For Render:

1. Open the service dashboard.
2. Go to **Environment**.
3. Add `OPENAI_API_KEY` as a secret environment variable.
4. Add `APP_ACCESS_CODE` as a second secret so only the internal team can generate.
5. Deploy or restart the service.

Do not use a `VITE_` prefix for the API key. Any `VITE_` variable can be exposed to the browser bundle.

## Cost-controlled defaults

The production defaults are:

- Text model: `gpt-5.6-luna`
- Image model: `gpt-image-1.5`
- Image quality: `medium`
- 500 two-option creative batches per month
- 500 feedback regenerations per month
- App-side estimated spend guard: `$95`

At current published list prices, one two-option batch costs approximately:

- Square: about `$0.076` including a conservative text allowance
- Portrait or landscape: about `$0.108` including a conservative text allowance

Therefore 500 full two-option batches are estimated at roughly `$38–$54`, before optional regenerations. Up to 500 one-image regenerations add roughly `$19–$27`, keeping the planned workload below `$100` under the configured models and qualities.

The app stores a conservative runtime usage ledger and blocks requests when the configured guard is reached. The ledger is a secondary control. Also configure a project budget and notifications in the OpenAI platform. OpenAI project budgets are alerts, not hard stops.

Environment controls:

```bash
APP_ACCESS_CODE=choose-a-strong-internal-code
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_IMAGE_QUALITY=medium
MONTHLY_BUDGET_USD=95
MONTHLY_CREATIVE_BATCH_LIMIT=500
MONTHLY_REGENERATION_LIMIT=500
```

Changing the image model or quality changes the cost. The server uses a conservative fallback estimate for unknown future models.

## Why imagery and layout are separated

Image models are good at producing scenes, objects and visual atmosphere, but should not be trusted to reproduce a logo or render policy text accurately. This app therefore:

1. asks OpenAI for a text-free visual,
2. locks facts to the selected research topic,
3. overlays the exact SVG logo,
4. typesets all copy in Poppins,
5. exports the composed result as a PNG.

## Local production test

```bash
npm run build
npm start
```

Frontend and API: `http://localhost:10000`

Health check: `http://localhost:10000/api/health`

Usage status: `http://localhost:10000/api/usage`

## Deploy through GitHub and Render

1. Create a new private GitHub repository.
2. Upload all project files except `.env`, `.runtime`, `node_modules` and `dist`.
3. In Render, choose **New > Web Service** and select the repository.
4. Render can detect `render.yaml`.
5. Add the OpenAI key as a Render secret environment variable.
6. Deploy. New GitHub commits can auto-deploy.

## Recommended production controls

- Use a dedicated OpenAI project or service-account key for this bot.
- Restrict model usage to the configured text and image models.
- Set project budget alerts at 80%, 90% and 100%.
- Keep `APP_ACCESS_CODE` enabled or put the app behind organisation login.
- Review the official UK DRS knowledge base monthly.
- Keep competitor comparisons for internal sales enablement unless legally approved.

## Project structure

```text
knowledge/
  topics.json
  sizes.json
public/
  retearn-logo.svg
src/
  components/
  App.jsx
server.js
RESEARCH.md
COMPETITOR_RESEARCH.md
CONTENT_TOPICS.md
render.yaml
```

## Scope rule

The default content scope is England, Scotland and Northern Ireland, operated by Exchange for Change. Wales is a separate scheme pathway and must be selected as a dedicated Wales topic. The bot does not mix Welsh glass rules into Exchange for Change retailer content.

## Brand rules

- Poppins typeface
- Royal Purple `#6a398c`
- Muted Magenta `#9c539c`
- Soft Violet `#a16dc9`
- Forest Green `#5b8563`
- Skyline Blue `#00b4d8`
- Logo top-left on a high-contrast safe area
- No logo distortion, recreation, rotation or AI rendering
