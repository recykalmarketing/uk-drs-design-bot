# Validation report

Release: 2.1.0  
Validated: 17 July 2026

## Automated checks completed

- Node syntax check for `server.js`: passed
- Node syntax check for `workflowService.js`: passed
- Vite production build: passed
- Static dashboard and bundled JavaScript delivery: passed
- Standard infographic generation in demo mode: two options, both 100/100
- RVM-led image generation in demo mode: two options, both 100/100
- Originality and copyright score: 10/10 on tested valid outputs
- Missing rights confirmation: correctly blocked with HTTP 400
- Copy-a-competitor instruction: correctly blocked with HTTP 400
- External/downloaded image URL instruction: correctly blocked with HTTP 400
- Workflow submission without copyright pass: server-enforced block
- Brand approval without IP attestation: correctly blocked with HTTP 400
- Brand approval with attestation: moved to Design review
- Design approval with attestation: moved to LinkedIn configuration stage
- LinkedIn publishing without credentials: safely reported as awaiting configuration
- Approved hashtag filtering: passed
- Generation provenance and reference-asset IDs: recorded

## Live integration checks still required after deployment

- OpenAI live image and copy generation with the replacement API key
- OpenAI visual IP audit response on real generated images
- Resend delivery to both reviewer email addresses
- LinkedIn organisation permission and live post upload
- Supabase persistence across a Render restart

The release contains no API keys and does not include `node_modules` in the final package.
