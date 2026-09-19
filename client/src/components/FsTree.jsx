import { useMemo, useState } from 'react';
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

function FolderNode({ name, node, depth, kind = 'folder', defaultOpen = false }) {
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
        aria-expanded={hasChildren ? open : undefined}
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
          {folderNames.map((folderName) => (
            <FolderNode
              key={`dir:${folderName}`}
              name={folderName}
              node={folders[folderName]}
              depth={depth + 1}
            />
          ))}
          {fileNames.map((fileName) => (
            <li key={`file:${fileName}`} className="fs-node">
              <div
                className="fs-row fs-row-file"
                style={{ paddingLeft: `${0.35 + (depth + 1) * 0.9}rem` }}
              >
                <span className="fs-twist fs-twist-empty" />
                <FileTypeIcon name={fileName} kind="file" />
                <span className="fs-name">{fileName}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function FsTree({ tree }) {
  const drives = useMemo(() => {
    if (!isNode(tree)) return [];
    return Object.keys(tree).sort((a, b) => a.localeCompare(b));
  }, [tree]);

  if (drives.length === 0) {
    return <p className="muted">Empty filesystem tree.</p>;
  }

  return (
    <ul className="fs-tree">
      {drives.map((drive) => (
        <FolderNode
          key={drive}
          name={drive}
          node={tree[drive]}
          depth={0}
          kind="drive"
          defaultOpen={drives.length === 1}
        />
      ))}
    </ul>
  );
}
