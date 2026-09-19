import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import FsTree from '../components/FsTree';

function formatTime(iso) {
  try {
    return new Date(iso + 'Z').toLocaleString();
  } catch {
    return iso;
  }
}

export default function FsPage() {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadList = useCallback(async () => {
    try {
      const data = await api('/api/fs');
      const list = data.snapshots || [];
      setSnapshots(list);
      setLastUpdated(new Date());
      setError('');
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err.message || 'Failed to load filesystem snapshots');
    }
  }, []);

  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 1000);
    return () => clearInterval(id);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    let cancelled = false;
    api(`/api/fs/${selectedId}`)
      .then((data) => {
        if (!cancelled) setSelected(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load snapshot');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this filesystem snapshot?')) return;
    setBusyId(id);
    try {
      await api(`/api/fs/${id}`, { method: 'DELETE' });
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setSelected(null);
      }
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
          <h1>Filesystem scans</h1>
          <p className="muted">
            JSON trees posted to <code>/api/fs</code> by <code>fs.cmd</code>. Auto-refreshes every second.
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

      {snapshots.length === 0 && !error ? (
        <div className="empty-state">
          <p>No filesystem scans received yet.</p>
          <p className="muted">
            Run <code>fs.cmd</code> to POST a drive tree to <code>/api/fs</code>.
          </p>
        </div>
      ) : (
        <div className="fs-layout">
          <aside className="fs-sidebar">
            <h2 className="fs-sidebar-title">Snapshots</h2>
            <ul className="fs-snapshot-list">
              {snapshots.map((snap) => (
                <li key={snap.id}>
                  <button
                    type="button"
                    className={`fs-snapshot-item ${selectedId === snap.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(snap.id)}
                  >
                    <span className="text-id">#{snap.id}</span>
                    <span className="muted tiny">{formatTime(snap.received_at)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={busyId === snap.id}
                    onClick={() => handleDelete(snap.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="fs-viewer text-item">
            {selected ? (
              <>
                <div className="text-meta">
                  <span className="text-id">#{selected.id}</span>
                  <time dateTime={selected.received_at}>{formatTime(selected.received_at)}</time>
                </div>
                <div className="fs-viewer-body">
                  <FsTree tree={selected.tree} />
                </div>
              </>
            ) : (
              <div className="empty-state">Select a snapshot.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
