# ReteaRn UK Social Design Bot

A GitHub and Render-ready internal design and approval workflow for the ReteaRn UK product.

## Core capabilities

- ReteaRn UK product isolation for future multi-country expansion
- Locked retearn.uk SVG logo and Poppins layouts
- UK DRS knowledge base sourced from official guidance
- Original image and infographic generation
- Mandatory brief and brief-implementation scoring
- Two creative options per generation
- 100-point quality rating with a 95+ approval gate
- 10-point originality and copyright preflight
- Approved RVM reference-bank workflow
- Brand Manager and Design Manager approval stages with IP attestations
- Feedback loops inside the dashboard
- Email review notifications with secure review URLs
- Automatic LinkedIn Page publishing only after both approvals
- PNG export, caption, approved hashtags and alt text
- Generation provenance and AI budget controls

## Copyright safeguards

The bot blocks instructions to copy, trace or imitate other brands and rejects external image links or downloaded web references. It uses official research for facts, paraphrases campaign copy, filters hashtags through an approved whitelist, checks source-language overlap, audits generated visuals and records provenance. Automatic publishing is blocked until the automated preflight and both human rights attestations pass.

Read `COPYRIGHT_AND_ORIGINALITY_COMPLIANCE.md`. These controls reduce risk but do not replace legal review or prove worldwide uniqueness.

## Production integrations

External services require credentials:

- OpenAI API for generation and optional visual IP audit
- Resend for approval emails
- LinkedIn Marketing API for organisation posts
- Supabase for persistent workflow history on Render

Read `APPROVAL_WORKFLOW_SETUP.md` and `DEPLOY_THIS_VERSION.md` before deployment.
