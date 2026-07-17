import React, { useEffect, useMemo, useState } from 'react';
import CreativeCard from './components/CreativeCard.jsx';
import { BottleCanIcon, SparkIcon } from './components/Icons.jsx';
import { evaluateCreative, PUBLISH_READY_SCORE, QUALITY_CATEGORIES } from './qualityScoring.js';

const initialState = {
  productId: 'retearn-uk',
  audience: 'Retailers',
  topicId: 'retailer-obligations',
  sizeId: 'portrait',
  creativeType: 'Infographic',
  userBrief: '',
  rightsConfirmed: false
};

function apiHeaders(accessCode, json = true) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(accessCode ? { 'X-App-Access-Code': accessCode } : {})
  };
}

function QualityDashboard({ creatives }) {
  const reports = creatives.map((creative) => creative.qualityReport || evaluateCreative(creative));
  const average = reports.length ? Math.round(reports.reduce((sum, report) => sum + report.overall, 0) / reports.length) : 0;
  const ready = reports.filter((report) => report.publishReady).length;
  const categoryAverages = QUALITY_CATEGORIES.map((category) => {
    const values = reports.map((report) => report.categories?.find((item) => item.id === category.id)?.percent || 0);
    return { ...category, percent: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 };
  });
  return (
    <section className="quality-dashboard" aria-label="Creative quality dashboard">
      <div className="quality-dashboard-score">
        <div className={`quality-score-orb ${average >= PUBLISH_READY_SCORE ? 'ready' : 'review'}`}><strong>{average}</strong><span>/100</span></div>
        <div>
          <p className="section-kicker">Approval-ready quality gate</p>
          <h3>{ready} of {reports.length} creatives meet the {PUBLISH_READY_SCORE}+ standard</h3>
          <p>Scored against UK DRS accuracy, brief alignment, LinkedIn discoverability, design and visual hierarchy, UK accessibility, ReteaRn UK readiness, originality and copyright preflight.</p>
        </div>
      </div>
      <div className="quality-dashboard-bars">
        {categoryAverages.map((category) => (
          <div className="quality-dashboard-row" key={category.id}>
            <span>{category.label}</span><div className="quality-mini-track"><i style={{ width: `${category.percent}%` }} /></div><strong>{category.percent}</strong>
          </div>
        ))}
      </div>
      <p className="quality-method-note">The score is a compliance preflight, not a prediction of reach. Approved posts should still be reviewed through the two-stage workflow and measured in LinkedIn analytics.</p>
    </section>
  );
}

function topicUsesRvmReference(topic) {
  if (!topic) return false;
  return /RVM|ReteaRn product/i.test(String(topic.category || '')) || /\b(?:RVM|reverse vending|Reklaim Ace)\b/i.test(`${topic.title || ''} ${(topic.facts || []).join(' ')}`);
}

const STATUS_LABELS = {
  'brand-review': 'Brand review pending',
  'brand-changes-requested': 'Brand changes requested',
  'design-review': 'Design review pending',
  'design-changes-requested': 'Design changes requested',
  publishing: 'Publishing to LinkedIn',
  published: 'Published to LinkedIn',
  'approved-awaiting-linkedin-setup': 'Approved · LinkedIn setup required',
  'publish-failed': 'Publishing failed'
};

function ApprovalTimeline({ workflow }) {
  const brand = workflow.approvals?.brand?.status || 'not-started';
  const design = workflow.approvals?.design?.status || 'not-started';
  return (
    <div className="approval-timeline">
      <div className={`approval-step ${brand}`}><span>1</span><div><strong>Brand Manager</strong><small>Content, facts, originality and brand messaging</small></div></div>
      <i />
      <div className={`approval-step ${design}`}><span>2</span><div><strong>Design Manager</strong><small>Layout, visual quality and rights attestation</small></div></div>
      <i />
      <div className={`approval-step ${workflow.status === 'published' ? 'approved' : 'not-started'}`}><span>3</span><div><strong>LinkedIn</strong><small>Automatic page publishing</small></div></div>
    </div>
  );
}

function WorkflowDashboard({ workflows, onRefresh, onRevise, workflowConfig, loading }) {
  return (
    <section className="workflow-dashboard">
      <div className="workflow-summary">
        <div><p className="section-kicker">Approval workflow</p><h2>ReteaRn UK content pipeline</h2><p>Every creative passes Brand Manager approval, then Design Manager approval, before automatic LinkedIn publishing.</p></div>
        <button className="button secondary" onClick={onRefresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh status'}</button>
      </div>
      <div className="integration-strip">
        <span className={workflowConfig?.emailConfigured ? 'ok' : 'warn'}>Email {workflowConfig?.emailConfigured ? 'connected' : 'needs RESEND_API_KEY'}</span>
        <span className={workflowConfig?.linkedInConfigured ? 'ok' : 'warn'}>LinkedIn {workflowConfig?.linkedInConfigured ? 'connected' : 'needs API credentials'}</span>
        <span>Storage: {workflowConfig?.storage || 'local-json'}</span>
      </div>
      {!workflows.length ? (
        <div className="workflow-empty"><h3>No creatives submitted yet</h3><p>Generate a 95+ creative and click “Submit for approval”.</p></div>
      ) : (
        <div className="workflow-list">
          {workflows.map((workflow) => {
            const latestFeedback = [...(workflow.feedbackHistory || [])].reverse().find((item) => item.decision === 'changes');
            const needsRevision = ['brand-changes-requested', 'design-changes-requested'].includes(workflow.status);
            return (
              <article className="workflow-card" key={workflow.id}>
                <div className="workflow-preview"><img src={workflow.renderedPng} alt={workflow.creative?.altText || workflow.creative?.headline} /></div>
                <div className="workflow-detail">
                  <div className="workflow-heading"><div><span className={`workflow-status status-${workflow.status}`}>{STATUS_LABELS[workflow.status] || workflow.status}</span><h3>{workflow.creative?.headline}</h3></div><strong>{workflow.creative?.qualityReport?.overall || 0}/100</strong></div>
                  <p>{workflow.topicTitle} · {workflow.audience} · {workflow.creativeType}</p>
                  <div className={`copyright-workflow-chip ${workflow.creative?.qualityReport?.copyrightCheck?.preflightPassed ? 'passed' : 'blocked'}`}>{workflow.creative?.qualityReport?.copyrightCheck?.preflightPassed ? 'Copyright preflight passed' : 'Copyright review required'}</div>
                  <ApprovalTimeline workflow={workflow} />
                  {latestFeedback && <div className="manager-feedback"><strong>{latestFeedback.role === 'brand' ? 'Brand Manager' : 'Design Manager'} feedback</strong><p>{latestFeedback.feedback}</p></div>}
                  {workflow.publication?.postUrl && <a className="published-link" href={workflow.publication.postUrl} target="_blank" rel="noreferrer">Open LinkedIn post</a>}
                  {workflow.publication?.error && <p className="error-banner">{workflow.publication.error}</p>}
                  {needsRevision && <button className="button primary" onClick={() => onRevise(workflow)}>Revise this creative</button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ReviewWorkspace({ workflowId, role, token }) {
  const [workflow, setWorkflow] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ipAttestation, setIpAttestation] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}?role=${encodeURIComponent(role)}&token=${encodeURIComponent(token)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review link could not be opened.');
      setWorkflow(data.workflow);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [workflowId, role, token]);

  const decide = async (decision) => {
    if (decision === 'changes' && !feedback.trim()) return setError('Add clear feedback before requesting changes.');
    if (decision === 'approve' && !ipAttestation) return setError('Confirm the originality and copyright attestation before approval.');
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, token, decision, feedback, ipAttestation })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Review action failed.');
      setWorkflow(data.workflow);
      setFeedback('');
      setIpAttestation(false);
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  if (loading) return <main className="loading-screen"><div className="loading-orb" /><p>Opening approval dashboard…</p></main>;
  if (error && !workflow) return <main className="review-page"><div className="review-error"><h1>Review link unavailable</h1><p>{error}</p></div></main>;
  const canReview = role === 'brand' ? workflow.status === 'brand-review' : workflow.status === 'design-review';
  return (
    <main className="review-page">
      <header className="review-header"><img src="./retearn-logo.svg" alt="retearn.uk" /><div><span>{role === 'brand' ? 'Stage 1 of 2' : 'Stage 2 of 2'}</span><h1>{role === 'brand' ? 'Content approval' : 'Design approval'}</h1></div></header>
      <section className="review-grid">
        <div className="review-creative"><img src={workflow.renderedPng} alt={workflow.creative?.altText || workflow.creative?.headline} /></div>
        <aside className="review-controls">
          <span className={`workflow-status status-${workflow.status}`}>{STATUS_LABELS[workflow.status] || workflow.status}</span>
          <h2>{workflow.creative?.headline}</h2>
          <p>{workflow.creative?.subheadline}</p>
          <div className="review-score"><strong>{workflow.creative?.qualityReport?.overall}/100</strong><span>Quality gate</span></div>
          <ApprovalTimeline workflow={workflow} />
          <div className="review-brief"><strong>Submitted brief</strong><p>{workflow.form?.userBrief}</p></div>
          <div className={`review-copyright ${workflow.creative?.qualityReport?.copyrightCheck?.preflightPassed ? 'passed' : 'blocked'}`}>
            <strong>{workflow.creative?.qualityReport?.copyrightCheck?.status || 'Copyright preflight unavailable'}</strong>
            <p>{workflow.creative?.qualityReport?.copyrightCheck?.note}</p>
            {workflow.creative?.qualityReport?.copyrightCheck?.detectedThirdPartyMarks?.length > 0 && <small>Detected marks: {workflow.creative.qualityReport.copyrightCheck.detectedThirdPartyMarks.join(', ')}</small>}
          </div>
          <details><summary>Caption and source</summary><p className="caption-preview">{workflow.creative?.caption}</p><p><strong>Source:</strong> {workflow.creative?.sourceLabel}</p></details>
          {error && <div className="error-banner">{error}</div>}
          {canReview ? (
            <>
              <label className="review-attestation"><input type="checkbox" checked={ipAttestation} onChange={(event) => setIpAttestation(event.target.checked)} /><span>{role === 'brand' ? 'I confirm the copy is original, source-based and free of unapproved third-party marks.' : 'I confirm the layout and visual are original and use only approved or authorised assets.'}</span></label>
              <label className="review-feedback"><span>Feedback for the creator</span><textarea rows={5} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Required only when requesting changes." /></label>
              <div className="review-actions"><button className="button secondary" disabled={submitting} onClick={() => decide('changes')}>Request changes</button><button className="button primary" disabled={submitting || !ipAttestation} onClick={() => decide('approve')}>{submitting ? 'Saving…' : 'Approve'}</button></div>
            </>
          ) : (
            <div className="review-complete"><strong>Review recorded</strong><p>{workflow.status === 'published' ? 'The post has been published to LinkedIn.' : 'The workflow has moved to the next stage.'}</p>{workflow.publication?.postUrl && <a href={workflow.publication.postUrl} target="_blank" rel="noreferrer">Open LinkedIn post</a>}</div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const reviewWorkflowId = params.get('workflow');
  const reviewRole = params.get('role');
  const reviewToken = params.get('token');
  if (reviewWorkflowId && reviewRole && reviewToken) return <ReviewWorkspace workflowId={reviewWorkflowId} role={reviewRole} token={reviewToken} />;

  const [config, setConfig] = useState(null);
  const [form, setForm] = useState(initialState);
  const [accessCode, setAccessCode] = useState(() => sessionStorage.getItem('uk-drs-access-code') || '');
  const [creatives, setCreatives] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);
  const [tab, setTab] = useState('create');
  const [loading, setLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/config').then((response) => response.json()).then((data) => {
      setConfig(data); setWorkflowConfig(data.workflow); setForm((current) => ({ ...current, productId: data.activeProduct?.id || 'retearn-uk' }));
    }).catch(() => setError('Could not load the bot configuration.'));
  }, []);

  const selectedTopic = config?.topics.find((topic) => topic.id === form.topicId);
  const selectedSize = config?.sizes.find((size) => size.id === form.sizeId);
  const topicGroups = useMemo(() => {
    if (!config) return [];
    const groups = new Map();
    config.topics.forEach((topic) => { if (!groups.has(topic.category)) groups.set(topic.category, []); groups.get(topic.category).push(topic); });
    return [...groups.entries()];
  }, [config]);

  useEffect(() => {
    if (!selectedTopic) return;
    if (!selectedTopic.audiences.includes(form.audience)) setForm((current) => ({ ...current, audience: selectedTopic.audiences[0] }));
  }, [selectedTopic, form.audience]);

  const loadWorkflows = async () => {
    setWorkflowLoading(true); setError('');
    try {
      const response = await fetch('/api/workflows', { headers: apiHeaders(accessCode, false) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load approval workflows.');
      setWorkflows(data.workflows || []); setWorkflowConfig(data.workflowConfig || workflowConfig);
    } catch (err) { setError(err.message); } finally { setWorkflowLoading(false); }
  };
  useEffect(() => { if (tab === 'approvals' && accessCode) loadWorkflows(); }, [tab]);

  const generate = async () => {
    if (!form.userBrief.trim()) return setError('Add a creative brief before generation.');
    if (!form.rightsConfirmed) return setError('Confirm that the brief and any supplied references are owned, licensed or authorised.');
    setLoading(true); setError(''); setNotice(''); setActiveWorkflowId(null);
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: apiHeaders(accessCode), body: JSON.stringify(form) });
      const data = await response.json();
      if (data.usage) setConfig((current) => ({ ...current, usage: data.usage }));
      if (!response.ok) throw new Error(data.error || 'Generation failed.');
      setCreatives(data.options);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const updateCreative = (index, nextCreative) => {
    const rescored = { ...nextCreative, qualityReport: evaluateCreative(nextCreative) };
    setCreatives((current) => current.map((creative, creativeIndex) => creativeIndex === index ? rescored : creative));
  };

  const regenerate = async (index, feedback, keepVisual) => {
    setRegeneratingIndex(index); setError('');
    try {
      const response = await fetch('/api/regenerate', { method: 'POST', headers: apiHeaders(accessCode), body: JSON.stringify({ ...form, current: creatives[index], feedback, keepVisual }) });
      const data = await response.json();
      if (data.usage) setConfig((current) => ({ ...current, usage: data.usage }));
      if (!response.ok) throw new Error(data.error || 'Regeneration failed.');
      updateCreative(index, data.option);
    } catch (err) { setError(err.message); } finally { setRegeneratingIndex(null); }
  };

  const submitApproval = async (creative, renderedPng) => {
    setError(''); setNotice('');
    const endpoint = activeWorkflowId ? `/api/workflows/${encodeURIComponent(activeWorkflowId)}/resubmit` : '/api/workflows';
    const response = await fetch(endpoint, { method: 'POST', headers: apiHeaders(accessCode), body: JSON.stringify(activeWorkflowId ? { creative, renderedPng } : { creative, renderedPng, form }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Approval submission failed.');
    setNotice(activeWorkflowId ? 'Revised creative sent back to the correct approval stage.' : `Creative sent to ${config.activeProduct.managers.brand} for Brand Manager approval.`);
    setActiveWorkflowId(null); setTab('approvals'); await loadWorkflows();
  };

  const reviseWorkflow = (workflow) => {
    setForm(workflow.form || initialState);
    setCreatives([{ ...workflow.creative, qualityReport: evaluateCreative(workflow.creative) }]);
    setActiveWorkflowId(workflow.id);
    setTab('create'); setNotice(`Revision mode: addressing ${workflow.status === 'brand-changes-requested' ? 'Brand Manager' : 'Design Manager'} feedback.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!config) return <main className="loading-screen"><div className="loading-orb" /><p>Loading ReteaRn UK knowledge base…</p></main>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand"><div className="app-logo-safe"><img src="./retearn-logo.svg" alt="retearn.uk" /></div><div><p>PRODUCT · UNITED KINGDOM</p><h1>Social Design Bot</h1></div></div>
        <nav className="dashboard-tabs"><button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>Create</button><button className={tab === 'approvals' ? 'active' : ''} onClick={() => setTab('approvals')}>Approvals</button></nav>
        <div className="header-meta"><span className={`mode-badge ${config.mode}`}>{config.mode === 'live' ? 'OpenAI live' : 'Demo mode'}</span><span>ReteaRn UK active · more countries later</span><span>Research reviewed {config.lastResearchReview}</span></div>
      </header>

      {tab === 'approvals' ? (
        <main className="approval-main">
          {config.accessRequired && !accessCode ? <div className="access-panel"><h2>Enter team access code</h2><input type="password" value={accessCode} onChange={(event) => { setAccessCode(event.target.value); sessionStorage.setItem('uk-drs-access-code', event.target.value); }} /></div> : <WorkflowDashboard workflows={workflows} onRefresh={loadWorkflows} onRevise={reviseWorkflow} workflowConfig={workflowConfig} loading={workflowLoading} />}
          {error && <div className="error-banner global-message">{error}</div>}
          {notice && <div className="notice-banner global-message">{notice}</div>}
        </main>
      ) : (
        <main className="workspace">
          <aside className="control-panel">
            <div className="panel-intro"><BottleCanIcon /><div><p className="section-kicker">ReteaRn product suite</p><h2>ReteaRn UK</h2><p>This workspace uses UK DRS research only. Other ReteaRn country products can be added later without mixing knowledge bases or logos.</p></div></div>
            <div className="control-stack">
              {config.accessRequired && <label><span>Team access code</span><input type="password" value={accessCode} onChange={(event) => { setAccessCode(event.target.value); sessionStorage.setItem('uk-drs-access-code', event.target.value); }} placeholder="Enter internal access code" /></label>}
              <label><span>Product</span><select value={form.productId} disabled><option value="retearn-uk">ReteaRn UK · retearn.uk</option></select><small className="field-help">Country knowledge, logo and publishing destination are isolated to this product.</small></label>
              <label><span>1. Select topic</span><select value={form.topicId} onChange={(event) => setForm({ ...form, topicId: event.target.value })}>{topicGroups.map(([category, categoryTopics]) => <optgroup label={category} key={category}>{categoryTopics.map((topic) => <option value={topic.id} key={topic.id}>{topic.title}</option>)}</optgroup>)}</select></label>
              <label><span>2. Target audience</span><select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>{(selectedTopic?.audiences || config.audiences).map((audience) => <option key={audience}>{audience}</option>)}</select></label>
              <div className="topic-context"><span>{selectedTopic?.category}</span><p>{selectedTopic?.scope}</p><small>Source: {selectedTopic?.sourceLabel}</small>{topicUsesRvmReference(selectedTopic) && <div className="reference-lock-note"><strong>RVM reference lock active</strong><small>{config.rvmReferenceBank?.version}</small></div>}</div>
              <label><span>3. Output size</span><select value={form.sizeId} onChange={(event) => setForm({ ...form, sizeId: event.target.value })}>{config.sizes.map((size) => <option value={size.id} key={size.id}>{size.name} | {size.label}</option>)}</select></label>
              <div className="segmented-field"><span>4. Creative type</span><div className="segmented-control">{config.creativeTypes.map((type) => <button type="button" className={form.creativeType === type ? 'active' : ''} onClick={() => setForm({ ...form, creativeType: type })} key={type}>{type}</button>)}</div></div>
              <label className="brief-field"><span>5. Creative brief <b>Required</b></span><textarea value={form.userBrief} onChange={(event) => setForm({ ...form, userBrief: event.target.value })} placeholder="State the objective, key message, audience emphasis, mandatory facts, desired CTA and visual direction. Example: Educate independent convenience-store owners about return-point readiness. Use a clean decision-tree infographic and finish with Book a Free Consultation." rows={7} /><small className={form.userBrief.trim().length >= 30 ? 'brief-ready' : 'brief-needed'}>{form.userBrief.trim().length >= 30 ? 'Brief is detailed enough for compliance scoring.' : 'Add at least one clear objective and visual direction.'}</small></label>
              <label className="rights-confirmation"><input type="checkbox" checked={form.rightsConfirmed} onChange={(event) => setForm({ ...form, rightsConfirmed: event.target.checked })} /><span><strong>Rights confirmation</strong>I confirm the brief and any supplied references are owned by ReteaRn/Recykal, licensed, public-domain or otherwise authorised. Do not paste competitor creative, downloaded web images or copyrighted copy.</span></label>
              <button type="button" className="generate-button" onClick={generate} disabled={loading || !form.userBrief.trim() || !form.rightsConfirmed || (config.accessRequired && !accessCode.trim())}><SparkIcon /><span>{loading ? 'Generating two options…' : 'Generate 2 creative options'}</span></button>
              <div className="size-preview-row"><span>Output</span><strong>{selectedSize?.width} × {selectedSize?.height}px</strong><span>PNG</span></div>
              {config.mode === 'live' && config.usage && <div className="budget-card"><div><span>Monthly AI guard</span><strong>${config.usage.estimatedSpendUsd.toFixed(2)} / ${config.budget.monthlyBudgetUsd.toFixed(2)}</strong></div><div className="budget-track"><span style={{ width: `${Math.min(100, (config.usage.estimatedSpendUsd / config.budget.monthlyBudgetUsd) * 100)}%` }} /></div><small>{config.usage.remainingCreativeBatches} two-option batches remaining. {config.budget.model}, {config.budget.quality} quality.</small></div>}
            </div>
          </aside>

          <section className="results-panel">
            <div className="results-heading"><div><p className="section-kicker">Creative workspace</p><h2>{activeWorkflowId ? 'Revision workspace' : creatives.length ? `${creatives.length} options generated` : 'Your creative options will appear here'}</h2></div>{creatives.length > 0 && <p>Image and infographic outputs support live edits, feedback regeneration and a two-stage approval workflow.</p>}</div>
            {notice && <div className="notice-banner">{notice}</div>}
            {creatives.length > 0 && !loading && <QualityDashboard creatives={creatives} />}
            {error && <div className="error-banner">{error}</div>}
            {!creatives.length && !loading && <div className="empty-state"><div className="empty-orbit"><BottleCanIcon /></div><h3>Built for non-designers</h3><p>The bot converts the brief into two layouts, verified copy, UK-friendly captions, infographics or images, and a measured approval-ready score.</p><div className="empty-tags"><span>retearn.uk logo lock</span><span>Images + infographics</span><span>Brief compliance</span><span>95+ quality gate</span><span>Two approvals</span><span>Copyright-safe preflight</span></div></div>}
            {loading && <div className="generation-state"><div className="generation-pulse" /><h3>Building two distinct directions</h3><p>Checking the brief, verified UK DRS facts, original-only policy, visual rights and ReteaRn UK product rules.</p></div>}
            {creatives.length > 0 && !loading && <div className="creative-grid">{creatives.map((creative, index) => <CreativeCard key={creative.id} creative={creative} index={index} onUpdate={(nextCreative) => updateCreative(index, nextCreative)} onRegenerate={(feedback, keepVisual) => regenerate(index, feedback, keepVisual)} onSubmitApproval={submitApproval} regenerating={regeneratingIndex === index} />)}</div>}
          </section>
        </main>
      )}
    </div>
  );
}
