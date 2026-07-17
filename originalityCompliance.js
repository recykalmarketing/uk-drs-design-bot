export const COPYRIGHT_GATE_VERSION = 'RETEARN-UK-IP-1.0';
export const ORIGINALITY_PASS_SCORE = 9;

export const APPROVED_HASHTAGS = [
  '#ReteaRnUK', '#UKDRS', '#DRSUK', '#DepositReturnScheme', '#CircularEconomy',
  '#ReverseVending', '#RetailReadiness', '#RecyclingInfrastructure', '#BottleReturn',
  '#CanReturn', '#RetailSustainability', '#ResourceRecovery'
];

export const APPROVED_OWNED_MARKS = [
  'retearn', 'retearn uk', 'retearn.uk', 'recykal', 'reklaim ace'
];

export const THIRD_PARTY_MARKS = [
  'tomra', 'envipco', 'rvm systems', 'sielaff', 'coca-cola', 'coca cola', 'pepsi',
  'tesco', 'sainsbury', "sainsbury's", 'asda', 'morrisons', 'waitrose', 'aldi',
  'lidl', 'co-op', 'coop', 'marks & spencer', 'm&s'
];

export const COPYING_INSTRUCTION_PATTERNS = [
  /\bcopy\s+(?:this|that|the|their|competitor|brand|post|campaign|creative|design|layout|image)\b/i,
  /\breplicate\s+(?:this|that|the|their|competitor|brand|post|campaign|creative|design|layout|image)\b/i,
  /\bmake\s+it\s+(?:exactly\s+)?(?:the\s+)?same\s+as\b/i,
  /\bin\s+the\s+style\s+of\b/i,
  /\blook\s+exactly\s+like\b/i,
  /\buse\s+(?:their|the)\s+(?:logo|artwork|photo|image|illustration|infographic|layout|tagline|copy)\b/i,
  /\btrace\s+(?:this|the)\b/i,
  /\bdownload(?:ed)?\s+from\s+(?:google|pinterest|instagram|linkedin|facebook|behance|dribbble)\b/i
];

const COMMON_DRS_PHRASES = new Set([
  'deposit return scheme', 'uk deposit return scheme', 'uk drs', 'reverse vending machine',
  'return point', 'plastic bottles', 'metal cans', 'circular economy', 'exchange for change',
  'england scotland northern ireland', 'retearn uk'
]);

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function normalise(value) { return clean(value).toLowerCase().replace(/[’']/g, "'"); }
function words(value) { return normalise(value).replace(/[^a-z0-9£%]+/g, ' ').split(' ').filter(Boolean); }
function unique(values) { return [...new Set(values)]; }
function stripSourceLine(value) { return String(value || '').replace(/(?:^|\n)\s*source\s*:[^\n]*/gi, ' '); }
function mainCreativeText(creative) {
  return [creative.eyebrow, creative.headline, creative.subheadline, creative.body, creative.cta,
    stripSourceLine(creative.caption), ...(creative.metrics || []).flatMap((item) => [item.value, item.label])]
    .filter(Boolean).join(' ');
}
function allowedSourceNames(context = {}) {
  return [context.sourceLabel, 'gov.uk', 'defra', 'exchange for change', 'keep britain tidy', 'legislation.gov.uk']
    .filter(Boolean).map(normalise);
}
function markMatches(value, context = {}) {
  const text = normalise(value);
  const sourceAllow = allowedSourceNames(context);
  return THIRD_PARTY_MARKS.filter((mark) => text.includes(mark) && !sourceAllow.some((allowed) => allowed.includes(mark) || mark.includes(allowed)));
}
function longestCommonRun(left, right) {
  const a = words(left); const b = words(right);
  if (!a.length || !b.length) return { length: 0, phrase: '' };
  const prev = new Array(b.length + 1).fill(0);
  let bestLength = 0; let bestEnd = 0;
  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = prev[j - 1] + 1;
        if (current[j] > bestLength) { bestLength = current[j]; bestEnd = i; }
      }
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = current[j];
  }
  const phrase = a.slice(bestEnd - bestLength, bestEnd).join(' ');
  if (COMMON_DRS_PHRASES.has(phrase)) return { length: 0, phrase: '' };
  return { length: bestLength, phrase };
}
function sourceOverlap(creative, context = {}) {
  const fields = [
    ['headline', creative.headline], ['subheadline', creative.subheadline], ['body', creative.body],
    ['cta', creative.cta], ['caption', stripSourceLine(creative.caption)],
    ...(creative.metrics || []).flatMap((item, index) => [[`metric-${index + 1}`, `${item.value || ''} ${item.label || ''}`]])
  ];
  let best = { length: 0, phrase: '', field: '', source: '' };
  for (const [field, value] of fields) {
    for (const source of context.facts || []) {
      const overlap = longestCommonRun(value, source);
      if (overlap.length > best.length) best = { ...overlap, field, source };
    }
  }
  return best;
}
function invalidHashtags(creative) {
  const hashtags = unique((creative.hashtags?.length ? creative.hashtags : String(creative.caption || '').match(/#[A-Za-z0-9]+/g) || []).map((tag) => String(tag).trim()));
  const approved = new Set(APPROVED_HASHTAGS.map((tag) => tag.toLowerCase()));
  return hashtags.filter((tag) => !approved.has(tag.toLowerCase()));
}
function copyingInstructions(value) {
  return COPYING_INSTRUCTION_PATTERNS.filter((pattern) => pattern.test(String(value || ''))).map((pattern) => pattern.source);
}

export function validateRightsBrief({ userBrief = '', rightsConfirmed = false } = {}) {
  const copyRisks = copyingInstructions(userBrief);
  const thirdPartyMarks = markMatches(userBrief, {});
  const externalAssetSignals = /https?:\/\/|www\.|google images|pinterest|behance|dribbble|screenshot from|downloaded image/i.test(String(userBrief || ''));
  const issues = [];
  const warnings = [];
  if (!rightsConfirmed) issues.push('Confirm that the brief and any supplied references are owned, licensed or otherwise authorised for ReteaRn use.');
  if (copyRisks.length) issues.push('The brief asks to copy, replicate, trace or imitate another creative or style. Rewrite it as an original objective.');
  if (thirdPartyMarks.length) warnings.push(`Third-party brand reference detected in the brief: ${thirdPartyMarks.join(', ')}. It will not be reproduced in the creative without documented permission.`);
  if (externalAssetSignals) issues.push('External image links, screenshots and downloaded references are not accepted without documented permission.');
  return { passed: issues.length === 0, issues, warnings, copyRisks, thirdPartyMarks, externalAssetSignals };
}

export function auditOriginality(creative, context = {}) {
  const text = mainCreativeText(creative);
  const externalMarks = markMatches(text, context);
  const visualPromptMarks = markMatches(creative.visualPrompt || '', context);
  const promptCopyRisks = copyingInstructions(`${creative.visualPrompt || ''} ${context.userBrief || creative.userBrief || ''}`);
  const overlap = sourceOverlap(creative, context);
  const badHashtags = invalidHashtags(creative);
  const provenance = creative.provenance || {};
  const rightsConfirmed = context.rightsConfirmed === true || creative.rightsConfirmed === true || provenance.rightsConfirmed === true;
  const promptOriginalityLocked = /original composition|original editorial|original visual/i.test(String(creative.visualPrompt || '')) && !/in the style of/i.test(String(creative.visualPrompt || ''));
  const visualAudit = creative.visualCopyrightAudit || {};
  const visualStatus = visualAudit.status || (creative.imageGeneratedByAI ? 'pending-human-review' : creative.rvmReferenceUsed ? 'owned-reference' : 'procedural');
  const visualBlocked = visualStatus === 'blocked';
  const assetProvenance = provenance.rightsBasis === 'owned-assets-and-original-generation' && Array.isArray(provenance.referenceAssets);

  const issues = [];
  let score = 10;
  if (externalMarks.length) { score -= 3; issues.push({ severity: 'critical', message: `Unapproved third-party mark in creative copy: ${externalMarks.join(', ')}.`, fix: 'Remove third-party brand names, slogans, logos and identifying trade dress.' }); }
  if (visualPromptMarks.length) { score -= 2; issues.push({ severity: 'critical', message: `Unapproved third-party mark in visual direction: ${visualPromptMarks.join(', ')}.`, fix: 'Use generic unbranded settings and approved ReteaRn assets only.' }); }
  if (promptCopyRisks.length) { score -= 3; issues.push({ severity: 'critical', message: 'Copying or style-imitation language was detected.', fix: 'Describe the communication objective and visual principles without naming or reproducing another creator or campaign.' }); }
  if (overlap.length >= 9) { score -= 3; issues.push({ severity: 'critical', message: `Possible verbatim source reuse in ${overlap.field}: “${overlap.phrase}”.`, fix: 'Paraphrase the fact in ReteaRn UK’s own editorial voice while preserving its meaning.' }); }
  else if (overlap.length >= 6) { score -= 1; issues.push({ severity: 'medium', message: `High source-language similarity in ${overlap.field}: “${overlap.phrase}”.`, fix: 'Rewrite the sentence more distinctly.' }); }
  if (badHashtags.length) { score -= 1; issues.push({ severity: 'high', message: `Unapproved or brand-specific hashtags: ${badHashtags.join(', ')}.`, fix: 'Use only ReteaRn-owned or generic UK DRS topic hashtags.' }); }
  if (!rightsConfirmed) { score -= 2; issues.push({ severity: 'critical', message: 'Rights confirmation was not recorded.', fix: 'Confirm that the brief and any supplied references are owned, licensed or authorised.' }); }
  if (!promptOriginalityLocked) { score -= 1; issues.push({ severity: 'high', message: 'Original-composition instruction is not locked in the visual prompt.', fix: 'Regenerate with the ReteaRn original-only prompt policy.' }); }
  if (!assetProvenance) { score -= 1; issues.push({ severity: 'high', message: 'Generation provenance is incomplete.', fix: 'Record prompt hash, model, source facts and approved asset identifiers.' }); }
  if (visualBlocked) { score = 0; issues.push({ severity: 'critical', message: 'The visual audit detected a third-party logo, watermark, branded packaging, copyrighted character or imitation risk.', fix: 'Regenerate the visual using generic, unbranded elements and approved owned assets only.' }); }

  score = Math.max(0, Math.min(10, score));
  const criticalFailures = issues.filter((issue) => issue.severity === 'critical').length;
  const preflightPassed = score >= ORIGINALITY_PASS_SCORE && criticalFailures === 0 && !visualBlocked;
  const humanReviewRequired = !['passed', 'owned-reference', 'procedural', 'human-approved'].includes(visualStatus);

  return {
    version: COPYRIGHT_GATE_VERSION,
    score,
    max: 10,
    percent: score * 10,
    status: preflightPassed ? (humanReviewRequired ? 'Preflight passed · human visual attestation required' : 'Copyright preflight passed') : 'Copyright preflight blocked',
    preflightPassed,
    publishSafe: preflightPassed && !humanReviewRequired,
    humanReviewRequired,
    visualStatus,
    checks: {
      noThirdPartyMarks: externalMarks.length === 0 && visualPromptMarks.length === 0,
      noCopyingInstruction: promptCopyRisks.length === 0,
      noLongSourceOverlap: overlap.length < 9,
      hashtagsApproved: badHashtags.length === 0,
      rightsConfirmed,
      promptOriginalityLocked,
      provenanceRecorded: assetProvenance,
      visualAuditNotBlocked: !visualBlocked
    },
    sourceSimilarity: overlap,
    detectedThirdPartyMarks: unique([...externalMarks, ...visualPromptMarks]),
    invalidHashtags: badHashtags,
    issues,
    note: 'Automated originality checks reduce risk but cannot prove worldwide uniqueness. Final publication requires Brand Manager and Design Manager rights attestations.'
  };
}

export function copyrightSafeHashtags(input = []) {
  const approved = new Set(APPROVED_HASHTAGS.map((tag) => tag.toLowerCase()));
  return unique(input.map((tag) => String(tag).trim()).filter((tag) => approved.has(tag.toLowerCase())));
}
