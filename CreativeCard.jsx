import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import CreativeCanvas from './CreativeCanvas.jsx';
import { DownloadIcon, EditIcon, SparkIcon } from './Icons.jsx';
import { PUBLISH_READY_SCORE } from '../qualityScoring.js';

function slugify(value) {
  return String(value || 'creative').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

async function renderCanvasToPng(node, creative) {
  if (!node) throw new Error('Creative preview is not ready.');
  await document.fonts.ready;
  const targetWidth = creative.size?.width || 1080;
  const pixelRatio = targetWidth / node.offsetWidth;
  return toPng(node, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#ffffff',
    filter: (domNode) => !domNode?.classList?.contains('no-export')
  });
}

function QualityPanel({ report, onImprove, regenerating }) {
  if (!report) return null;
  return (
    <section className={`quality-panel ${report.publishReady ? 'quality-ready' : 'quality-review'}`}>
      <div className="quality-panel-head">
        <div className="quality-score-lockup"><strong>{report.overall}</strong><span>/100</span></div>
        <div>
          <p>Creative quality rating</p>
          <h3>{report.status}</h3>
          <small>{report.publishReady ? `Passed the ${report.threshold}+ approval gate` : `${report.threshold - report.overall} points below the approval gate`}</small>
        </div>
        <span className={`quality-status-pill ${report.publishReady ? 'ready' : 'review'}`}>{report.publishReady ? 'Ready' : 'Review'}</span>
      </div>

      <div className="quality-category-list">
        {report.categories?.map((category) => (
          <div className="quality-category" key={category.id}>
            <div><span>{category.label}</span><strong>{category.score}/{category.max}</strong></div>
            <div className="quality-category-track" aria-hidden="true"><i style={{ width: `${category.percent}%` }} /></div>
          </div>
        ))}
      </div>

      <div className={`brief-quality-check ${report.briefCheck?.implemented ? 'passed' : 'failed'}`}>
        <strong>{report.briefCheck?.implemented ? 'Creative brief implemented' : 'Creative brief needs stronger implementation'}</strong>
        <span>Brief term coverage: {report.briefCheck?.coveragePercent ?? 0}%{report.briefCheck?.matchedTerms?.length ? ` · matched: ${report.briefCheck.matchedTerms.join(', ')}` : ''}</span>
      </div>

      <div className={`copyright-quality-check ${report.copyrightCheck?.preflightPassed ? 'passed' : 'failed'}`}>
        <strong>{report.copyrightCheck?.status || 'Copyright preflight unavailable'}</strong>
        <span>Originality score: {report.copyrightCheck?.score ?? 0}/10 · visual audit: {report.copyrightCheck?.visualStatus || 'not recorded'}</span>
        <small>{report.copyrightCheck?.note}</small>
      </div>

      {report.rvmCheck?.required && (
        <div className={`rvm-quality-check ${report.rvmCheck.passed ? 'passed' : 'failed'}`}>
          <strong>{report.rvmCheck.passed ? 'Approved RVM reference verified' : 'RVM reference verification failed'}</strong>
          <span>Fidelity: {report.rvmCheck.fidelity} · {report.rvmCheck.bankVersion || 'reference bank not recorded'}</span>
        </div>
      )}

      {report.issues?.length > 0 && (
        <details className="quality-issues">
          <summary>{report.issues.length} priority improvement{report.issues.length === 1 ? '' : 's'}</summary>
          <ul>
            {report.issues.map((issue, issueIndex) => (
              <li key={`${issue.category}-${issueIndex}`}>
                <span className={`issue-severity ${issue.severity}`}>{issue.severity}</span>
                <div><strong>{issue.message}</strong><p>{issue.fix}</p></div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!report.publishReady && (
        <button type="button" className="button quality-improve-button" disabled={regenerating} onClick={onImprove}>
          <SparkIcon /> {regenerating ? 'Improving…' : `Improve to ${PUBLISH_READY_SCORE}+`}
        </button>
      )}
      <p className="quality-disclaimer">{report.note}</p>
    </section>
  );
}

export default function CreativeCard({ creative, index, onUpdate, onRegenerate, onSubmitApproval, regenerating }) {
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [keepVisual, setKeepVisual] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy caption');
  const [submitting, setSubmitting] = useState(false);
  const canvasRef = useRef(null);
  const report = creative.qualityReport;
  const canUse = Boolean(report?.publishReady && report?.copyrightCheck?.preflightPassed);

  useEffect(() => { setFeedback(''); }, [creative.id]);

  const update = (field, value) => onUpdate({ ...creative, [field]: value });
  const updateMetric = (metricIndex, field, value) => {
    const metrics = creative.metrics.map((metric, indexValue) => indexValue === metricIndex ? { ...metric, [field]: value } : metric);
    onUpdate({ ...creative, metrics });
  };

  const download = async () => {
    if (!canUse) return;
    const dataUrl = await renderCanvasToPng(canvasRef.current, creative);
    const link = document.createElement('a');
    link.download = `retearn-uk-${slugify(creative.topicTitle || creative.headline)}-${creative.size?.id || 'creative'}-option-${index + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const submitApproval = async () => {
    if (!canUse || !onSubmitApproval) return;
    setSubmitting(true);
    try {
      const renderedPng = await renderCanvasToPng(canvasRef.current, creative);
      await onSubmitApproval(creative, renderedPng, index);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(creative.caption || '');
    setCopyLabel('Copied');
    window.setTimeout(() => setCopyLabel('Copy caption'), 1400);
  };

  const improve = () => {
    const issueText = (report?.issues || []).map((issue) => issue.fix).join(' ');
    onRegenerate(`Raise this creative above the ${PUBLISH_READY_SCORE}/100 approval threshold. Preserve verified facts and the current visual. ${issueText}`, true);
  };

  return (
    <section className="creative-card">
      <div className="card-topline">
        <div><span className="option-label">Option {index + 1}</span><strong>{creative.tone || 'Brand-safe concept'}</strong></div>
        <div className="card-status">
          <span className={creative.imageGeneratedByAI ? 'status-live' : 'status-demo'}>{creative.imageGeneratedByAI ? 'AI visual' : 'Procedural visual'}</span>
          {report && <span className={`score-chip ${report.publishReady ? 'ready' : 'review'}`}>{report.overall}/100</span>}
        </div>
      </div>

      <div className="canvas-frame"><CreativeCanvas creative={creative} canvasRef={canvasRef} /></div>
      {creative.generationWarning && <p className="warning-banner">{creative.generationWarning}</p>}
      <QualityPanel report={report} onImprove={improve} regenerating={regenerating} />

      <div className="card-actions three-actions">
        <button type="button" className="button secondary" onClick={() => setEditing((value) => !value)}><EditIcon /> {editing ? 'Close editor' : 'Edit creative'}</button>
        <button type="button" className="button secondary" onClick={download} disabled={!canUse} title={canUse ? 'Download approval-ready PNG' : `Reach ${PUBLISH_READY_SCORE}/100 before download`}><DownloadIcon /> Download PNG</button>
        <button type="button" className="button primary approval-submit" onClick={submitApproval} disabled={!canUse || submitting} title={canUse ? 'Send to Brand Manager for stage-one approval' : `Reach ${PUBLISH_READY_SCORE}/100 before approval`}><SparkIcon /> {submitting ? 'Submitting…' : 'Submit for approval'}</button>
      </div>

      {editing && (
        <div className="editor-panel">
          <div className="editor-score-note"><strong>Live quality re-scoring</strong><span>Every edit updates the rating. Approval stays locked below {PUBLISH_READY_SCORE}/100 or when copyright preflight is blocked.</span></div>
          <div className="editor-grid">
            <label>Eyebrow<input value={creative.eyebrow || ''} onChange={(event) => update('eyebrow', event.target.value)} maxLength={42} /></label>
            <label>CTA<input value={creative.cta || ''} onChange={(event) => update('cta', event.target.value)} maxLength={48} /></label>
            <label className="full-span">Headline<textarea value={creative.headline || ''} onChange={(event) => update('headline', event.target.value)} rows={2} maxLength={90} /></label>
            <label className="full-span">Supporting line<textarea value={creative.subheadline || ''} onChange={(event) => update('subheadline', event.target.value)} rows={2} maxLength={150} /></label>
            <label className="full-span">Body<textarea value={creative.body || ''} onChange={(event) => update('body', event.target.value)} rows={3} maxLength={320} /></label>
          </div>

          <div className="metric-editor">
            <p>Metric cards</p>
            {creative.metrics?.slice(0, 3).map((metric, metricIndex) => (
              <div className="metric-editor-row" key={metricIndex}>
                <input value={metric.value || ''} onChange={(event) => updateMetric(metricIndex, 'value', event.target.value)} aria-label={`Metric ${metricIndex + 1} value`} />
                <input value={metric.label || ''} onChange={(event) => updateMetric(metricIndex, 'label', event.target.value)} aria-label={`Metric ${metricIndex + 1} label`} />
              </div>
            ))}
          </div>

          <label className="caption-editor">Social caption<textarea value={creative.caption || ''} onChange={(event) => update('caption', event.target.value)} rows={8} /></label>
          <button type="button" className="text-button" onClick={copyCaption}>{copyLabel}</button>
          <label className="caption-editor">LinkedIn alt text<textarea value={creative.altText || ''} onChange={(event) => update('altText', event.target.value)} rows={3} maxLength={320} /></label>

          <div className="feedback-box">
            <div><strong>Regenerate from feedback</strong><p>Describe the change in plain language. The bot keeps verified facts, the submitted brief and ReteaRn UK product identity locked.</p></div>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Example: Make the headline more retailer-focused, reduce copy and use a cleaner RVM-led visual." rows={3} />
            <div className="feedback-actions">
              <label className="toggle-row"><input type="checkbox" checked={keepVisual} onChange={(event) => setKeepVisual(event.target.checked)} />Keep current visual</label>
              <button type="button" className="button primary" disabled={!feedback.trim() || regenerating} onClick={() => onRegenerate(feedback, keepVisual)}><SparkIcon /> {regenerating ? 'Regenerating…' : 'Regenerate'}</button>
            </div>
          </div>

          <details className="source-details">
            <summary>Fact source, brief and scope</summary>
            <p><strong>{creative.sourceLabel}</strong></p>
            <p>{creative.scope}</p>
            <p><strong>Brief:</strong> {creative.userBrief || 'Not recorded'}</p>
            <p><strong>Originality policy:</strong> {creative.provenance?.originalityPolicyVersion || 'Not recorded'} · <strong>Prompt hash:</strong> {creative.provenance?.promptHash?.slice(0, 12) || 'Not recorded'}</p>
            {creative.sourceUrl?.startsWith('http') && <a href={creative.sourceUrl} target="_blank" rel="noreferrer">Open source guidance</a>}
          </details>
        </div>
      )}
    </section>
  );
}
