import React from 'react';

export function BottleCanIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M20 16h20v12l5 7v42c0 4-3 7-7 7H22c-4 0-7-3-7-7V35l5-7V16Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M19 44h22M22 16h16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M58 20h22l3 9v47c0 5-4 8-8 8H63c-5 0-8-4-8-8V29l3-9Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <path d="M57 33h25M57 69h25" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function ReturnIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 14a34 34 0 1 1-30 18" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M16 14v23h23" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 28h12v9l6 7v24H38V44l6-7v-9Z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

export function StoreIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M18 41h60v39H18V41Z" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M12 41 21 18h54l9 23" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M27 41v39M60 54h13v26H60V54Z" fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M12 41c0 7 5 12 12 12s12-5 12-12c0 7 5 12 12 12s12-5 12-12c0 7 5 12 12 12s12-5 12-12" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function SparkIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 8c3 22 13 32 35 35-22 3-32 13-35 35-3-22-13-32-35-35 22-3 32-13 35-35Z" fill="currentColor" />
      <path d="M76 64c1 10 6 15 16 16-10 1-15 6-16 16-1-10-6-15-16-16 10-1 15-6 16-16Z" fill="currentColor" opacity=".5" />
    </svg>
  );
}

export function DownloadIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EditIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m14 7 3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
