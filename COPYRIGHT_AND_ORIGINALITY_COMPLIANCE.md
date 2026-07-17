# Copyright and originality compliance

Version: RETEARN-UK-IP-1.0  
Applies to: ReteaRn UK images, infographics, copy, captions, hashtags and LinkedIn publishing

## Purpose

This release uses an original-only generation policy. It is designed to reduce the risk of copying another brand, creator, campaign, stock image or platform post. It is a workflow control, not a legal opinion or a guarantee that a generated output is unique everywhere in the world.

## Controls implemented

### 1. Rights confirmation before generation

The creator must confirm that every supplied brief and reference is:

- owned by ReteaRn/Recykal
- covered by a suitable licence
- in the public domain, or
- otherwise authorised for the intended commercial use

The server blocks generation when this confirmation is missing.

### 2. Copying and imitation requests are blocked

The brief validator rejects directions such as:

- copy or replicate another post
- make it exactly the same as another campaign
- create it in a named artist's or brand's style
- trace a supplied design
- use a downloaded Google, Pinterest, LinkedIn, Instagram, Behance or Dribbble image
- reproduce another brand's logo, artwork, tagline or layout

External image URLs and screenshots are blocked unless a future rights-managed upload process records documented permission.

### 3. Approved assets only

The bot may use only the assets listed in `reference/rights-manifest.json`:

- the supplied retearn.uk logo
- the supplied ReteaRn RVM placement reference
- the supplied ReteaRn RVM specification reference

The software treats these assets as user-declared owned or authorised. The company remains responsible for verifying that declaration.

### 4. Original visual prompts

Every image and infographic prompt requires a new ReteaRn UK composition. Prompts prohibit:

- third-party logos, trade dress and taglines
- identifiable retailer interiors, uniforms or signage
- branded beverage packaging
- watermarks
- competitor RVM replicas
- celebrities, public figures and copyrighted characters
- copied app interfaces, social templates or campaign layouts
- imitation of a living artist, studio or named brand style

Bottles, cans, shops and uniforms must remain generic and unbranded unless written permission is recorded.

### 5. Copy and source-language checks

Official UK DRS sources are used for facts and citations only. Generated headlines, body copy, captions and metric labels are checked for consecutive wording overlap with the stored source facts.

- nine or more matching consecutive words: critical failure
- six to eight matching consecutive words: rewrite warning
- common factual phrases such as “Deposit Return Scheme” are excluded from the similarity rule

This prevents the bot from treating factual research as reusable campaign copy.

### 6. Hashtag control

The output is limited to a ReteaRn-owned and generic topic whitelist. Competitor, retailer and third-party campaign hashtags are removed.

Approved examples include:

`#ReteaRnUK` `#UKDRS` `#DRSUK` `#DepositReturnScheme` `#CircularEconomy` `#ReverseVending` `#RetailReadiness`

### 7. Automated visual IP audit

When enabled, the server reviews each AI-generated visual for:

- third-party logos or retailer identity
- branded packaging
- watermarks or signatures
- copyrighted characters
- celebrity or public-figure likenesses
- copied campaign or UI appearance
- competitor RVM appearance

If the visual audit is unavailable, the output is marked for mandatory human visual attestation rather than being treated as fully cleared.

### 8. Provenance record

Every creative records:

- generation ID and timestamp
- copy and image model identifiers
- prompt hash and brief hash
- source label and source URL
- approved reference-asset identifiers
- rights basis
- quality-gate and copyright-gate versions
- visual-audit status

The system does not fetch external image-bank assets automatically.

### 9. Originality score and publication gate

Originality and copyright contribute 10 points to the 100-point quality score. A creative must:

- score at least 9/10 for originality and copyright
- have no critical IP issue
- pass the overall 95/100 quality threshold
- receive Brand Manager rights attestation
- receive Design Manager rights attestation

Automatic LinkedIn publishing is blocked until all four conditions are met.

### 10. Human approval declarations

Brand Manager declaration:

> The copy is original, source-based and free of unapproved third-party marks.

Design Manager declaration:

> The layout and visual are original and use only approved or authorised assets.

When either reviewer requests changes, the revised creative re-enters the same automated and human review loop.

## Operational limitations

Automated text comparison and visual classification cannot establish worldwide legal clearance, identify every similar work, or replace a qualified IP review. For a high-value campaign, disputed mark, licensed photograph, celebrity image or third-party collaboration, obtain written permission and legal review before publishing.

## Official guidance used for this policy

- UK Intellectual Property Office, *Copyright notice: digital images, photographs and the internet*: https://www.gov.uk/government/publications/copyright-notice-digital-images-photographs-and-the-internet/copyright-notice-digital-images-photographs-and-the-internet
- GOV.UK, *Using somebody else's intellectual property: Copyright*: https://www.gov.uk/using-somebody-elses-intellectual-property/copyright
- GOV.UK, *Exceptions to copyright*: https://www.gov.uk/guidance/exceptions-to-copyright
- LinkedIn Help, *Notices regarding content posted on the LinkedIn website*: https://www.linkedin.com/help/linkedin/answer/a1339420
- LinkedIn Help, *LinkedIn's Trademark Policy*: https://www.linkedin.com/help/linkedin/answer/a1337296
