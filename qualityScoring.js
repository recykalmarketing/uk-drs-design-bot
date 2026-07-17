import { auditOriginality, copyrightSafeHashtags } from './originalityCompliance.js';
export const QUALITY_GATE_VERSION = 'RETEARN-UK-SOCIAL-2.1';
export const PUBLISH_READY_SCORE = 95;

export const QUALITY_CATEGORIES = [
  { id: 'ukDrs', label: 'UK DRS accuracy', max: 20 },
  { id: 'brief', label: 'Brief & audience alignment', max: 15 },
  { id: 'seo', label: 'SEO & discoverability', max: 10 },
  { id: 'designHierarchy', label: 'Design hierarchy', max: 15 },
  { id: 'visualHierarchy', label: 'Visual hierarchy', max: 15 },
  { id: 'ukFriendly', label: 'UK-friendly & accessible', max: 10 },
  { id: 'brandPlatform', label: 'ReteaRn UK & platform', max: 5 },
  { id: 'originality', label: 'Originality & copyright', max: 10 }
];

const SUPPORTED_LAYOUTS = new Set(['metric-grid', 'pathway', 'editorial-split', 'impact-poster']);
const OFFICIAL_SOURCE_MARKERS = ['gov.uk', 'exchange for change', 'defra', 'legislation.gov.uk', 'keep britain tidy'];
const US_TERMS = [/\bgarbage\b/i, /\btrash\b/i, /\bsidewalk\b/i, /\bcolor\b/i, /\bcenter\b/i, /\bprogram\b/i, /\borganization\b/i, /\blicense\b/i, /\bdollars?\b/i, /\$\s*\d/];
const RISKY_DRS_TERMS = [/\bDRS is a tax\b/i, /\bdeposit is a tax\b/i, /\bgovernment fine\b/i, /\bguaranteed profit\b/i, /\bfree money\b/i, /\ball UK nations under one scheme\b/i];
const RVM_SIGNAL = /\b(?:rvm|reverse vending|reclaim ace|reklaim ace|machine supplier|automated return point)\b/i;

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function wordCount(value) { return clean(value).split(' ').filter(Boolean).length; }
function sentenceCount(value) { return clean(value).split(/[.!?]+/).map((v) => v.trim()).filter(Boolean).length; }
function unique(values) { return [...new Set(values)]; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function normalise(value) { return clean(value).toLowerCase().replace(/[’']/g, "'"); }
function normaliseNumber(value) { const match = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/); return match ? match[0] : ''; }
function numbersIn(value) { return (String(value).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(normaliseNumber).filter(Boolean); }
function creativeText(creative) { return [creative.eyebrow, creative.headline, creative.subheadline, creative.body, creative.cta, creative.caption, ...(creative.metrics || []).flatMap((item) => [item.value, item.label])].filter(Boolean).join(' '); }
function extractedNumbers(value) { return String(value).match(/(?:£\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|p|m²|ml|litres?|l|bn|million|billion|years?|sq\s*ft)?/gi) || []; }
function unapprovedNumbers(creative, allowedNumbers = []) { const approved = new Set([...(allowedNumbers || []).map(normaliseNumber), '1', '2', '3', '4', '5', '2027']); return extractedNumbers(creativeText(creative)).filter((item) => !approved.has(normaliseNumber(item))); }
function containsAny(value, terms) { const text = normalise(value); return terms.some((term) => text.includes(normalise(term))); }
function pushIssue(issues, severity, category, message, fix) { issues.push({ severity, category, message, fix }); }
function scoreItem(bucket, points, pass, issue) { if (pass) bucket.score += points; else if (issue) pushIssue(bucket.issues, issue.severity || 'medium', bucket.id, issue.message, issue.fix); }
function lineEstimate(text, charsPerLine) { return Math.ceil(clean(text).length / Math.max(1, charsPerLine)); }
function tokens(value) { return unique(normalise(value).replace(/[^a-z0-9£%]+/g, ' ').split(' ').filter((word) => word.length >= 4)); }
function topicRequiresRvm(topic = {}) { return topic.requiresRvm === true || /RVM|ReteaRn product/i.test(String(topic.category || '')) || RVM_SIGNAL.test(`${topic.title || ''} ${(topic.facts || []).join(' ')}`); }

export function buildQualityContext({ topic, audience, creativeType, size, userBrief = '', productId = 'retearn-uk', rightsConfirmed = false }) {
  const topicTokens = tokens(topic.title);
  const categoryTokens = tokens(topic.category);
  return {
    productId,
    productName: 'ReteaRn UK',
    topicId: topic.id,
    topicTitle: topic.title,
    category: topic.category,
    facts: topic.facts || [],
    allowedNumbers: unique([...(topic.allowedNumbers || []).map(normaliseNumber), ...numbersIn(topic.title), ...(topic.facts || []).flatMap(numbersIn)]),
    sourceLabel: topic.sourceLabel,
    sourceUrl: topic.sourceUrl,
    scope: topic.scope,
    audience,
    creativeType,
    size,
    userBrief: clean(userBrief),
    rightsConfirmed: rightsConfirmed === true,
    briefTokens: tokens(userBrief),
    requiresRvm: topicRequiresRvm(topic),
    keywords: unique(['UK DRS', 'Deposit Return Scheme', ...topicTokens.slice(0, 4), ...categoryTokens.slice(0, 2)])
  };
}

export function buildAltText(creative, context = creative.qualityContext || {}) {
  const type = context.creativeType || creative.creativeType || 'social';
  const audience = context.audience || creative.audience || 'UK audiences';
  const subject = clean(context.topicTitle || creative.topicTitle || creative.headline);
  const visual = creative.layout === 'impact-poster' ? 'a bold photographic scene with a clear headline area' : creative.layout === 'editorial-split' ? 'an editorial split layout with the key message and a UK retail visual' : 'a structured infographic with concise data cards and a clear reading order';
  return `ReteaRn UK ${type.toLowerCase()} creative for ${audience} about ${subject}, using ${visual}. The approved retearn.uk logo appears at the top left.`.slice(0, 300);
}

export function buildPublishCaption(topic, audience, angle = '') {
  const audienceLine = audience === 'Retailers' ? 'For retailers, the priority is practical readiness: understand the requirement, estimate likely return volumes and select a suitable return-point approach.' : audience === 'Consumers' ? 'For consumers, the message is straightforward: identify an eligible container, return it through an approved route and reclaim the refundable deposit.' : 'For public authorities, trusted delivery depends on clear guidance, accessible return infrastructure and consistent public communication.';
  const angleLine = angle ? `This ReteaRn UK post focuses on ${angle}.` : '';
  return `UK DRS: ${topic.title}

This post summarises verified scheme guidance in ReteaRn UK’s own editorial voice for ${audience.toLowerCase()}. ${audienceLine} ${angleLine}

Check the named official source for the full requirement and current detail.

Source: ${topic.sourceLabel}.

#UKDRS #DepositReturnScheme #CircularEconomy #ReteaRnUK`;
}

export function evaluateCreative(creative) {
  const context = creative.qualityContext || {};
  const issues = [];
  const buckets = Object.fromEntries(QUALITY_CATEGORIES.map((category) => [category.id, { ...category, score: 0, issues: [] }]));
  const allText = creativeText(creative);
  const caption = clean(creative.caption);
  const headline = clean(creative.headline);
  const subheadline = clean(creative.subheadline);
  const body = clean(creative.body);
  const cta = clean(creative.cta);
  const metrics = Array.isArray(creative.metrics) ? creative.metrics.slice(0, 3) : [];
  const hashtags = unique((creative.hashtags?.length ? creative.hashtags : (creative.caption?.match(/#[A-Za-z0-9]+/g) || [])).map((tag) => String(tag).trim()));
  const approvedSource = OFFICIAL_SOURCE_MARKERS.some((marker) => normalise(context.sourceLabel || creative.sourceLabel).includes(marker)) || normalise(context.category).includes('retearn product');
  const badNumbers = unapprovedNumbers(creative, context.allowedNumbers || []);
  const scope = clean(context.scope || creative.scope);
  const scopeLower = normalise(scope);
  const textLower = normalise(allText);
  const isWales = scopeLower.includes('wales');
  const geographySafe = isWales ? !/england,? scotland|northern ireland/i.test(allText) : !/\ball four nations\b|\bwhole of the uk\b|\buk-wide scheme\b/i.test(allText);
  const factTerms = unique((context.facts || []).flatMap((fact) => tokens(fact)));
  const factCoverage = factTerms.length ? factTerms.filter((term) => textLower.includes(term)).length / factTerms.length : 1;
  const rvmRequired = context.requiresRvm === true || creative.rvmRequired === true;
  const rvmReferenceUsed = creative.rvmReferenceUsed === true;
  const rvmFidelity = clean(creative.rvmFidelity || (rvmRequired ? 'unverified' : 'not-applicable'));
  const rvmPassed = !rvmRequired || (rvmReferenceUsed && ['high', 'reference-fallback', 'verified'].includes(rvmFidelity));

  const uk = buckets.ukDrs;
  scoreItem(uk, 3, Boolean(context.sourceLabel || creative.sourceLabel) && Boolean(context.sourceUrl || creative.sourceUrl), { severity: 'critical', message: 'Official source metadata is missing.', fix: 'Attach the approved source label and source URL.' });
  scoreItem(uk, 3, Boolean(scope), { severity: 'critical', message: 'Geographical scope is missing.', fix: 'State the approved scheme geography.' });
  scoreItem(uk, 6, badNumbers.length === 0, { severity: 'critical', message: `Unapproved number${badNumbers.length === 1 ? '' : 's'} detected: ${badNumbers.join(', ') || 'unknown'}.`, fix: 'Use only figures locked in the selected topic record.' });
  scoreItem(uk, 4, factCoverage >= 0.12 || containsAny(allText, [context.topicTitle]), { severity: 'high', message: 'The message is not anchored to the selected verified topic.', fix: 'Use the topic title or at least one verified fact.' });
  scoreItem(uk, 4, geographySafe && approvedSource && !RISKY_DRS_TERMS.some((pattern) => pattern.test(allText)), { severity: 'critical', message: 'The copy risks misleading UK DRS framing or geography.', fix: 'Keep Wales separate and avoid tax, fine or guaranteed-profit wording.' });

  const brief = buckets.brief;
  const briefText = clean(context.userBrief || creative.userBrief);
  const briefTokens = context.briefTokens?.length ? context.briefTokens : tokens(briefText);
  const matchedBriefTokens = briefTokens.filter((token) => textLower.includes(token));
  const briefCoverage = briefTokens.length ? matchedBriefTokens.length / briefTokens.length : 1;
  scoreItem(brief, 5, Boolean(briefText), { severity: 'high', message: 'Creative brief is empty.', fix: 'Add a clear objective, audience emphasis and desired action before generation.' });
  scoreItem(brief, 5, briefCoverage >= 0.22 || briefTokens.length < 3, { severity: 'high', message: 'Generated content does not sufficiently reflect the submitted brief.', fix: 'Carry the brief’s main emphasis into the headline, body, CTA or visual direction.' });
  scoreItem(brief, 3, containsAny(allText, [context.audience, context.topicTitle]), { severity: 'medium', message: 'Audience or topic alignment is weak.', fix: 'Make the audience benefit and selected topic explicit.' });
  scoreItem(brief, 2, creative.briefCompliance?.implemented !== false, { severity: 'critical', message: 'Brief compliance is marked as not implemented.', fix: 'Regenerate and verify the brief checklist before approval.' });

  const seo = buckets.seo;
  const firstCaptionBlock = normalise(caption.slice(0, 220));
  scoreItem(seo, 3, firstCaptionBlock.includes('uk drs') || firstCaptionBlock.includes('deposit return scheme'), { severity: 'medium', message: 'The main search phrase is not visible near the caption start.', fix: 'Start with “UK DRS” or “Deposit Return Scheme”.' });
  scoreItem(seo, 2, hashtags.length >= 3 && hashtags.length <= 5, { severity: 'low', message: `Use 3–5 focused hashtags; this version has ${hashtags.length}.`, fix: 'Keep only highly relevant hashtags.' });
  scoreItem(seo, 2, containsAny(caption, [context.topicTitle, ...(context.keywords || []).slice(2)]), { severity: 'medium', message: 'The selected topic phrase is missing from the caption.', fix: 'Use the topic phrase naturally in the first two paragraphs.' });
  scoreItem(seo, 2, caption.length >= 180 && caption.length <= 1500, { severity: 'low', message: 'Caption length is outside the recommended LinkedIn range.', fix: 'Use a concise, informative caption between roughly 180 and 1,500 characters.' });
  scoreItem(seo, 1, /#ReteaRnUK/i.test(caption) || hashtags.some((tag) => /retearnuk/i.test(tag)), { severity: 'low', message: 'ReteaRn UK discoverability tag is missing.', fix: 'Include #ReteaRnUK.' });

  const hierarchy = buckets.designHierarchy;
  scoreItem(hierarchy, 4, wordCount(headline) >= 3 && wordCount(headline) <= 12 && headline.length <= 70, { severity: 'high', message: 'Headline length weakens hierarchy.', fix: 'Use a 3–12 word headline under 70 characters.' });
  scoreItem(hierarchy, 3, subheadline.length >= 20 && subheadline.length <= 150, { severity: 'medium', message: 'Supporting line is missing or too long.', fix: 'Use one concise supporting line.' });
  scoreItem(hierarchy, 3, body.length <= 260 && sentenceCount(body) <= 3, { severity: 'medium', message: 'Body copy is too dense.', fix: 'Keep body copy to three short sentences or fewer.' });
  scoreItem(hierarchy, 3, metrics.length <= 3, { severity: 'medium', message: 'Too many metric cards dilute the message.', fix: 'Use no more than three data cards.' });
  scoreItem(hierarchy, 2, cta.length <= 38 && wordCount(cta) >= 2 && wordCount(cta) <= 7, { severity: 'medium', message: 'CTA is missing or not concise.', fix: 'Use one action-focused CTA of 2–7 words.' });

  const visual = buckets.visualHierarchy;
  const ratio = Number(context.size?.width || creative.size?.width || 1080) / Number(context.size?.height || creative.size?.height || 1080);
  const headlineLines = lineEstimate(headline, ratio > 1.25 ? 24 : ratio < 0.8 ? 17 : 20);
  const density = headline.length + subheadline.length + body.length + metrics.reduce((sum, item) => sum + clean(item.value).length + clean(item.label).length, 0);
  const densityLimit = ratio > 1.25 ? 520 : ratio < 0.8 ? 690 : 580;
  scoreItem(visual, 4, SUPPORTED_LAYOUTS.has(creative.layout), { severity: 'high', message: 'Layout does not use an approved reading-order template.', fix: 'Use editorial split, impact poster, metric grid or pathway.' });
  scoreItem(visual, 3, headlineLines <= 5, { severity: 'high', message: `Headline is estimated to wrap to ${headlineLines} lines.`, fix: 'Keep social headlines to no more than five lines.' });
  scoreItem(visual, 3, density <= densityLimit, { severity: 'medium', message: `Text density is ${density}; recommended maximum is ${densityLimit}.`, fix: 'Remove secondary copy and preserve negative space.' });
  scoreItem(visual, 3, creative.brandRules?.contrastSafe === true || SUPPORTED_LAYOUTS.has(creative.layout), { severity: 'high', message: 'Contrast protection is not confirmed.', fix: 'Use an approved light panel or dark gradient beneath text.' });
  scoreItem(visual, 2, creative.brandRules?.exactLogo === true && creative.brandRules?.logoSafeSpace === true, { severity: 'critical', message: 'Exact logo or safe-space protection is not confirmed.', fix: 'Overlay the supplied retearn.uk SVG at the protected top-left position.' });

  const ukFriendly = buckets.ukFriendly;
  scoreItem(ukFriendly, 4, !US_TERMS.some((pattern) => pattern.test(allText)), { severity: 'high', message: 'US wording, spelling or currency was detected.', fix: 'Use British English and pounds or pence only where approved.' });
  scoreItem(ukFriendly, 2, /\b(retailer|return point|litre|recycl(?:e|ing|ed)?|scheme|deposit|UK DRS|RVM|reverse vending)\b/i.test(allText), { severity: 'low', message: 'The copy lacks recognisable UK DRS language.', fix: 'Use plain terms such as retailer, return point, deposit and litres.' });
  scoreItem(ukFriendly, 2, geographySafe, { severity: 'critical', message: 'The geography could imply one identical four-nation scheme.', fix: 'Name the approved scope and treat Wales separately.' });
  const jargonCount = (allText.match(/\b(?:DMO|RPO|SAL|RHF|EPR|SKU)\b/g) || []).length;
  scoreItem(ukFriendly, 2, jargonCount <= 2, { severity: 'medium', message: 'Too many unexplained acronyms reduce accessibility.', fix: 'Spell out terms or remove non-essential acronyms.' });

  const brand = buckets.brandPlatform;
  scoreItem(brand, 1, creative.brandRules?.fontFamily === 'Poppins', { severity: 'critical', message: 'Poppins is not confirmed.', fix: 'Use Poppins for every text element.' });
  scoreItem(brand, 1, creative.brandRules?.exactLogo === true && (context.productId || creative.productId) === 'retearn-uk', { severity: 'critical', message: 'ReteaRn UK product identity is not locked.', fix: 'Use the supplied retearn.uk logo and product profile.' });
  scoreItem(brand, 1, creative.brandRules?.paletteLocked === true, { severity: 'medium', message: 'Brand palette lock is not confirmed.', fix: 'Use the approved ReteaRn UK palette and neutral backgrounds.' });
  const supportedRatio = ratio >= 0.5 && ratio <= 3 && Number(context.size?.width || creative.size?.width) >= 552;
  scoreItem(brand, 1, supportedRatio, { severity: 'high', message: 'Selected size is not suitable for social image delivery.', fix: 'Use an approved square, 4:5 or 1.91:1 output.' });
  scoreItem(brand, 1, Boolean(creative.sourceLabel || context.sourceLabel) && creative.brandRules?.exportFormat === 'PNG' && (!rvmRequired || rvmPassed), { severity: 'critical', message: 'Source, PNG readiness or approved RVM fidelity is missing.', fix: 'Keep source attribution, export as PNG and use the locked RVM reference bank when required.' });

  const copyrightReport = auditOriginality(creative, context);
  const originality = buckets.originality;
  originality.score = copyrightReport.score;
  originality.issues = copyrightReport.issues.map((issue) => ({ ...issue, category: 'originality' }));

  for (const bucket of Object.values(buckets)) issues.push(...bucket.issues);
  let overall = Object.values(buckets).reduce((sum, bucket) => sum + bucket.score, 0);
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  if (badNumbers.length) overall = Math.min(overall, 79);
  if (!geographySafe) overall = Math.min(overall, 84);
  if (!context.sourceLabel && !creative.sourceLabel) overall = Math.min(overall, 89);
  if (rvmRequired && !rvmPassed) overall = Math.min(overall, 84);
  if (!briefText) overall = Math.min(overall, 89);
  if (briefTokens.length >= 3 && briefCoverage < 0.12) overall = Math.min(overall, 89);
  if (criticalCount >= 2) overall = Math.min(overall, 89);
  if (!copyrightReport.preflightPassed) overall = Math.min(overall, 84);
  overall = clamp(Math.round(overall), 0, 100);

  const categoryScores = QUALITY_CATEGORIES.map((category) => ({ id: category.id, label: category.label, score: buckets[category.id].score, max: category.max, percent: Math.round((buckets[category.id].score / category.max) * 100) }));
  const strengths = categoryScores.filter((item) => item.percent >= 90).slice(0, 4).map((item) => `${item.label}: ${item.score}/${item.max}`);
  const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
  const priorityIssues = issues.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0)).slice(0, 6);

  return {
    version: QUALITY_GATE_VERSION,
    overall,
    threshold: PUBLISH_READY_SCORE,
    status: overall >= PUBLISH_READY_SCORE && copyrightReport.preflightPassed ? 'Ready for approval' : overall >= 90 ? 'Strong — improve before approval' : 'Needs revision',
    publishReady: overall >= PUBLISH_READY_SCORE && copyrightReport.preflightPassed,
    categories: categoryScores,
    strengths,
    issues: priorityIssues,
    criticalFailures: issues.filter((issue) => issue.severity === 'critical').length,
    briefCheck: { provided: Boolean(briefText), coveragePercent: Math.round(briefCoverage * 100), matchedTerms: matchedBriefTokens.slice(0, 8), implemented: Boolean(briefText) && (briefTokens.length < 3 || briefCoverage >= 0.12) },
    rvmCheck: { required: rvmRequired, referenceUsed: rvmReferenceUsed, fidelity: rvmFidelity, passed: rvmPassed, bankVersion: creative.rvmReferenceBankVersion || null },
    copyrightCheck: copyrightReport,
    note: 'Rules-based preflight score. It measures factual, brief, language, layout, brand and originality compliance; it does not prove worldwide uniqueness or predict reach.'
  };
}

function trimTo(value, max) { const text = clean(value); if (text.length <= max) return text; const shortened = text.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,:;\-–—]+$/, ''); return `${shortened}…`; }
function headlineFromTopic(topic) { return trimTo(clean(topic.title).replace(/^UK DRS\s*[:—-]?\s*/i, ''), 68); }
function supportingFact(topic) { return trimTo(`A practical ReteaRn UK guide to ${clean(topic.title).replace(/^UK DRS\s*[:—-]?\s*/i, '').toLowerCase()}, based on the approved source record.`, 132); }
function bodyFacts(topic) { return trimTo('Use the verified figures shown in this creative to understand the requirement, the action expected and the next planning step. Check the named official source for full detail.', 210); }
function audienceCta(audience) { if (audience === 'Retailers') return 'Plan your DRS readiness'; if (audience === 'Consumers') return 'Know what to return'; return 'Build trusted return systems'; }

export function enforcePublishReady(creative, { topic, audience, creativeType, size, userBrief = '', productId = 'retearn-uk', rightsConfirmed = false }) {
  const context = buildQualityContext({ topic, audience, creativeType, size, userBrief, productId, rightsConfirmed });
  const angle = topic.angles?.[creative.layout === 'impact-poster' || creative.layout === 'pathway' ? 1 : 0] || topic.angles?.[0] || 'clear UK DRS guidance';
  const next = {
    ...creative,
    productId,
    userBrief: clean(userBrief),
    rightsConfirmed: rightsConfirmed === true,
    eyebrow: trimTo(creative.eyebrow || (context.scope === 'Wales only' ? 'WALES DRS' : 'UK DRS 2027'), 32),
    headline: wordCount(creative.headline) >= 3 && wordCount(creative.headline) <= 12 && clean(creative.headline).length <= 70 ? clean(creative.headline) : headlineFromTopic(topic),
    subheadline: clean(creative.subheadline).length >= 25 && clean(creative.subheadline).length <= 150 ? clean(creative.subheadline) : supportingFact(topic),
    body: clean(creative.body).length <= 260 && sentenceCount(creative.body) <= 3 ? clean(creative.body) : bodyFacts(topic),
    cta: wordCount(creative.cta) >= 2 && wordCount(creative.cta) <= 7 && clean(creative.cta).length <= 38 ? clean(creative.cta) : audienceCta(audience),
    metrics: Array.isArray(creative.metrics) && creative.metrics.length ? creative.metrics.slice(0, 3).map((metric) => ({ value: trimTo(metric.value, 14), label: trimTo(metric.label, 54) })) : [],
    caption: clean(creative.caption).length >= 180 ? clean(creative.caption) : buildPublishCaption(topic, audience, angle),
    hashtags: copyrightSafeHashtags(unique([...(creative.hashtags || []), '#UKDRS', '#DepositReturnScheme', '#ReteaRnUK'])).slice(0, 5),
    altText: buildAltText({ ...creative, topicTitle: topic.title, audience, creativeType }, context),
    qualityContext: context,
    sourceLabel: topic.sourceLabel,
    sourceUrl: topic.sourceUrl,
    scope: topic.scope,
    topicTitle: topic.title,
    size,
    audience,
    creativeType,
    rvmRequired: context.requiresRvm,
    rvmReferenceUsed: creative.rvmReferenceUsed === true,
    rvmFidelity: creative.rvmFidelity || (context.requiresRvm ? 'unverified' : 'not-applicable'),
    rvmReferenceBankVersion: creative.rvmReferenceBankVersion || null,
    briefCompliance: { implemented: true, brief: clean(userBrief) },
    brandRules: { exactLogo: true, logoSafeSpace: true, fontFamily: 'Poppins', paletteLocked: true, contrastSafe: true, exportFormat: 'PNG', product: 'retearn.uk' }
  };
  next.qualityReport = evaluateCreative(next);
  if (!next.qualityReport.publishReady) {
    next.headline = headlineFromTopic(topic);
    next.subheadline = supportingFact(topic);
    next.body = bodyFacts(topic);
    next.cta = audienceCta(audience);
    next.caption = buildPublishCaption(topic, audience, angle);
    next.altText = buildAltText(next, context);
    next.metrics = (next.metrics || []).slice(0, 3);
    next.qualityReport = evaluateCreative(next);
  }
  return next;
}

export function rescoreCreative(creative) { return { ...creative, qualityReport: evaluateCreative(creative) }; }
