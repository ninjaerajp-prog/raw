import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileTypeIcon } from './FileTypeIcon';

function isNode(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNode(node) {
  if (!isNode(node)) {
    return { files: [], folders: {} };
  }

  const files = Array.isArray(node.Files)
    ? node.Files
    : Array.isArray(node.files)
      ? node.files
      : [];

  const foldersRaw = isNode(node.Folders)
    ? node.Folders
    : isNode(node.folders)
      ? node.folders
      : {};

  const folders = {};
  for (const [name, child] of Object.entries(foldersRaw)) {
    folders[name] = child;
  }

  return { files, folders };
}

function joinWinPath(parent, name) {
  if (!parent) return name;
  if (/^[A-Za-z]:\\?$/.test(parent)) {
    return `${parent.replace(/\\?$/, '')}\\${name}`;
  }
  return `${parent}\\${name}`;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function FolderNode({
  name,
  node,
  depth,
  path,
  kind = 'folder',
  defaultOpen = false,
  onCopyPath,
  onContextMenu,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { files, folders } = normalizeNode(node);
  const folderNames = Object.keys(folders).sort((a, b) => a.localeCompare(b));
  const fileNames = [...files].map(String).sort((a, b) => a.localeCompare(b));
  const hasChildren = folderNames.length > 0 || fileNames.length > 0;

  return (
    <li className="fs-node">
      <button
        type="button"
        className="fs-row"
        style={{ paddingLeft: `${0.35 + depth * 0.9}rem` }}
        onClick={() => hasChildren && setOpen((v) => !v)}
        onContextMenu={(e) => onContextMenu(e, path)}
        aria-expanded={hasChildren ? open : undefined}
        title={path}
      >
        <span className={`fs-twist ${hasChildren ? '' : 'fs-twist-empty'}`}>
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <FileTypeIcon name={name} kind={kind} />
        <span className="fs-name">{name}</span>
        <span className="fs-count muted tiny">
          {folderNames.length} folders · {fileNames.length} files
        </span>
      </button>

      {open && hasChildren && (
        <ul className="fs-children">
          {folderNames.map((folderName) => {
            const folderPath = joinWinPath(path, folderName);
            return (
              <FolderNode
                key={`dir:${folderName}`}
                name={folderName}
                node={folders[folderName]}
                depth={depth + 1}
                path={folderPath}
                onCopyPath={onCopyPath}
                onContextMenu={onContextMenu}
              />
            );
          })}
          {fileNames.map((fileName) => {
            const filePath = joinWinPath(path, fileName);
            return (
              <li key={`file:${fileName}`} className="fs-node">
                <button
                  type="button"
                  className="fs-row fs-row-file"
                  style={{ paddingLeft: `${0.35 + (depth + 1) * 0.9}rem` }}
                  onClick={() => onCopyPath(filePath)}
                  onContextMenu={(e) => onContextMenu(e, filePath)}
                  title={`Click to copy: ${filePath}`}
                >
                  <span className="fs-twist fs-twist-empty" />
                  <FileTypeIcon name={fileName} kind="file" />
                  <span className="fs-name">{fileName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function FsTree({ tree }) {
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState('');
  const menuRef = useRef(null);
  const toastTimer = useRef(null);

  const drives = useMemo(() => {
    if (!isNode(tree)) return [];
    return Object.keys(tree).sort((a, b) => a.localeCompare(b));
  }, [tree]);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1600);
  }, []);

  const handleCopyPath = useCallback(async (fullPath) => {
    try {
      await copyText(fullPath);
      showToast(`Copied: ${fullPath}`);
    } catch {
      showToast('Failed to copy path');
    }
  }, [showToast]);

  const handleContextMenu = useCallback((event, fullPath) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      path: fullPath,
    });
  }, []);

  useEffect(() => {
    if (!menu) return undefined;

    function close() {
      setMenu(null);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    function onPointer(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        close();
      }
    }

    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  if (drives.length === 0) {
    return <p className="muted">Empty filesystem tree.</p>;
  }

  return (
    <div className="fs-tree-wrap">
      <ul className="fs-tree">
        {drives.map((drive) => (
          <FolderNode
            key={drive}
            name={drive}
            node={tree[drive]}
            depth={0}
            path={drive}
            kind="drive"
            defaultOpen={drives.length === 1}
            onCopyPath={handleCopyPath}
            onContextMenu={handleContextMenu}
          />
        ))}
      </ul>

      {menu && (
        <div
          ref={menuRef}
          className="fs-context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            className="fs-context-item"
            role="menuitem"
            onClick={() => {
              handleCopyPath(menu.path);
              setMenu(null);
            }}
          >
            Copy
          </button>
        </div>
      )}

      {toast && (
        <div className="fs-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
