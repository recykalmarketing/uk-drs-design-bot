import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 10000);
const topics = JSON.parse(fs.readFileSync(path.join(__dirname, 'knowledge/topics.json'), 'utf8'));
const sizes = JSON.parse(fs.readFileSync(path.join(__dirname, 'knowledge/sizes.json'), 'utf8'));
const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
const openai = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const textModel = process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-luna';
const imageModel = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
const imageQuality = process.env.OPENAI_IMAGE_QUALITY || 'medium';
const appAccessCode = process.env.APP_ACCESS_CODE || '';

const monthlyBudgetUsd = Number(process.env.MONTHLY_BUDGET_USD || 95);
const monthlyCreativeBatchLimit = Number(process.env.MONTHLY_CREATIVE_BATCH_LIMIT || 500);
const monthlyRegenerationLimit = Number(process.env.MONTHLY_REGENERATION_LIMIT || 500);
const estimatedCopyCostUsd = Number(process.env.ESTIMATED_COPY_COST_USD || 0.008);
const estimatedRegenCopyCostUsd = Number(process.env.ESTIMATED_REGEN_COPY_COST_USD || 0.004);
const usageFile = process.env.USAGE_FILE || path.join(__dirname, '.runtime', 'usage.json');

app.use(express.json({ limit: '12mb' }));

const BRAND = {
  purple: '#6a398c',
  magenta: '#9c539c',
  violet: '#a16dc9',
  green: '#5b8563',
  blue: '#00b4d8',
  ink: '#17111f',
  paper: '#fbfafc'
};

const AUDIENCE_VISUALS = {
  Retailers: 'a contemporary UK grocery or convenience retail environment, practical store operations, return-point planning and a compact reverse vending machine area',
  Consumers: 'a welcoming everyday UK public setting with diverse adults returning clean empty plastic bottles and metal cans, clear actions and positive environmental behaviour',
  'Government Authorities': 'a sophisticated public-infrastructure and circular-economy visual, clean urban systems, retail return network and material-flow symbolism'
};

// Public per-image list prices used only for a conservative app-side budget guard.
// The OpenAI project budget should still be configured separately because platform
// budgets are alerts rather than hard stops.
const IMAGE_PRICE_USD = {
  'gpt-image-1-mini': {
    low: { square: 0.005, portrait: 0.006, landscape: 0.006 },
    medium: { square: 0.011, portrait: 0.015, landscape: 0.015 },
    high: { square: 0.036, portrait: 0.052, landscape: 0.052 }
  },
  'gpt-image-1': {
    low: { square: 0.011, portrait: 0.016, landscape: 0.016 },
    medium: { square: 0.042, portrait: 0.063, landscape: 0.063 },
    high: { square: 0.167, portrait: 0.25, landscape: 0.25 }
  },
  'gpt-image-1.5': {
    low: { square: 0.009, portrait: 0.013, landscape: 0.013 },
    medium: { square: 0.034, portrait: 0.05, landscape: 0.05 },
    high: { square: 0.133, portrait: 0.2, landscape: 0.2 }
  }
};

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function freshUsage() {
  return {
    month: monthKey(),
    creativeBatches: 0,
    regenerations: 0,
    imageOutputs: 0,
    estimatedSpendUsd: 0
  };
}

function loadUsage() {
  try {
    const parsed = JSON.parse(fs.readFileSync(usageFile, 'utf8'));
    return parsed?.month === monthKey() ? { ...freshUsage(), ...parsed } : freshUsage();
  } catch {
    return freshUsage();
  }
}

let usage = loadUsage();

function persistUsage() {
  try {
    fs.mkdirSync(path.dirname(usageFile), { recursive: true });
    fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2));
  } catch (error) {
    console.error('Could not persist usage ledger:', error.message);
  }
}

function ensureCurrentMonth() {
  if (usage.month !== monthKey()) {
    usage = freshUsage();
    persistUsage();
  }
}

function ratioBucket(size) {
  const ratio = size.width / size.height;
  if (ratio > 1.25) return 'landscape';
  if (ratio < 0.8) return 'portrait';
  return 'square';
}

function estimatedImageCost(size, count = 1) {
  const known = IMAGE_PRICE_USD[imageModel]?.[imageQuality]?.[ratioBucket(size)];
  // Unknown or future models use a deliberately conservative fallback.
  return (known ?? 0.2) * count;
}

function roundedMoney(value) {
  return Math.round(value * 10000) / 10000;
}

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
  if (!openai) return { ok: true, usage: usageSnapshot() };
  ensureCurrentMonth();

  const isBatch = kind === 'creative-batch';
  const estimatedCost = estimatedImageCost(size, imageCount)
    + (includeCopy ? (isBatch ? estimatedCopyCostUsd : estimatedRegenCopyCostUsd) : 0);

  if (isBatch && usage.creativeBatches >= monthlyCreativeBatchLimit) {
    return { ok: false, message: `Monthly limit reached: ${monthlyCreativeBatchLimit} two-option creative batches.`, usage: usageSnapshot() };
  }
  if (!isBatch && usage.regenerations >= monthlyRegenerationLimit) {
    return { ok: false, message: `Monthly regeneration limit reached: ${monthlyRegenerationLimit}.`, usage: usageSnapshot() };
  }
  if (usage.estimatedSpendUsd + estimatedCost > monthlyBudgetUsd) {
    return { ok: false, message: `The app-side monthly budget guard of $${monthlyBudgetUsd.toFixed(2)} has been reached.`, usage: usageSnapshot() };
  }

  if (isBatch) usage.creativeBatches += 1;
  else usage.regenerations += 1;
  usage.imageOutputs += imageCount;
  usage.estimatedSpendUsd = roundedMoney(usage.estimatedSpendUsd + estimatedCost);
  persistUsage();
  return { ok: true, usage: usageSnapshot(), estimatedCostUsd: roundedMoney(estimatedCost) };
}

function id() {
  return crypto.randomUUID();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireTeamAccess(req, res, next) {
  if (!appAccessCode) return next();
  const supplied = req.get('x-app-access-code') || '';
  if (!safeEqual(supplied, appAccessCode)) {
    return res.status(401).json({ error: 'Enter the valid team access code to use AI generation.' });
  }
  next();
}

function findTopic(topicId) {
  return topics.find((topic) => topic.id === topicId);
}

function findSize(sizeId) {
  return sizes.find((size) => size.id === sizeId);
}

function safeJson(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function allCreativeText(option) {
  return [
    option.eyebrow,
    option.headline,
    option.subheadline,
    option.body,
    option.cta,
    option.caption,
    ...(option.metrics || []).flatMap((metric) => [metric.value, metric.label])
  ].filter(Boolean).join(' ');
}

function normalizeNumber(value) {
  return String(value).toLowerCase().replace(/[£$,\s]/g, '').replace(/p$/i, '').replace(/m²/g, '').replace(/ml/g, '').replace(/l$/i, '');
}

function hasUnapprovedNumbers(option, topic) {
  const text = allCreativeText(option);
  const found = text.match(/(?:£\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|p|m²|ml|l|bn|million|billion|years?|sq\s*ft)?/gi) || [];
  const allowed = new Set((topic.allowedNumbers || []).map(normalizeNumber));
  const structural = new Set(['1', '2', '3', '4', '5']);
  return found.some((item) => {
    const normal = normalizeNumber(item.replace(/(million|billion|bn|years?|sqft|%)/gi, ''));
    return normal && !allowed.has(normal) && !structural.has(normal);
  });
}

function shortMetric(fact, index) {
  const number = fact.match(/(?:£\s*)?\d[\d,]*(?:\.\d+)?\s*(?:%|p|m²|ml|L|bn|million|billion)?/i)?.[0];
  if (!number) {
    return {
      value: ['CHECK', 'PLAN', 'ACT'][index % 3],
      label: fact.length > 68 ? `${fact.slice(0, 65)}…` : fact
    };
  }
  const label = fact.replace(number, '').replace(/^[\s:–—-]+/, '').trim();
  return {
    value: number.replace(/\s+/g, ' '),
    label: label.length > 62 ? `${label.slice(0, 59)}…` : label
  };
}

function captionFor(topic, audience, angle) {
  const facts = topic.facts.slice(0, 3).join(' ');
  const audienceLine = audience === 'Retailers'
    ? 'Retail readiness starts with accurate information, realistic volume planning and the right return-point model.'
    : audience === 'Consumers'
      ? 'A simple return can keep valuable materials in circulation and help reduce litter.'
      : 'Clear public information and accessible infrastructure will be essential to a trusted scheme.';
  return `${topic.title}\n\n${facts}\n\n${audienceLine}\n\nSource: ${topic.sourceLabel}. ${angle ? `Creative angle: ${angle}.` : ''}\n\n#UKDRS #DepositReturnScheme #CircularEconomy #ReverseVending #RetailReadiness`;
}

function fallbackOptions(topic, audience, creativeType) {
  const angleA = topic.angles?.[0] || 'clear explainer';
  const angleB = topic.angles?.[1] || 'practical guide';
  const firstFact = topic.facts[0] || topic.title;
  const remaining = topic.facts.slice(1, 3).join(' ');
  const metrics = topic.facts.slice(0, 3).map(shortMetric);
  const scopeLabel = topic.scope === 'Wales only' ? 'WALES DRS' : 'UK DRS 2027';

  return [
    {
      id: id(),
      layout: creativeType === 'Infographic' ? 'metric-grid' : 'editorial-split',
      eyebrow: scopeLabel,
      headline: topic.title,
      subheadline: firstFact,
      body: remaining || 'Use verified guidance to turn a complex policy into a clear action for your audience.',
      cta: audience === 'Retailers' ? 'Prepare your return point' : audience === 'Consumers' ? 'Know what to return' : 'Build a trusted return network',
      metrics,
      caption: captionFor(topic, audience, angleA),
      hashtags: ['#UKDRS', '#DepositReturnScheme', '#CircularEconomy', '#ReverseVending'],
      visualPrompt: buildVisualPrompt(topic, audience, creativeType, 0),
      tone: 'authoritative, spacious, practical'
    },
    {
      id: id(),
      layout: creativeType === 'Infographic' ? 'pathway' : 'impact-poster',
      eyebrow: topic.category.toUpperCase(),
      headline: firstFact.length < 72 ? firstFact : topic.title,
      subheadline: topic.title,
      body: topic.facts.slice(1).join(' '),
      cta: audience === 'Retailers' ? 'Start your DRS readiness plan' : audience === 'Consumers' ? 'Return it. Reclaim it.' : 'Plan for accessible returns',
      metrics: metrics.slice().reverse(),
      caption: captionFor(topic, audience, angleB),
      hashtags: ['#DRSUK', '#RetailSustainability', '#BottleReturn', '#RVM'],
      visualPrompt: buildVisualPrompt(topic, audience, creativeType, 1),
      tone: 'bold, editorial, optimistic'
    }
  ];
}

function buildVisualPrompt(topic, audience, creativeType, index, feedback = '') {
  const audienceVisual = AUDIENCE_VISUALS[audience] || AUDIENCE_VISUALS.Retailers;
  const formatStyle = creativeType === 'Infographic'
    ? 'a premium editorial infographic background with dimensional geometric objects, bottle-and-can silhouettes, material-flow arrows and clean negative space; no readable labels'
    : 'premium photorealistic commercial advertising photography with realistic British context, soft daylight, subtle depth and clean negative space';
  const composition = index % 2 === 0
    ? 'Keep the left 46 percent visually calm for headline and body copy; place the main visual on the right.'
    : 'Create a strong upper visual and a calm lower-left copy zone, with a distinctive asymmetrical composition.';
  const productCue = topic.category === 'ReteaRn product'
    ? 'Feature a compact, premium white reverse vending machine with refined purple interface lighting, but no logo or brand name on the machine.'
    : 'Where relevant, show a generic modern reverse vending machine without any logo or identifiable manufacturer design.';

  return [
    `Create ${formatStyle}.`,
    `Subject: ${audienceVisual}.`,
    `Message context: ${topic.title}.`,
    composition,
    productCue,
    `Use a restrained palette inspired by royal purple ${BRAND.purple}, soft violet ${BRAND.violet}, forest green ${BRAND.green}, black and warm white.`,
    'No words, no letters, no numbers, no logos, no badges, no watermarks, no flag motifs, no corporate trademarks.',
    'Do not render the ReteaRn logo; it will be overlaid programmatically.',
    feedback ? `Apply this art-direction feedback: ${feedback}` : ''
  ].filter(Boolean).join(' ');
}

function proceduralBackground(topic, audience, creativeType, index = 0) {
  const palettes = [
    ['#f7f3fa', '#ebe1f3', '#6a398c', '#5b8563'],
    ['#f8fbfb', '#dff3f7', '#00b4d8', '#9c539c']
  ];
  const [paper, wash, accent, secondary] = palettes[index % palettes.length];
  const infographic = creativeType === 'Infographic';
  const audienceMark = audience === 'Retailers' ? 'store' : audience === 'Consumers' ? 'people' : 'network';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${wash}"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="45"/></filter>
      <pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="${accent}" opacity=".12"/></pattern>
    </defs>
    <rect width="1600" height="1600" fill="url(#g)"/>
    <circle cx="1310" cy="300" r="330" fill="${accent}" opacity=".13" filter="url(#blur)"/>
    <circle cx="1180" cy="1260" r="360" fill="${secondary}" opacity=".14" filter="url(#blur)"/>
    <path d="M980 260c180-90 420-5 505 180 85 186 0 420-185 505-186 85-420 0-505-185-85-186 0-415 185-500Z" fill="${accent}" opacity=".09"/>
    ${infographic ? `<rect x="870" y="150" width="620" height="1180" rx="78" fill="url(#dots)" opacity=".9"/>
      <path d="M1040 1060c130-210 265-210 390-30" fill="none" stroke="${secondary}" stroke-width="34" stroke-linecap="round" opacity=".25"/>
      <circle cx="1040" cy="1060" r="48" fill="${accent}" opacity=".25"/><circle cx="1430" cy="1030" r="48" fill="${secondary}" opacity=".25"/>` : ''}
    <g transform="translate(1060 460)" opacity=".2">
      <rect x="0" y="0" width="350" height="620" rx="58" fill="white" stroke="${accent}" stroke-width="12"/>
      <rect x="64" y="85" width="222" height="250" rx="28" fill="${accent}"/>
      <circle cx="175" cy="455" r="72" fill="${secondary}"/>
      <rect x="90" y="555" width="170" height="18" rx="9" fill="${accent}"/>
    </g>
    <text x="1540" y="1550" text-anchor="end" font-family="Arial" font-size="1" fill="transparent">${audienceMark} ${topic.id}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function imageSizeFor(size) {
  const ratio = size.width / size.height;
  if (ratio > 1.25) return '1536x1024';
  if (ratio < 0.8) return '1024x1536';
  return '1024x1024';
}

async function generateBackgrounds(options, topic, audience, creativeType, size) {
  if (!openai) {
    return options.map((option, index) => ({
      ...option,
      backgroundImage: proceduralBackground(topic, audience, creativeType, index),
      imageGeneratedByAI: false
    }));
  }

  try {
    const imageResponse = await openai.images.generate({
      model: imageModel,
      prompt: `${options[0].visualPrompt}\n\nGenerate two visually distinct alternatives that follow the same factual context and brand palette.`,
      n: 2,
      size: imageSizeFor(size),
      quality: imageQuality,
      output_format: 'png'
    });

    return options.map((option, index) => {
      const item = imageResponse.data?.[index] || imageResponse.data?.[0];
      const backgroundImage = item?.b64_json
        ? `data:image/png;base64,${item.b64_json}`
        : item?.url || proceduralBackground(topic, audience, creativeType, index);
      return { ...option, backgroundImage, imageGeneratedByAI: Boolean(item?.b64_json || item?.url) };
    });
  } catch (error) {
    console.error('Image generation failed, using procedural backgrounds:', error.message);
    return options.map((option, index) => ({
      ...option,
      backgroundImage: proceduralBackground(topic, audience, creativeType, index),
      imageGeneratedByAI: false,
      generationWarning: 'The image API failed, so a procedural fallback visual was used.'
    }));
  }
}

async function generateCopy(topic, audience, creativeType, userBrief) {
  const fallback = fallbackOptions(topic, audience, creativeType);
  if (!openai) return fallback;

  const prompt = `You are the editorial copy engine inside a brand-safe UK Deposit Return Scheme design tool.

Create exactly two distinct social creative concepts in British English for the selected audience.
The factual knowledge below is the only factual source you may use. Do not add statistics, deadlines, fees, legal requirements or product claims that are not explicitly present. Keep Wales separate from the Exchange for Change scheme. Never claim that £10bn investment or 21,000 jobs are caused by DRS alone.

TOPIC: ${topic.title}
CATEGORY: ${topic.category}
AUDIENCE: ${audience}
CREATIVE TYPE: ${creativeType}
SCOPE: ${topic.scope}
VERIFIED FACTS:\n- ${topic.facts.join('\n- ')}
APPROVED SOURCE LABEL: ${topic.sourceLabel}
OPTIONAL USER BRIEF: ${userBrief || 'None'}

Brand voice: clear, useful, optimistic, credible, not bureaucratic, not fear-based. Poppins-friendly short lines. No em dashes. Avoid the verb “connect” when describing the marketplace or infrastructure.

Return JSON only in this exact shape:
{
  "options": [
    {
      "layout": "metric-grid | pathway | editorial-split | impact-poster",
      "eyebrow": "max 32 characters",
      "headline": "max 72 characters",
      "subheadline": "max 120 characters",
      "body": "max 240 characters",
      "cta": "max 38 characters",
      "metrics": [{"value":"short", "label":"max 58 characters"}],
      "caption": "120 to 220 words, source named, 4 to 6 hashtags",
      "hashtags": ["#tag"],
      "tone": "three adjectives"
    }
  ]
}

Each option must use a different layout and headline angle. Include no more than three metrics.`;

  try {
    const response = await openai.responses.create({
      model: textModel,
      input: prompt
    });
    const parsed = safeJson(response.output_text);
    if (!parsed?.options || !Array.isArray(parsed.options) || parsed.options.length < 2) return fallback;

    return parsed.options.slice(0, 2).map((option, index) => {
      const normalized = {
        ...fallback[index],
        ...option,
        id: id(),
        metrics: Array.isArray(option.metrics) ? option.metrics.slice(0, 3) : fallback[index].metrics,
        visualPrompt: buildVisualPrompt(topic, audience, creativeType, index)
      };
      return hasUnapprovedNumbers(normalized, topic) ? fallback[index] : normalized;
    });
  } catch (error) {
    console.error('Text generation failed, using factual fallback:', error.message);
    return fallback.map((option) => ({ ...option, generationWarning: 'The text API failed, so verified fallback copy was used.' }));
  }
}

async function regenerateOne({ topic, audience, creativeType, size, current, feedback, keepVisual }) {
  let revised = {
    ...current,
    id: id(),
    visualPrompt: buildVisualPrompt(topic, audience, creativeType, current.layout === 'impact-poster' ? 1 : 0, feedback)
  };

  if (openai) {
    const prompt = `Revise one UK DRS social creative using the feedback below. Preserve the verified facts and do not add any new number, requirement or claim.

TOPIC: ${topic.title}
AUDIENCE: ${audience}
SCOPE: ${topic.scope}
VERIFIED FACTS:\n- ${topic.facts.join('\n- ')}
CURRENT CREATIVE: ${JSON.stringify({
      eyebrow: current.eyebrow,
      headline: current.headline,
      subheadline: current.subheadline,
      body: current.body,
      cta: current.cta,
      metrics: current.metrics,
      caption: current.caption
    })}
FEEDBACK: ${feedback}

Use British English. Keep the copy concise and source-aware. Return JSON only with eyebrow, headline, subheadline, body, cta, metrics, caption, hashtags and tone.`;
    try {
      const response = await openai.responses.create({ model: textModel, input: prompt });
      const parsed = safeJson(response.output_text);
      if (parsed) {
        const candidate = { ...revised, ...parsed, id: id() };
        if (!hasUnapprovedNumbers(candidate, topic)) revised = candidate;
      }
    } catch (error) {
      console.error('Regeneration copy failed:', error.message);
      revised.generationWarning = 'Copy regeneration failed; the current verified copy was retained.';
    }
  } else {
    revised.headline = feedback ? `${current.headline}` : current.headline;
    revised.body = feedback ? `${current.body} Feedback noted: ${feedback}`.slice(0, 240) : current.body;
  }

  if (!keepVisual) {
    if (openai) {
      try {
        const imageResponse = await openai.images.generate({
          model: imageModel,
          prompt: revised.visualPrompt,
          n: 1,
          size: imageSizeFor(size),
          quality: imageQuality,
          output_format: 'png'
        });
        const item = imageResponse.data?.[0];
        revised.backgroundImage = item?.b64_json
          ? `data:image/png;base64,${item.b64_json}`
          : item?.url || current.backgroundImage;
        revised.imageGeneratedByAI = Boolean(item?.b64_json || item?.url);
      } catch (error) {
        revised.backgroundImage = current.backgroundImage;
        revised.generationWarning = 'The visual could not be regenerated, so the previous visual was retained.';
      }
    } else {
      revised.backgroundImage = proceduralBackground(topic, audience, creativeType, Math.random() > 0.5 ? 1 : 0);
      revised.imageGeneratedByAI = false;
    }
  }

  return revised;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: hasApiKey ? 'live' : 'demo', textModel, imageModel, imageQuality });
});

app.get('/api/config', (_req, res) => {
  res.json({
    topics,
    sizes,
    audiences: ['Retailers', 'Consumers', 'Government Authorities'],
    creativeTypes: ['Infographic', 'Image'],
    mode: hasApiKey ? 'live' : 'demo',
    accessRequired: Boolean(appAccessCode),
    brand: BRAND,
    budget: {
      monthlyBudgetUsd,
      monthlyCreativeBatchLimit,
      monthlyRegenerationLimit,
      model: imageModel,
      quality: imageQuality,
      note: 'Each creative batch generates two image options. The in-app ledger is a conservative guard and should be paired with OpenAI project budget alerts.'
    },
    usage: usageSnapshot(),
    lastResearchReview: '2026-07-13'
  });
});

app.get('/api/usage', requireTeamAccess, (_req, res) => {
  res.json({ usage: usageSnapshot() });
});

app.post('/api/generate', requireTeamAccess, async (req, res) => {
  const { topicId, audience, sizeId, creativeType, userBrief = '' } = req.body || {};
  const topic = findTopic(topicId);
  const size = findSize(sizeId);
  if (!topic || !size || !['Retailers', 'Consumers', 'Government Authorities'].includes(audience) || !['Infographic', 'Image'].includes(creativeType)) {
    return res.status(400).json({ error: 'Invalid topic, audience, size or creative type.' });
  }
  if (!topic.audiences.includes(audience)) {
    return res.status(400).json({ error: 'The selected topic is not approved for this audience.' });
  }

  const reservation = reserveUsage({
    kind: 'creative-batch',
    size,
    imageCount: 2,
    includeCopy: true
  });
  if (!reservation.ok) {
    return res.status(429).json({ error: reservation.message, usage: reservation.usage });
  }

  try {
    const copyOptions = await generateCopy(topic, audience, creativeType, userBrief);
    const options = await generateBackgrounds(copyOptions, topic, audience, creativeType, size);
    res.json({
      options: options.map((option) => ({
        ...option,
        sourceLabel: topic.sourceLabel,
        sourceUrl: topic.sourceUrl,
        topicTitle: topic.title,
        scope: topic.scope,
        size,
        audience,
        creativeType
      })),
      mode: hasApiKey ? 'live' : 'demo',
      usage: usageSnapshot(),
      estimatedRequestCostUsd: reservation.estimatedCostUsd || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Creative generation failed. Please try again.' });
  }
});

app.post('/api/regenerate', requireTeamAccess, async (req, res) => {
  const { topicId, audience, sizeId, creativeType, current, feedback, keepVisual = false } = req.body || {};
  const topic = findTopic(topicId);
  const size = findSize(sizeId);
  if (!topic || !size || !current || !feedback?.trim()) {
    return res.status(400).json({ error: 'Topic, size, current creative and feedback are required.' });
  }

  const reservation = reserveUsage({
    kind: 'regeneration',
    size,
    imageCount: keepVisual ? 0 : 1,
    includeCopy: true
  });
  if (!reservation.ok) {
    return res.status(429).json({ error: reservation.message, usage: reservation.usage });
  }
  try {
    const option = await regenerateOne({ topic, audience, creativeType, size, current, feedback: feedback.trim(), keepVisual });
    res.json({
      option: { ...option, sourceLabel: topic.sourceLabel, sourceUrl: topic.sourceUrl, topicTitle: topic.title, scope: topic.scope, size, audience, creativeType },
      mode: hasApiKey ? 'live' : 'demo',
      usage: usageSnapshot(),
      estimatedRequestCostUsd: reservation.estimatedCostUsd || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Regeneration failed. Please try again.' });
  }
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (_req, res) => res.status(503).send('Frontend not built. Run npm run build first.'));
}

app.listen(port, '0.0.0.0', () => {
  console.log(`UK DRS Design Bot running on http://0.0.0.0:${port} (${hasApiKey ? 'live' : 'demo'} mode)`);
});
