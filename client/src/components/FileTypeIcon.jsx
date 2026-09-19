export function FileTypeIcon({ name, kind = 'file', size = 16 }) {
  const ext = kind === 'folder' || kind === 'drive'
    ? null
    : String(name || '').split('.').pop()?.toLowerCase();

  if (kind === 'drive') {
    return (
      <svg className="fs-icon fs-icon-drive" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2" fill="#6b8cae" />
        <rect x="5" y="8" width="14" height="5" rx="1" fill="#1a222c" opacity="0.35" />
        <circle cx="17" cy="15.5" r="1.2" fill="#c9e4ff" />
      </svg>
    );
  }

  if (kind === 'folder') {
    return (
      <svg className="fs-icon fs-icon-folder" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" fill="#e0a84a" />
        <path d="M3 10h18v6.5A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5V10Z" fill="#c98a2e" opacity="0.85" />
      </svg>
    );
  }

  const map = {
    exe: { fill: '#5b8def', label: 'EXE' },
    rar: { fill: '#c97a3a', label: 'RAR' },
    zip: { fill: '#c9a227', label: 'ZIP' },
    jpg: { fill: '#7a9e5a', label: 'JPG' },
    jpeg: { fill: '#7a9e5a', label: 'JPG' },
    png: { fill: '#5aa88a', label: 'PNG' },
    gif: { fill: '#9a7ad4', label: 'GIF' },
    txt: { fill: '#8b9aab', label: 'TXT' },
    docx: { fill: '#3b6ea5', label: 'DOC' },
    doc: { fill: '#3b6ea5', label: 'DOC' },
    pdf: { fill: '#d46565', label: 'PDF' },
    xlsx: { fill: '#3d9a5a', label: 'XLS' },
    xls: { fill: '#3d9a5a', label: 'XLS' },
  };

  const meta = map[ext];
  if (meta) {
    return (
      <svg className="fs-icon fs-icon-typed" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill={meta.fill} />
        <path d="M14 2v4h4" fill="#ffffff" opacity="0.35" />
        <text x="12" y="16.5" textAnchor="middle" fontSize="6" fontWeight="700" fill="#0f1419" fontFamily="Arial, sans-serif">
          {meta.label}
        </text>
      </svg>
    );
  }

  return (
    <svg className="fs-icon fs-icon-file" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#7d8b99" />
      <path d="M14 2v4h4" fill="#ffffff" opacity="0.35" />
      <path d="M8 12h8M8 15h8M8 18h5" stroke="#0f1419" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}
