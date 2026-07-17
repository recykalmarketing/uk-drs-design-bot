import React from 'react';
import { BottleCanIcon, ReturnIcon, StoreIcon } from './Icons.jsx';

function MetricIcon({ index }) {
  const icons = [BottleCanIcon, ReturnIcon, StoreIcon];
  const Icon = icons[index % icons.length];
  return <Icon className="metric-icon" />;
}

export default function CreativeCanvas({ creative, canvasRef }) {
  const size = creative.size || { width: 1080, height: 1350 };
  const visualPosition = creative.layout === 'impact-poster' ? 'center' : 'center right';
  const style = {
    aspectRatio: `${size.width} / ${size.height}`,
    backgroundImage: `url("${creative.backgroundImage}")`,
    backgroundPosition: visualPosition,
    '--canvas-ratio': size.width / size.height
  };

  return (
    <article
      ref={canvasRef}
      className={`creative-canvas layout-${creative.layout} type-${creative.creativeType?.toLowerCase() || 'image'} size-${size.id}`}
      style={style}
      aria-label={creative.altText || `${creative.headline} creative preview`}
    >
      <div className="creative-shade" />
      <header className="creative-brand-safe">
        <img src="./retearn-logo.svg" alt="ReteaRn – A Recykal Venture" className="creative-logo" />
      </header>

      <div className="creative-copy">
        <p className="creative-eyebrow">{creative.eyebrow}</p>
        <h2>{creative.headline}</h2>
        {creative.subheadline && <p className="creative-subheadline">{creative.subheadline}</p>}
        {creative.body && <p className="creative-body">{creative.body}</p>}
        {creative.cta && <div className="creative-cta">{creative.cta}</div>}
      </div>

      {creative.metrics?.length > 0 && (
        <div className="creative-metrics">
          {creative.metrics.slice(0, 3).map((metric, index) => (
            <div className="creative-metric" key={`${metric.value}-${index}`}>
              <MetricIcon index={index} />
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      )}

      {creative.layout === 'pathway' && (
        <div className="pathway-line" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <footer className="creative-footer">
        <span>{creative.scope}</span>
        <span>Source: {creative.sourceLabel}</span>
      </footer>
    </article>
  );
}
