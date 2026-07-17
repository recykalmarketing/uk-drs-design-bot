import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { enforcePublishReady, evaluateCreative, PUBLISH_READY_SCORE, QUALITY_GATE_VERSION } from './src/qualityScoring.js';
import { APPROVED_HASHTAGS, COPYRIGHT_GATE_VERSION, validateRightsBrief } from './src/originalityCompliance.js';
import { createWorkflowService } from './workflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadLocalEnv();

const port = Number(process.env.PORT || 10000);
const topicsPath = path.join(__dirname, 'knowledge', 'topics.json');
const sizesPath = path.join(__dirname, 'knowledge', 'sizes.json');
const productsPath = path.join(__dirname, 'knowledge', 'products.json');
const visualLanguagePath = path.join(__dirname, 'knowledge', 'uk-drs-visual-language.json');
const originalityPolicyPath = path.join(__dirname, 'knowledge', 'originality-policy.json');
const rightsManifestPath = path.join(__dirname, 'reference', 'rights-manifest.json');
const distPath = path.join(__dirname, 'dist');
const rvmPlacementReferencePath = path.join(__dirname, 'reference', 'rvm-placement-reference.png');
const rvmSpecificationReferencePath = path.join(__dirname, 'reference', 'rvm-specification-reference.png');
const RVM_REFERENCE_BANK_VERSION = 'RETEARN-RVM-BANK-2026-07-17';

for (const requiredPath of [topicsPath, sizesPath, productsPath, visualLanguagePath, originalityPolicyPath, rightsManifestPath, path.join(distPath, 'index.html'), rvmPlacementReferencePath, rvmSpecificationReferencePath]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`Required deployment file is missing: ${requiredPath}`);
    process.exit(1);
  }
}

const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
const sizes = JSON.parse(fs.readFileSync(sizesPath, 'utf8'));
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const activeProduct = products.find((product) => product.status === 'active') || products[0];
const visualLanguage = JSON.parse(fs.readFileSync(visualLanguagePath, 'utf8'));
const originalityPolicy = JSON.parse(fs.readFileSync(originalityPolicyPath, 'utf8'));
const rightsManifest = JSON.parse(fs.readFileSync(rightsManifestPath, 'utf8'));
const workflowService = createWorkflowService({ rootDir: __dirname, product: activeProduct, qualityThreshold: PUBLISH_READY_SCORE });
const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6';
const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const imageQuality = process.env.OPENAI_IMAGE_QUALITY || 'medium';
const appAccessCode = process.env.APP_ACCESS_CODE || '';
const monthlyBudgetUsd = Number(process.env.MONTHLY_BUDGET_USD || 95);
const monthlyCreativeBatchLimit = Number(process.env.MONTHLY_CREATIVE_BATCH_LIMIT || 500);
const monthlyRegenerationLimit = Number(process.env.MONTHLY_REGENERATION_LIMIT || 500);
const estimatedCopyCostUsd = Number(process.env.ESTIMATED_COPY_COST_USD || 0.01);
const estimatedRegenCopyCostUsd = Number(process.env.ESTIMATED_REGEN_COPY_COST_USD || 0.005);
const estimatedVisualAuditCostUsd = Number(process.env.ESTIMATED_VISUAL_AUDIT_COST_USD || 0.003);
const enableVisualIpAudit = String(process.env.ENABLE_VISUAL_IP_AUDIT || 'true').toLowerCase() !== 'false';
const usageFile = process.env.USAGE_FILE || path.join(__dirname, '.runtime', 'usage.json');

const BRAND = {
  purple: '#6a398c', magenta: '#9c539c', violet: '#a16dc9',
  green: '#5b8563', blue: '#00b4d8', ink: '#17111f', paper: '#fbfafc'
};

const AUDIENCE_VISUALS = {
  Retailers: 'a contemporary UK grocery or convenience retail environment, practical store operations, return-point planning and a compact reverse vending machine area',
  Consumers: 'a welcoming everyday UK public setting with diverse adults returning clean empty plastic bottles and metal cans, clear actions and positive environmental behaviour',
  'Government Authorities': 'a sophisticated public-infrastructure and circular-economy visual, clean urban systems, retail return network and material-flow symbolism'
};

const RVM_TOPIC_IDS = new Set([
  'manual-vs-rvm', 'rvm-buying-checklist', 'rvm-recognition', 'rvm-data-connectivity',
  'rvm-accessibility', 'retearn-zero-capex', 'reklaim-ace', 'rvm-market-education'
]);
const RVM_SIGNAL = /\b(?:rvm|reverse vending|reklaim ace|reclaim ace|make the machine|machine as hero|automated return point)\b/i;
const RVM_REFERENCE_DESCRIPTION = 'Approved ReteaRn UK RVM: tall compact cabinet, glossy civic navy body, silver-white trim rails, dark navy top header carrying the retearn.uk wordmark, vertical touchscreen on the upper-left front, circular bottle-and-can inlet on the upper-right with an amber LED ring, narrow receipt/card slot beneath, clean lower cabinet, approximately 1900 mm high, 650 mm wide and 700 mm deep.';
const rvmReferenceDataUrls = [rvmPlacementReferencePath, rvmSpecificationReferencePath].map((filePath) => `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`);

function topicRequiresRvm(topic, direction = '') {
  return topic?.requiresRvm === true || RVM_TOPIC_IDS.has(topic?.id) || /RVM|ReteaRn product/i.test(String(topic?.category || '')) || RVM_SIGNAL.test(`${topic?.title || ''} ${(topic?.facts || []).join(' ')} ${direction || ''}`);
}

const IMAGE_PRICE_USD = {
  'gpt-image-2': {
    low: { square: 0.006, portrait: 0.005, landscape: 0.005 },
    medium: { square: 0.053, portrait: 0.041, landscape: 0.041 },
    high: { square: 0.211, portrait: 0.165, landscape: 0.165 }
  },
  'gpt-image-1.5': {
    low: { square: 0.009, portrait: 0.013, landscape: 0.013 },
    medium: { square: 0.034, portrait: 0.05, landscape: 0.05 },
    high: { square: 0.133, portrait: 0.2, landscape: 0.2 }
  }
};

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

async function readJson(req, maxBytes = 12 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Request body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON body.'), { status: 400 });
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorised(req) {
  if (!appAccessCode) return true;
  return safeEqual(req.headers['x-app-access-code'] || '', appAccessCode);
}

function monthKey() { return new Date().toISOString().slice(0, 7); }
function freshUsage() { return { month: monthKey(), creativeBatches: 0, regenerations: 0, imageOutputs: 0, estimatedSpendUsd: 0 }; }
function loadUsage() {
  try {
    const parsed = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    return parsed?.month === monthKey() ? { ...freshUsage(), ...parsed } : freshUsage();
  } catch { return freshUsage(); }
}
let usage = loadUsage();
function persistUsage() {
  try {
    fs.mkdirSync(path.dirname(usageFile), { recursive: true });
    fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2));
  } catch (error) { console.error('Could not persist usage ledger:', error.message); }
}
function ensureCurrentMonth() { if (usage.month !== monthKey()) { usage = freshUsage(); persistUsage(); } }
function ratioBucket(size) { const r = size.width / size.height; return r > 1.25 ? 'landscape' : r < 0.8 ? 'portrait' : 'square'; }
function estimatedImageCost(size, count = 1) { return (IMAGE_PRICE_USD[imageModel]?.[imageQuality]?.[ratioBucket(size)] ?? 0.22) * count; }
function roundedMoney(value) { return Math.round(value * 10000) / 10000; }
function usageSnapshot() {
  ensureCurrentMonth();
  return {
    ...usage,
    estimatedSpendUsd: roundedMoney(usage.estimatedSpendUsd),
    remainingBudgetUsd: roundedMoney(Math.max(0, monthlyBudgetUsd - usage.estimatedSpendUsd)),
    remainingCreativeBatches: Math.max(0, monthlyCreativeBatchLimit - usage.creativeBatches),
    remainingRegenerations: Math.max(0, monthlyRegenerationLimit - usage.regenerations)
  };
}
function reserveUsage({ kind, size, imageCount, includeCopy = true }) {
  if (!hasApiKey) return { ok: true, usage: usageSnapshot(), estimatedCostUsd: 0 };
  ensureCurrentMonth();
  const isBatch = kind === 'creative-batch';
  const cost = estimatedImageCost(size, imageCount) + (includeCopy ? (isBatch ? estimatedCopyCostUsd : estimatedRegenCopyCostUsd) : 0) + (enableVisualIpAudit ? estimatedVisualAuditCostUsd * imageCount : 0);
  if (isBatch && usage.creativeBatches >= monthlyCreativeBatchLimit) return { ok: false, message: `Monthly limit reached: ${monthlyCreativeBatchLimit} two-option creative batches.`, usage: usageSnapshot() };
  if (!isBatch && usage.regenerations >= monthlyRegenerationLimit) return { ok: false, message: `Monthly regeneration limit reached: ${monthlyRegenerationLimit}.`, usage: usageSnapshot() };
  if (usage.estimatedSpendUsd + cost > monthlyBudgetUsd) return { ok: false, message: `The app-side monthly budget guard of $${monthlyBudgetUsd.toFixed(2)} has been reached.`, usage: usageSnapshot() };
  if (isBatch) usage.creativeBatches += 1; else usage.regenerations += 1;
  usage.imageOutputs += imageCount;
  usage.estimatedSpendUsd = roundedMoney(usage.estimatedSpendUsd + cost);
  persistUsage();
  return { ok: true, usage: usageSnapshot(), estimatedCostUsd: roundedMoney(cost) };
}

function id() { return crypto.randomUUID(); }
function findTopic(topicId) { return topics.find((topic) => topic.id === topicId); }
function findSize(sizeId) { return sizes.find((size) => size.id === sizeId); }
function safeJson(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {} }
    return null;
  }
}
function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if ((content?.type === 'output_text' || content?.type === 'text') && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

async function openAIRequest(endpoint, body, timeoutMs = 180000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed with status ${response.status}.`;
      throw new Error(message);
    }
    return payload;
  } finally { clearTimeout(timer); }
}

function sha256(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }

async function auditVisualCopyright(backgroundImage, { rvmRequired = false, imageGeneratedByAI = false } = {}) {
  if (!imageGeneratedByAI) {
    return {
      status: rvmRequired ? 'owned-reference' : 'procedural',
      passed: true,
      humanReviewRequired: false,
      flags: [],
      note: rvmRequired ? 'Approved user-supplied ReteaRn RVM reference used.' : 'Procedural visual generated locally without external assets.',
      auditedAt: new Date().toISOString()
    };
  }
  if (!enableVisualIpAudit || !hasApiKey) {
    return {
      status: 'pending-human-review',
      passed: true,
      humanReviewRequired: true,
      flags: [],
      note: 'Automated visual IP audit is unavailable; Design Manager attestation is mandatory before publishing.',
      auditedAt: new Date().toISOString()
    };
  }
  try {
    const auditPrompt = `Act as a conservative visual intellectual-property preflight reviewer for a ReteaRn UK social creative. Inspect the supplied generated image only. The only permitted visible brand is the exact retearn.uk wordmark on the approved ReteaRn reverse vending machine when an RVM is present. Flag any other logo, retailer identity, beverage label, watermark, copyrighted character, celebrity or public-figure likeness, copied app interface, recognisable campaign artwork, or obvious imitation of a competitor reverse vending machine. Generic unbranded UK retail settings, anonymous adults and generic bottles or cans are allowed. Return JSON only: {"passed":true,"flags":[],"summary":"..."}. If uncertain, set passed to false and explain the risk.`;
    const payload = await openAIRequest('responses', {
      model: textModel,
      input: [{ role: 'user', content: [{ type: 'input_text', text: auditPrompt }, { type: 'input_image', image_url: backgroundImage }] }],
      reasoning: { effort: 'none' },
      max_output_tokens: 700
    }, 120000);
    const parsed = safeJson(extractResponseText(payload));
    const passed = parsed?.passed === true && Array.isArray(parsed?.flags) && parsed.flags.length === 0;
    return {
      status: passed ? 'passed' : 'blocked',
      passed,
      humanReviewRequired: true,
      flags: Array.isArray(parsed?.flags) ? parsed.flags.slice(0, 8) : ['Visual audit could not confirm originality.'],
      note: parsed?.summary || (passed ? 'No unapproved visible brand or copyright signal detected.' : 'Potential visual IP risk detected.'),
      model: textModel,
      auditedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'pending-human-review',
      passed: true,
      humanReviewRequired: true,
      flags: [],
      note: `Automated visual audit unavailable: ${error.message}. Design Manager attestation is mandatory.`,
      auditedAt: new Date().toISOString()
    };
  }
}

function attachProvenance(option, topic, userBrief, rightsConfirmed) {
  const referenceAssets = option.rvmRequired ? ['retearn-uk-logo', 'retearn-rvm-placement-reference', 'retearn-rvm-specification-reference'] : ['retearn-uk-logo'];
  return {
    ...option,
    rightsConfirmed: rightsConfirmed === true,
    provenance: {
      generationId: option.provenance?.generationId || id(),
      generatedAt: option.provenance?.generatedAt || new Date().toISOString(),
      productId: activeProduct.id,
      copyModel: hasApiKey ? textModel : 'deterministic-fallback',
      imageModel: option.imageGeneratedByAI ? imageModel : option.rvmReferenceUsed ? 'approved-reference-fallback' : 'procedural-svg',
      promptHash: sha256(option.visualPrompt),
      briefHash: sha256(userBrief),
      sourceUrl: topic.sourceUrl,
      sourceLabel: topic.sourceLabel,
      sourceUse: 'facts-and-citations-only; no source imagery copied',
      rightsBasis: 'owned-assets-and-original-generation',
      rightsConfirmed: rightsConfirmed === true,
      referenceAssets,
      rightsManifestVersion: rightsManifest.version,
      originalityPolicyVersion: originalityPolicy.version,
      externalAssetFetch: false
    }
  };
}

function allCreativeText(option) {
  return [option.eyebrow, option.headline, option.subheadline, option.body, option.cta, option.caption, ...(option.metrics || []).flatMap((m) => [m.value, m.label])].filter(Boolean).join(' ');
}
function normalizeNumber(value) { return String(value).toLowerCase().replace(/[£$,\s]/g, '').replace(/p$/i, '').replace(/m²/g, '').replace(/ml/g, '').replace(/l$/i, ''); }
function hasUnapprovedNumbers(option, topic) {
  const found = allCreativeText(option).match(/(?:£\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|p|m²|ml|l|bn|million|billion|years?|sq\s*ft)?/gi) || [];
  const allowed = new Set((topic.allowedNumbers || []).map(normalizeNumber));
  const structural = new Set(['1', '2', '3', '4', '5']);
  return found.some((item) => { const normal = normalizeNumber(item.replace(/(million|billion|bn|years?|sqft|%)/gi, '')); return normal && !allowed.has(normal) && !structural.has(normal); });
}
function shortMetric(fact, index) {
  const number = fact.match(/(?:£\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|p|m²|ml|L|bn|million|billion)?/i)?.[0];
  if (!number) return { value: ['CHECK', 'PLAN', 'ACT'][index % 3], label: 'Verified UK DRS action' };
  const lower = fact.toLowerCase();
  let label = 'Approved UK DRS figure';
  if (/launch|goes live|starts on/.test(lower)) label = 'Scheme start date';
  else if (/deposit/.test(lower)) label = 'Refundable deposit per container';
  else if (/litter/.test(lower)) label = 'Share of litter by volume';
  else if (/collection rate|collection ambition|target/.test(lower)) label = 'Collection ambition';
  else if (/waste|not being recycled/.test(lower)) label = 'Containers lost from recycling';
  else if (/urban/.test(lower) && /m²/.test(lower)) label = 'Urban floor-space threshold';
  else if (/rural/.test(lower) && /m²/.test(lower)) label = 'Rural exemption threshold';
  else if (/grant|qualifying site|support/.test(lower)) label = 'Support for qualifying sites';
  else if (/manual/.test(lower) && /fee|handling/.test(lower)) label = 'Manual return handling fee';
  else if (/automated|rvm/.test(lower) && /fee|handling/.test(lower)) label = 'Automated return handling fee';
  else if (/150ml|3 litres|container sizes/.test(lower)) label = 'Eligible container size range';
  else if (/returns\/day|returns per day/.test(lower)) label = 'Daily return capacity';
  else if (/storage/.test(lower)) label = 'Storage capacity';
  return { value: number.replace(/\s+/g, ' '), label };
}
function captionFor(topic, audience, angle) {
  const audienceLine = audience === 'Retailers' ? 'For retailers, the next step is to translate official guidance into a practical readiness plan.' : audience === 'Consumers' ? 'For consumers, clear return instructions can make the scheme easier to understand and use.' : 'For public authorities, accessible and consistent communication will support public trust.';
  return `UK DRS: ${topic.title}\n\nReteaRn UK has summarised the selected issue in an original, practical format for ${audience.toLowerCase()}. ${audienceLine}${angle ? ` This post focuses on ${angle}.` : ''}\n\nCheck the named official source for the full requirement and current detail.\n\nSource: ${topic.sourceLabel}.\n\n#UKDRS #DepositReturnScheme #CircularEconomy #ReteaRnUK`;
}
function fallbackOptions(topic, audience, creativeType) {
  const angleA = topic.angles?.[0] || 'clear explainer'; const angleB = topic.angles?.[1] || 'practical guide';
  const metrics = topic.facts.slice(0, 3).map(shortMetric);
  const scopeLabel = topic.scope === 'Wales only' ? 'WALES DRS' : 'UK DRS 2027';
  const support = `A practical ReteaRn UK guide for ${audience.toLowerCase()}, based on the approved source record.`;
  const body = 'Use the verified figures shown here to understand the requirement, the expected action and the next planning step.';
  return [
    { id: id(), layout: creativeType === 'Infographic' ? 'metric-grid' : 'editorial-split', eyebrow: scopeLabel, headline: topic.title, subheadline: support, body, cta: audience === 'Retailers' ? 'Plan your DRS readiness' : audience === 'Consumers' ? 'Know what to return' : 'Build trusted return systems', metrics, caption: captionFor(topic, audience, angleA), hashtags: ['#UKDRS', '#DepositReturnScheme', '#CircularEconomy', '#ReteaRnUK'], visualPrompt: buildVisualPrompt(topic, audience, creativeType, 0), tone: 'authoritative, spacious, practical' },
    { id: id(), layout: creativeType === 'Infographic' ? 'pathway' : 'impact-poster', eyebrow: topic.category.toUpperCase(), headline: topic.title, subheadline: `Clear UK DRS guidance, structured for ${audience.toLowerCase()}.`, body: 'Focus on one verified message, one practical action and a clear route to the official source.', cta: audience === 'Retailers' ? 'Start your readiness plan' : audience === 'Consumers' ? 'Return it. Reclaim it.' : 'Plan accessible returns', metrics: metrics.slice().reverse(), caption: captionFor(topic, audience, angleB), hashtags: ['#DRSUK', '#RetailReadiness', '#BottleReturn', '#ReteaRnUK'], visualPrompt: buildVisualPrompt(topic, audience, creativeType, 1), tone: 'bold, editorial, optimistic' }
  ];
}
function buildVisualPrompt(topic, audience, creativeType, index, feedback = '', userDirection = '') {
  const formatStyle = creativeType === 'Infographic'
    ? 'a premium editorial infographic background with dimensional geometric objects, bottle-and-can silhouettes, material-flow arrows and clean negative space; no readable labels'
    : 'premium photorealistic commercial advertising photography with an authentic contemporary British retail context, natural store lighting, realistic materials, subtle depth and clean negative space';
  const composition = index % 2 === 0
    ? 'Keep the left 46 percent visually calm for headline and body copy; place the main visual on the right.'
    : 'Create a strong upper-right or right-side visual and a calm left copy zone, with a distinctive asymmetrical composition.';
  const requiresRvm = topicRequiresRvm(topic, `${feedback} ${userDirection}`);
  const productCue = requiresRvm
    ? `The approved ReteaRn UK reverse vending machine is mandatory. Use the supplied reference images as the single source of truth. ${RVM_REFERENCE_DESCRIPTION} Preserve the exact cabinet proportions, component positions, navy finish, silver-white trim, amber inlet ring and retearn.uk machine branding. Do not invent a different RVM, do not widen or shorten the cabinet, do not relocate the screen or inlet, and do not turn the output into a collage, specification sheet or product line-up.`
    : 'Do not add a reverse vending machine unless it is directly necessary to the selected message. Where a return point is shown, keep it secondary and unbranded.';
  return [
    `Create ${formatStyle}.`,
    `Subject: ${AUDIENCE_VISUALS[audience] || AUDIENCE_VISUALS.Retailers}.`,
    `Message context: ${topic.title}.`,
    composition,
    `Use this approved UK DRS visual grammar where relevant: ${visualLanguage.visualPatterns.slice(0, 5).join(' ')}`,
    `Avoid these visual errors: ${visualLanguage.avoid.slice(0, 4).join(' ')}`,
    productCue,
    `Use a restrained palette inspired by royal purple ${BRAND.purple}, soft violet ${BRAND.violet}, forest green ${BRAND.green}, black, warm white and the approved civic-navy RVM.`,
    'Leave all marketing copy, statistics, source lines and CTA text out of the generated background because they will be overlaid programmatically in Poppins.',
    requiresRvm ? 'The only readable branding allowed in the generated background is the exact retearn.uk wordmark already present on the referenced machine.' : 'No words, no letters, no numbers, no logos, no badges, no watermarks, no flag motifs and no corporate trademarks.',
    'Do not render the main ReteaRn page logo; it will be overlaid programmatically at the top left.',
    'Create a genuinely original composition for ReteaRn UK. Do not copy, trace, reproduce or imitate any existing advertisement, social post, infographic, stock photograph, competitor machine, retailer environment, artist style, copyrighted character, celebrity, public figure, app UI or campaign layout.',
    'Do not show third-party logos, watermarks, branded packaging, recognisable retailer uniforms, protected taglines or identifying trade dress. All bottles and cans must be generic, label-free and unbranded. For infographics, create original icons and geometry rather than reproducing an existing chart or diagram.',
    userDirection ? `Additional user direction: ${userDirection}` : '',
    feedback ? `Apply this art-direction feedback: ${feedback}` : ''
  ].filter(Boolean).join(' ');
}

function proceduralBackground(topic, audience, creativeType, index = 0) {
  const palettes = [['#f7f3fa', '#ebe1f3', '#6a398c', '#5b8563'], ['#f8fbfb', '#dff3f7', '#00b4d8', '#9c539c']];
  const [paper, wash, accent, secondary] = palettes[index % palettes.length]; const infographic = creativeType === 'Infographic';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${wash}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="45"/></filter><pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="${accent}" opacity=".12"/></pattern></defs><rect width="1600" height="1600" fill="url(#g)"/><circle cx="1310" cy="300" r="330" fill="${accent}" opacity=".13" filter="url(#blur)"/><circle cx="1180" cy="1260" r="360" fill="${secondary}" opacity=".14" filter="url(#blur)"/>${infographic ? `<rect x="870" y="150" width="620" height="1180" rx="78" fill="url(#dots)"/>` : ''}<g transform="translate(1060 460)" opacity=".2"><rect width="350" height="620" rx="58" fill="white" stroke="${accent}" stroke-width="12"/><rect x="64" y="85" width="222" height="250" rx="28" fill="${accent}"/><circle cx="175" cy="455" r="72" fill="${secondary}"/></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
function imageSizeFor(size) { const r = size.width / size.height; return r > 1.25 ? '1536x1024' : r < 0.8 ? '1024x1536' : '1024x1024'; }

async function generateBackgrounds(options, topic, audience, creativeType, size, userDirection = '') {
  const rvmRequired = topicRequiresRvm(topic, userDirection);
  if (!hasApiKey) {
    return options.map((option, index) => ({
      ...option,
      backgroundImage: rvmRequired ? rvmReferenceDataUrls[index % rvmReferenceDataUrls.length] : proceduralBackground(topic, audience, creativeType, index),
      imageGeneratedByAI: false,
      rvmRequired,
      rvmReferenceUsed: rvmRequired,
      rvmFidelity: rvmRequired ? 'reference-fallback' : 'not-applicable',
      rvmReferenceBankVersion: rvmRequired ? RVM_REFERENCE_BANK_VERSION : null,
      visualCopyrightAudit: {
        status: rvmRequired ? 'owned-reference' : 'procedural', passed: true, humanReviewRequired: false,
        flags: [], note: rvmRequired ? 'Approved ReteaRn RVM reference used.' : 'Procedural visual contains no external assets.', auditedAt: new Date().toISOString()
      }
    }));
  }
  try {
    const endpoint = rvmRequired ? 'images/edits' : 'images/generations';
    const body = {
      model: imageModel,
      prompt: `${options[0].visualPrompt} Generate two visually distinct alternatives that follow the same factual context, composition discipline and brand palette.`,
      n: 2,
      size: imageSizeFor(size),
      quality: imageQuality,
      output_format: 'png'
    };
    if (rvmRequired) {
      body.images = rvmReferenceDataUrls.map((image_url) => ({ image_url }));
      if (imageModel !== 'gpt-image-2') body.input_fidelity = 'high';
    }
    const payload = await openAIRequest(endpoint, body, 300000);
    const generated = options.map((option, index) => {
      const item = payload.data?.[index] || payload.data?.[0];
      const backgroundImage = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || (rvmRequired ? rvmReferenceDataUrls[index % 2] : proceduralBackground(topic, audience, creativeType, index));
      return {
        ...option,
        backgroundImage,
        imageGeneratedByAI: Boolean(item?.b64_json || item?.url),
        rvmRequired,
        rvmReferenceUsed: rvmRequired,
        rvmFidelity: rvmRequired ? 'high' : 'not-applicable',
        rvmReferenceBankVersion: rvmRequired ? RVM_REFERENCE_BANK_VERSION : null
      };
    });
    return Promise.all(generated.map(async (item) => ({
      ...item,
      visualCopyrightAudit: await auditVisualCopyright(item.backgroundImage, { rvmRequired: item.rvmRequired, imageGeneratedByAI: item.imageGeneratedByAI })
    })));
  } catch (error) {
    console.error('Image generation failed, using protected fallback:', error.message);
    return options.map((option, index) => ({
      ...option,
      backgroundImage: rvmRequired ? rvmReferenceDataUrls[index % rvmReferenceDataUrls.length] : proceduralBackground(topic, audience, creativeType, index),
      imageGeneratedByAI: false,
      rvmRequired,
      rvmReferenceUsed: rvmRequired,
      rvmFidelity: rvmRequired ? 'reference-fallback' : 'not-applicable',
      rvmReferenceBankVersion: rvmRequired ? RVM_REFERENCE_BANK_VERSION : null,
      generationWarning: `Image API fallback: ${error.message}`,
      visualCopyrightAudit: {
        status: rvmRequired ? 'owned-reference' : 'procedural', passed: true, humanReviewRequired: false,
        flags: [], note: 'Protected local fallback used; no external image asset fetched.', auditedAt: new Date().toISOString()
      }
    }));
  }
}

async function generateCopy(topic, audience, creativeType, userBrief) {
  const fallback = fallbackOptions(topic, audience, creativeType); if (!hasApiKey) return fallback;
  const prompt = `You are the editorial copy engine inside a quality-gated UK Deposit Return Scheme design tool. Create exactly two distinct social creative concepts in British English for the selected audience. The factual knowledge below is the only factual source you may use. Do not add statistics, deadlines, fees, legal requirements or product claims that are not explicitly present. Keep Wales separate from the Exchange for Change scheme.

QUALITY GATE: every concept must be capable of scoring at least ${PUBLISH_READY_SCORE}/100. Use one clear message, one CTA, a 3-12 word headline under 70 characters, one supporting line, no more than three concise metric cards, British English, and strong negative space. The LinkedIn caption must begin with “UK DRS” or “Deposit Return Scheme”, naturally include the selected topic, name the approved source, and use 3-5 relevant hashtags. Avoid jargon, hype, keyword stuffing and unsupported claims. Write in ReteaRn UK’s own editorial voice. Do not reproduce any source sentence of nine or more consecutive words. Do not use competitor names, third-party taglines, brand hashtags or wording from another social post. Use only these approved hashtags where relevant: ${APPROVED_HASHTAGS.join(', ')}.

TOPIC: ${topic.title}
CATEGORY: ${topic.category}
AUDIENCE: ${audience}
CREATIVE TYPE: ${creativeType}
SCOPE: ${topic.scope}
VERIFIED FACTS:
- ${topic.facts.join('\n- ')}
APPROVED SOURCE LABEL: ${topic.sourceLabel}
OPTIONAL USER BRIEF: ${userBrief || 'None'}

ORIGINALITY REQUIREMENT: every line must be newly phrased from the verified facts. Facts and figures may be used, but source wording must be paraphrased. Never mention or imitate another brand, retailer, RVM supplier, campaign or creator.\n\nReturn JSON only: {"options":[{"layout":"metric-grid | pathway | editorial-split | impact-poster","eyebrow":"max 32 characters","headline":"3-12 words, max 70 characters","subheadline":"25-150 characters","body":"max 260 characters and no more than 3 sentences","cta":"2-7 words, max 38 characters","metrics":[{"value":"max 16 characters","label":"max 64 characters"}],"caption":"professional LinkedIn caption, 280-1400 characters, source named, 3-5 hashtags","hashtags":["#tag"],"tone":"three adjectives"}]}. Each option must use a different layout and headline angle.`
  try {
    const payload = await openAIRequest('responses', { model: textModel, input: prompt, reasoning: { effort: 'none' }, max_output_tokens: 2500 });
    const parsed = safeJson(extractResponseText(payload));
    if (!parsed?.options || !Array.isArray(parsed.options) || parsed.options.length < 2) return fallback;
    return parsed.options.slice(0, 2).map((option, index) => { const normalized = { ...fallback[index], ...option, id: id(), metrics: Array.isArray(option.metrics) ? option.metrics.slice(0, 3) : fallback[index].metrics, visualPrompt: buildVisualPrompt(topic, audience, creativeType, index, '', userBrief) }; return hasUnapprovedNumbers(normalized, topic) ? fallback[index] : normalized; });
  } catch (error) {
    console.error('Text generation failed, using factual fallback:', error.message);
    return fallback.map((option) => ({ ...option, generationWarning: `Text API fallback: ${error.message}` }));
  }
}
async function regenerateOne({ topic, audience, creativeType, size, current, feedback, keepVisual }) {
  const rvmRequired = topicRequiresRvm(topic, feedback);
  let revised = { ...current, id: id(), visualPrompt: buildVisualPrompt(topic, audience, creativeType, current.layout === 'impact-poster' ? 1 : 0, feedback), rvmRequired };
  if (hasApiKey) {
    const prompt = `Revise one UK DRS social creative using the feedback below. Preserve verified facts and add no new number or claim. TOPIC: ${topic.title}. AUDIENCE: ${audience}. SCOPE: ${topic.scope}. VERIFIED FACTS: ${topic.facts.join(' | ')}. CURRENT: ${JSON.stringify({ eyebrow: current.eyebrow, headline: current.headline, subheadline: current.subheadline, body: current.body, cta: current.cta, metrics: current.metrics, caption: current.caption })}. FEEDBACK: ${feedback}. Rewrite in original ReteaRn UK wording. Do not reproduce nine or more consecutive words from the verified facts, do not name or imitate any third-party brand, and use only approved generic or ReteaRn UK hashtags. Return JSON only with eyebrow, headline, subheadline, body, cta, metrics, caption, hashtags and tone.`;
    try { const payload = await openAIRequest('responses', { model: textModel, input: prompt, reasoning: { effort: 'none' }, max_output_tokens: 1800 }); const parsed = safeJson(extractResponseText(payload)); if (parsed) { const candidate = { ...revised, ...parsed, id: id() }; if (!hasUnapprovedNumbers(candidate, topic)) revised = candidate; } } catch (error) { revised.generationWarning = `Copy regeneration fallback: ${error.message}`; }
  } else revised.body = feedback ? `${current.body} Feedback noted: ${feedback}`.slice(0, 240) : current.body;
  if (!keepVisual) {
    if (hasApiKey) {
      try {
        const endpoint = rvmRequired ? 'images/edits' : 'images/generations';
        const body = { model: imageModel, prompt: revised.visualPrompt, n: 1, size: imageSizeFor(size), quality: imageQuality, output_format: 'png' };
        if (rvmRequired) {
          body.images = rvmReferenceDataUrls.map((image_url) => ({ image_url }));
          if (imageModel !== 'gpt-image-2') body.input_fidelity = 'high';
        }
        const payload = await openAIRequest(endpoint, body, 300000);
        const item = payload.data?.[0];
        revised.backgroundImage = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url || current.backgroundImage;
        revised.imageGeneratedByAI = Boolean(item?.b64_json || item?.url);
        revised.rvmReferenceUsed = rvmRequired;
        revised.rvmFidelity = rvmRequired ? 'high' : 'not-applicable';
        revised.rvmReferenceBankVersion = rvmRequired ? RVM_REFERENCE_BANK_VERSION : null;
      } catch (error) {
        revised.backgroundImage = rvmRequired ? rvmReferenceDataUrls[0] : current.backgroundImage;
        revised.rvmReferenceUsed = rvmRequired;
        revised.rvmFidelity = rvmRequired ? 'reference-fallback' : 'not-applicable';
        revised.rvmReferenceBankVersion = rvmRequired ? RVM_REFERENCE_BANK_VERSION : null;
        revised.generationWarning = `Visual regeneration fallback: ${error.message}`;
      }
    } else {
      revised.backgroundImage = rvmRequired ? rvmReferenceDataUrls[0] : proceduralBackground(topic, audience, creativeType, Math.random() > 0.5 ? 1 : 0);
      revised.imageGeneratedByAI = false;
      revised.rvmReferenceUsed = rvmRequired;
      revised.rvmFidelity = rvmRequired ? 'reference-fallback' : 'not-applicable';
      revised.rvmReferenceBankVersion = rvmRequired ? RVM_REFERENCE_BANK_VERSION : null;
    }
  }
  if (!keepVisual) {
    revised.visualCopyrightAudit = await auditVisualCopyright(revised.backgroundImage, { rvmRequired: revised.rvmRequired, imageGeneratedByAI: revised.imageGeneratedByAI });
  } else {
    revised.visualCopyrightAudit = current.visualCopyrightAudit || { status: 'pending-human-review', passed: true, humanReviewRequired: true, flags: [], note: 'Existing visual retained; Design Manager attestation required.', auditedAt: new Date().toISOString() };
  }
  return revised;
}


function qualityGateOption(option, topic, audience, creativeType, size, userBrief = '', productId = activeProduct.id, rightsConfirmed = false) {
  const enriched = attachProvenance(option, topic, userBrief, rightsConfirmed);
  const gated = enforcePublishReady(enriched, { topic, audience, creativeType, size, userBrief, productId, rightsConfirmed });
  if (!gated.qualityReport?.publishReady) {
    console.warn(`Quality gate returned ${gated.qualityReport?.overall || 0}/100 for ${topic.id}.`);
  }
  return gated;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  let filePath = path.resolve(distPath, rel);
  if (!filePath.startsWith(path.resolve(distPath))) return sendText(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(distPath, 'index.html');
  const stat = fs.statSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    if (req.method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true, mode: hasApiKey ? 'live' : 'demo', textModel, imageModel, imageQuality, deployment: 'dependency-free' });
    if (req.method === 'GET' && pathname === '/api/config') return sendJson(res, 200, { products, activeProduct, topics, sizes, audiences: activeProduct.audiences, creativeTypes: ['Infographic', 'Image'], mode: hasApiKey ? 'live' : 'demo', accessRequired: Boolean(appAccessCode), brand: BRAND, budget: { monthlyBudgetUsd, monthlyCreativeBatchLimit, monthlyRegenerationLimit, model: imageModel, quality: imageQuality, note: 'Each initial batch generates two image options.' }, usage: usageSnapshot(), lastResearchReview: visualLanguage.reviewed, visualLanguage, workflow: workflowService.config, qualityGate: { version: QUALITY_GATE_VERSION, publishReadyScore: PUBLISH_READY_SCORE, methodology: '100-point preflight across UK DRS accuracy, brief alignment, SEO, design hierarchy, visual hierarchy, UK accessibility, ReteaRn UK platform readiness and originality/copyright compliance' }, copyrightGate: { version: COPYRIGHT_GATE_VERSION, policyVersion: originalityPolicy.version, approvedHashtags: APPROVED_HASHTAGS, externalAssetFetch: false, humanAttestationRequired: true, rightsManifestVersion: rightsManifest.version, note: 'Automated checks reduce risk but cannot prove worldwide uniqueness.' }, rvmReferenceBank: { version: RVM_REFERENCE_BANK_VERSION, enabled: true, workflow: imageModel === 'gpt-image-2' ? 'OpenAI image edit with two locked visual references; GPT Image 2 applies high input fidelity automatically' : 'OpenAI image edit with two locked visual references and high input fidelity', description: RVM_REFERENCE_DESCRIPTION } });
    if (pathname === '/api/usage' && req.method === 'GET') { if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code.' }); return sendJson(res, 200, { usage: usageSnapshot() }); }
    if (pathname === '/api/generate' && req.method === 'POST') {
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code to use AI generation.' });
      const body = await readJson(req); const { topicId, audience, sizeId, creativeType, userBrief = '', rightsConfirmed = false } = body;
      const topic = findTopic(topicId); const size = findSize(sizeId);
      if (!topic || !size || !['Retailers', 'Consumers', 'Government Authorities'].includes(audience) || !['Infographic', 'Image'].includes(creativeType)) return sendJson(res, 400, { error: 'Invalid topic, audience, size or creative type.' });
      if (!topic.audiences.includes(audience)) return sendJson(res, 400, { error: 'The selected topic is not approved for this audience.' });
      const rightsCheck = validateRightsBrief({ userBrief, rightsConfirmed });
      if (!rightsCheck.passed) return sendJson(res, 400, { error: rightsCheck.issues.join(' '), rightsCheck });
      const reservation = reserveUsage({ kind: 'creative-batch', size, imageCount: 2, includeCopy: true });
      if (!reservation.ok) return sendJson(res, 429, { error: reservation.message, usage: reservation.usage });
      const copyOptions = await generateCopy(topic, audience, creativeType, userBrief); const options = await generateBackgrounds(copyOptions, topic, audience, creativeType, size, userBrief);
      const gatedOptions = options.map((option) => qualityGateOption(option, topic, audience, creativeType, size, userBrief, body.productId || activeProduct.id, rightsConfirmed));
      return sendJson(res, 200, { options: gatedOptions, mode: hasApiKey ? 'live' : 'demo', usage: usageSnapshot(), estimatedRequestCostUsd: reservation.estimatedCostUsd || 0, qualityGate: { version: QUALITY_GATE_VERSION, threshold: PUBLISH_READY_SCORE } });
    }
    if (pathname === '/api/regenerate' && req.method === 'POST') {
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code to use AI generation.' });
      const body = await readJson(req); const { topicId, audience, sizeId, creativeType, current, feedback, keepVisual = false, rightsConfirmed = false } = body;
      const topic = findTopic(topicId); const size = findSize(sizeId);
      if (!topic || !size || !current || !String(feedback || '').trim()) return sendJson(res, 400, { error: 'Topic, size, current creative and feedback are required.' });
      const rightsCheck = validateRightsBrief({ userBrief: `${body.userBrief || current.userBrief || ''} ${feedback}`, rightsConfirmed });
      if (!rightsCheck.passed) return sendJson(res, 400, { error: rightsCheck.issues.join(' '), rightsCheck });
      const reservation = reserveUsage({ kind: 'regeneration', size, imageCount: keepVisual ? 0 : 1, includeCopy: true });
      if (!reservation.ok) return sendJson(res, 429, { error: reservation.message, usage: reservation.usage });
      const option = await regenerateOne({ topic, audience, creativeType, size, current, feedback: String(feedback).trim(), keepVisual });
      const gatedOption = qualityGateOption(option, topic, audience, creativeType, size, body.userBrief || current.userBrief || '', body.productId || activeProduct.id, rightsConfirmed);
      return sendJson(res, 200, { option: gatedOption, mode: hasApiKey ? 'live' : 'demo', usage: usageSnapshot(), estimatedRequestCostUsd: reservation.estimatedCostUsd || 0, qualityGate: { version: QUALITY_GATE_VERSION, threshold: PUBLISH_READY_SCORE } });
    }
    if (pathname === '/api/score' && req.method === 'POST') {
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code.' });
      const body = await readJson(req);
      if (!body?.creative) return sendJson(res, 400, { error: 'Creative data is required.' });
      return sendJson(res, 200, { qualityReport: evaluateCreative(body.creative) });
    }
    const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : '';

    if (pathname === '/api/workflows' && req.method === 'GET') {
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code.' });
      return sendJson(res, 200, { workflows: await workflowService.list(), workflowConfig: workflowService.config });
    }
    if (pathname === '/api/workflows' && req.method === 'POST') {
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code.' });
      const body = await readJson(req, 20 * 1024 * 1024);
      if (!body?.creative || !body?.renderedPng || !body?.form) return sendJson(res, 400, { error: 'Creative, rendered PNG and brief form are required.' });
      const workflow = await workflowService.create({ creative: body.creative, form: body.form, renderedPng: body.renderedPng, origin: requestOrigin });
      return sendJson(res, 201, { workflow });
    }
    const reviewMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/review$/);
    if (reviewMatch && req.method === 'POST') {
      const body = await readJson(req);
      const workflow = await workflowService.review({ id: decodeURIComponent(reviewMatch[1]), role: body.role, token: body.token, decision: body.decision, feedback: body.feedback || '', ipAttestation: body.ipAttestation === true, origin: requestOrigin });
      return sendJson(res, 200, { workflow });
    }
    const resubmitMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/resubmit$/);
    if (resubmitMatch && req.method === 'POST') {
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code.' });
      const body = await readJson(req, 20 * 1024 * 1024);
      const workflow = await workflowService.resubmit({ id: decodeURIComponent(resubmitMatch[1]), creative: body.creative, renderedPng: body.renderedPng, origin: requestOrigin });
      return sendJson(res, 200, { workflow });
    }
    const workflowMatch = pathname.match(/^\/api\/workflows\/([^/]+)$/);
    if (workflowMatch && req.method === 'GET') {
      const id = decodeURIComponent(workflowMatch[1]);
      const role = url.searchParams.get('role');
      const token = url.searchParams.get('token');
      if (role && token) {
        const workflow = await workflowService.getForReview(id, role, token);
        if (!workflow) return sendJson(res, 404, { error: 'Workflow not found.' });
        return sendJson(res, 200, { workflow, role });
      }
      if (!authorised(req)) return sendJson(res, 401, { error: 'Enter the valid team access code.' });
      const workflow = await workflowService.get(id);
      if (!workflow) return sendJson(res, 404, { error: 'Workflow not found.' });
      return sendJson(res, 200, { workflow });
    }

    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'API route not found.' });
    return serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.status ? error.message : 'Unexpected server error.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`UK DRS Design Bot running on http://0.0.0.0:${port} (${hasApiKey ? 'live' : 'demo'} mode, no npm dependencies)`);
});
