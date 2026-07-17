import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function now() { return new Date().toISOString(); }
function safeJson(value) { try { return JSON.parse(value); } catch { return null; } }
function stripDataUrl(value = '') { const comma = value.indexOf(','); return comma >= 0 ? value.slice(comma + 1) : value; }
function publicWorkflow(workflow) {
  if (!workflow) return null;
  const copy = structuredClone(workflow);
  delete copy.reviewTokens;
  if (Array.isArray(copy.notifications)) copy.notifications = copy.notifications.map(({ url, ...item }) => item);
  return copy;
}

export function createWorkflowService({ rootDir, product, qualityThreshold = 95 }) {
  const workflowFile = process.env.WORKFLOW_FILE || path.join(rootDir, '.runtime', 'workflows.json');
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabaseTable = process.env.SUPABASE_WORKFLOW_TABLE || 'retearn_creative_workflows';
  const brandManagerEmail = process.env.BRAND_MANAGER_EMAIL || product.managers.brand;
  const designManagerEmail = process.env.DESIGN_MANAGER_EMAIL || product.managers.design;
  const resendApiKey = process.env.RESEND_API_KEY || '';
  const emailFrom = process.env.EMAIL_FROM || 'ReteaRn UK Design Bot <onboarding@resend.dev>';
  const linkedInToken = process.env.LINKEDIN_ACCESS_TOKEN || '';
  const linkedInOrgUrn = process.env.LINKEDIN_ORGANIZATION_URN || '';
  const linkedInVersion = process.env.LINKEDIN_VERSION || '202606';
  const linkedInPageUrl = process.env.LINKEDIN_PAGE_URL || product.social.linkedinPageUrl;

  function usingSupabase() { return Boolean(supabaseUrl && supabaseKey); }
  function readLocal() {
    try { const parsed = JSON.parse(fs.readFileSync(workflowFile, 'utf8')); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  function writeLocal(items) {
    fs.mkdirSync(path.dirname(workflowFile), { recursive: true });
    fs.writeFileSync(workflowFile, JSON.stringify(items, null, 2));
  }
  async function supabaseRequest(endpoint, options = {}) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 300)}`);
    return text ? safeJson(text) : null;
  }
  async function listRaw() {
    if (usingSupabase()) {
      const rows = await supabaseRequest(`${supabaseTable}?select=payload&order=updated_at.desc`);
      return (rows || []).map((row) => row.payload).filter(Boolean);
    }
    return readLocal().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  async function getRaw(id) {
    if (usingSupabase()) {
      const rows = await supabaseRequest(`${supabaseTable}?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`);
      return rows?.[0]?.payload || null;
    }
    return readLocal().find((item) => item.id === id) || null;
  }
  async function saveRaw(workflow) {
    workflow.updatedAt = now();
    if (usingSupabase()) {
      await supabaseRequest(supabaseTable, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: workflow.id, payload: workflow, updated_at: workflow.updatedAt })
      });
      return workflow;
    }
    const items = readLocal();
    const index = items.findIndex((item) => item.id === workflow.id);
    if (index >= 0) items[index] = workflow; else items.unshift(workflow);
    writeLocal(items);
    return workflow;
  }

  function reviewUrl(origin, workflow, role) {
    const base = String(process.env.APP_BASE_URL || origin || '').replace(/\/$/, '');
    const token = workflow.reviewTokens?.[role];
    return `${base}/?workflow=${encodeURIComponent(workflow.id)}&role=${encodeURIComponent(role)}&token=${encodeURIComponent(token)}`;
  }

  async function sendEmail({ to, subject, html }) {
    if (!resendApiKey) {
      console.log(`[notification preview] ${subject} -> ${to}`);
      return { sent: false, reason: 'RESEND_API_KEY not configured' };
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: emailFrom, to: [to], subject, html })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Email service ${response.status}: ${text.slice(0, 300)}`);
    return { sent: true, response: safeJson(text) };
  }

  function emailTemplate({ title, intro, workflow, url, stage }) {
    const score = workflow.creative?.qualityReport?.overall ?? '—';
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f1f6;padding:28px;color:#231f20"><div style="max-width:640px;margin:auto;background:#fff;border-radius:18px;padding:28px;border:1px solid #ded8e3"><p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6a398c;font-weight:700">ReteaRn UK · ${stage}</p><h1 style="font-size:26px;margin:8px 0 12px">${title}</h1><p style="line-height:1.65;color:#5f5864">${intro}</p><div style="background:#f5f0f8;border-radius:12px;padding:14px;margin:18px 0"><strong>${workflow.creative?.headline || workflow.topicTitle}</strong><br><span style="color:#6f6677">Quality score: ${score}/100 · ${workflow.creativeType}<br>Copyright preflight: ${workflow.creative?.qualityReport?.copyrightCheck?.preflightPassed ? 'Passed' : 'Review required'}</span></div><a href="${url}" style="display:inline-block;background:#6a398c;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700">Open review dashboard</a><p style="font-size:12px;color:#776f7c;margin-top:20px">Review, approve or request changes inside the dashboard. Feedback returns to the same creative workflow.</p></div></body></html>`;
  }

  async function notifyReviewer(workflow, role, origin) {
    const isBrand = role === 'brand';
    const to = isBrand ? brandManagerEmail : designManagerEmail;
    const url = reviewUrl(origin, workflow, role);
    const notification = await sendEmail({
      to,
      subject: `ReteaRn UK creative ready for ${isBrand ? 'content' : 'design'} approval`,
      html: emailTemplate({
        title: isBrand ? 'Content approval required' : 'Layout and design approval required',
        intro: isBrand ? 'A new ReteaRn UK social creative is ready for factual, brand and messaging review.' : 'The Brand Manager has approved the content. Please review layout, design hierarchy, visual accuracy and platform readiness.',
        workflow,
        url,
        stage: isBrand ? 'Stage 1 of 2' : 'Stage 2 of 2'
      })
    });
    workflow.notifications = [...(workflow.notifications || []), { at: now(), role, to, url, ...notification }];
    await saveRaw(workflow);
    return notification;
  }

  async function publishToLinkedIn(workflow) {
    if (!workflow.creative?.qualityReport?.copyrightCheck?.preflightPassed) throw new Error('Copyright preflight has not passed.');
    if (workflow.approvals?.brand?.ipAttestation !== true || workflow.approvals?.design?.ipAttestation !== true) throw new Error('Both manager copyright attestations are required before publishing.');
    if (!linkedInToken || !linkedInOrgUrn) {
      return { published: false, reason: 'LinkedIn credentials are not configured.', pageUrl: linkedInPageUrl };
    }
    const png = Buffer.from(stripDataUrl(workflow.renderedPng || ''), 'base64');
    if (!png.length) throw new Error('Rendered PNG is missing from the approved workflow.');
    const commonHeaders = {
      Authorization: `Bearer ${linkedInToken}`,
      'Linkedin-Version': linkedInVersion,
      'X-Restli-Protocol-Version': '2.0.0'
    };
    const initResponse = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initializeUploadRequest: { owner: linkedInOrgUrn } })
    });
    const initText = await initResponse.text();
    if (!initResponse.ok) throw new Error(`LinkedIn image initialise failed ${initResponse.status}: ${initText.slice(0, 400)}`);
    const init = safeJson(initText);
    const uploadUrl = init?.value?.uploadUrl;
    const imageUrn = init?.value?.image;
    if (!uploadUrl || !imageUrn) throw new Error('LinkedIn did not return an upload URL and image URN.');
    const uploadResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
    if (!uploadResponse.ok) throw new Error(`LinkedIn image upload failed ${uploadResponse.status}: ${(await uploadResponse.text()).slice(0, 300)}`);
    const postResponse = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: linkedInOrgUrn,
        commentary: workflow.creative?.caption || '',
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { media: { title: workflow.creative?.headline || 'ReteaRn UK', altText: workflow.creative?.altText || '', id: imageUrn } },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      })
    });
    const postText = await postResponse.text();
    if (!postResponse.ok) throw new Error(`LinkedIn post failed ${postResponse.status}: ${postText.slice(0, 500)}`);
    const postId = postResponse.headers.get('x-restli-id') || '';
    const postUrl = postId ? `https://www.linkedin.com/feed/update/${postId}/` : linkedInPageUrl;
    return { published: true, postId, postUrl, pageUrl: linkedInPageUrl, imageUrn, publishedAt: now() };
  }

  async function create({ creative, form, renderedPng, origin }) {
    if ((creative?.qualityReport?.overall || 0) < qualityThreshold) throw Object.assign(new Error(`Creative must score at least ${qualityThreshold}/100 before approval.`), { status: 400 });
    if (!form?.userBrief?.trim()) throw Object.assign(new Error('Creative brief is required before approval.'), { status: 400 });
    if (form?.rightsConfirmed !== true) throw Object.assign(new Error('Rights confirmation is required before approval.'), { status: 400 });
    if (creative?.qualityReport?.copyrightCheck?.preflightPassed !== true) throw Object.assign(new Error('Copyright and originality preflight must pass before approval.'), { status: 400 });
    const workflow = {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      topicTitle: creative.topicTitle,
      creativeType: creative.creativeType,
      audience: creative.audience,
      form,
      creative,
      renderedPng,
      status: 'brand-review',
      stage: 'brand',
      createdAt: now(),
      updatedAt: now(),
      approvals: { brand: { status: 'pending', ipAttestation: false }, design: { status: 'not-started', ipAttestation: false } },
      feedbackHistory: [],
      notifications: [],
      reviewTokens: { brand: crypto.randomBytes(24).toString('hex'), design: crypto.randomBytes(24).toString('hex') },
      publication: { status: 'not-started', pageUrl: linkedInPageUrl }
    };
    await saveRaw(workflow);
    await notifyReviewer(workflow, 'brand', origin);
    return publicWorkflow(workflow);
  }

  function validateReviewer(workflow, role, token) {
    if (!['brand', 'design'].includes(role) || !token || workflow.reviewTokens?.[role] !== token) throw Object.assign(new Error('This review link is invalid or no longer authorised.'), { status: 403 });
  }

  async function review({ id, role, token, decision, feedback = '', ipAttestation = false, origin }) {
    const workflow = await getRaw(id);
    if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 });
    validateReviewer(workflow, role, token);
    if (!['approve', 'changes'].includes(decision)) throw Object.assign(new Error('Decision must be approve or changes.'), { status: 400 });
    if (decision === 'changes' && !String(feedback).trim()) throw Object.assign(new Error('Feedback is required when requesting changes.'), { status: 400 });
    if (decision === 'approve' && ipAttestation !== true) throw Object.assign(new Error('Confirm the copyright and originality attestation before approval.'), { status: 400 });
    if (decision === 'approve' && workflow.creative?.qualityReport?.copyrightCheck?.preflightPassed !== true) throw Object.assign(new Error('Copyright preflight is blocked; request changes instead.'), { status: 409 });

    const approval = { status: decision === 'approve' ? 'approved' : 'changes-requested', at: now(), feedback: String(feedback).trim(), ipAttestation: decision === 'approve' ? true : false, ipDeclaration: decision === 'approve' ? (role === 'brand' ? 'Copy is original, source-based and free of unapproved third-party marks.' : 'Layout and visual are original and use only approved or authorised assets.') : null };
    workflow.approvals[role] = approval;
    workflow.feedbackHistory.push({ role, decision, feedback: String(feedback).trim(), at: now() });

    if (role === 'brand') {
      if (decision === 'changes') {
        workflow.status = 'brand-changes-requested';
        workflow.stage = 'creator';
        workflow.approvals.design = { status: 'not-started', ipAttestation: false };
      } else {
        workflow.status = 'design-review';
        workflow.stage = 'design';
        workflow.approvals.design = { status: 'pending', ipAttestation: false };
        workflow.reviewTokens.design = crypto.randomBytes(24).toString('hex');
        await saveRaw(workflow);
        await notifyReviewer(workflow, 'design', origin);
        return publicWorkflow(workflow);
      }
    } else {
      if (workflow.approvals.brand?.status !== 'approved') throw Object.assign(new Error('Brand approval must be completed first.'), { status: 409 });
      if (decision === 'changes') {
        workflow.status = 'design-changes-requested';
        workflow.stage = 'creator';
      } else {
        workflow.status = 'publishing';
        workflow.stage = 'publishing';
        workflow.publication = { status: 'publishing', pageUrl: linkedInPageUrl };
        await saveRaw(workflow);
        try {
          const result = await publishToLinkedIn(workflow);
          workflow.publication = { ...result, status: result.published ? 'published' : 'awaiting-configuration' };
          workflow.status = result.published ? 'published' : 'approved-awaiting-linkedin-setup';
          workflow.stage = result.published ? 'complete' : 'integration';
        } catch (error) {
          workflow.publication = { status: 'failed', error: error.message, pageUrl: linkedInPageUrl };
          workflow.status = 'publish-failed';
          workflow.stage = 'integration';
        }
      }
    }
    await saveRaw(workflow);
    return publicWorkflow(workflow);
  }

  async function resubmit({ id, creative, renderedPng, origin }) {
    const workflow = await getRaw(id);
    if (!workflow) throw Object.assign(new Error('Workflow not found.'), { status: 404 });
    if (!['brand-changes-requested', 'design-changes-requested'].includes(workflow.status)) throw Object.assign(new Error('This workflow is not waiting for revised creative.'), { status: 409 });
    if ((creative?.qualityReport?.overall || 0) < qualityThreshold) throw Object.assign(new Error(`Revised creative must score at least ${qualityThreshold}/100.`), { status: 400 });
    if (creative?.qualityReport?.copyrightCheck?.preflightPassed !== true) throw Object.assign(new Error('Revised creative must pass copyright and originality preflight.'), { status: 400 });
    workflow.creative = creative;
    workflow.renderedPng = renderedPng;
    workflow.revision = Number(workflow.revision || 1) + 1;
    if (workflow.status === 'brand-changes-requested') {
      workflow.status = 'brand-review';
      workflow.stage = 'brand';
      workflow.approvals.brand = { status: 'pending', ipAttestation: false };
      workflow.approvals.design = { status: 'not-started', ipAttestation: false };
      workflow.reviewTokens.brand = crypto.randomBytes(24).toString('hex');
      await saveRaw(workflow);
      await notifyReviewer(workflow, 'brand', origin);
    } else {
      workflow.status = 'design-review';
      workflow.stage = 'design';
      workflow.approvals.design = { status: 'pending', ipAttestation: false };
      workflow.reviewTokens.design = crypto.randomBytes(24).toString('hex');
      await saveRaw(workflow);
      await notifyReviewer(workflow, 'design', origin);
    }
    return publicWorkflow(workflow);
  }

  async function getForReview(id, role, token) {
    const workflow = await getRaw(id);
    if (!workflow) return null;
    validateReviewer(workflow, role, token);
    return publicWorkflow(workflow);
  }

  return {
    config: {
      storage: usingSupabase() ? 'supabase' : 'local-json',
      emailConfigured: Boolean(resendApiKey),
      linkedInConfigured: Boolean(linkedInToken && linkedInOrgUrn),
      brandManagerEmail,
      designManagerEmail,
      linkedInPageUrl,
      copyrightAttestationRequired: true
    },
    list: async () => (await listRaw()).map(publicWorkflow),
    get: async (id) => publicWorkflow(await getRaw(id)),
    getForReview,
    create,
    review,
    resubmit,
    publishToLinkedIn
  };
}
