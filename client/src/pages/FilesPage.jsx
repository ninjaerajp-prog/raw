import { useCallback, useEffect, useState } from 'react';
import { api, downloadAuthenticated } from '../api';

function formatTime(iso) {
  try {
    return new Date(iso + 'Z').toLocaleString();
  } catch {
    return iso;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/binfiles');
      setFiles(data.files || []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load files');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, [load]);

  async function handleDownload(file) {
    setBusyId(file.id);
    try {
      await downloadAuthenticated(
        `/api/binfile/${file.id}/download`,
        file.original_name
      );
      setError('');
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this file and remove it from storage?')) return;
    setBusyId(id);
    try {
      await api(`/api/binfile/${id}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setError('');
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Incoming files</h1>
          <p className="muted">
            Files posted to <code>/api/binfile</code>. Auto-refreshes every second.
          </p>
        </div>
        <div className="live-badge" aria-live="polite">
          <span className="pulse" />
          Live
          {lastUpdated && (
            <span className="muted tiny">
              {' '}· updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {files.length === 0 && !error ? (
        <div className="empty-state">
          <p>No files received yet.</p>
          <p className="muted">
            POST multipart form data with field <code>file</code> to{' '}
            <code>/api/binfile</code>.
          </p>
        </div>
      ) : (
        <ul className="text-list">
          {files.map((file) => (
            <li key={file.id} className="text-item">
              <div className="text-meta">
                <span className="text-id">#{file.id}</span>
                <div className="text-meta-right">
                  <time dateTime={file.received_at}>{formatTime(file.received_at)}</time>
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={busyId === file.id}
                    onClick={() => handleDownload(file)}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={busyId === file.id}
                    onClick={() => handleDelete(file.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="file-body">
                <div className="file-name">{file.original_name}</div>
                <div className="muted tiny">
                  {formatSize(file.size || 0)}
                  {file.mime_type ? ` · ${file.mime_type}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
