import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

function formatTime(iso) {
  try {
    return new Date(iso + 'Z').toLocaleString();
  } catch {
    return iso;
  }
}

export default function TextsPage() {
  const [texts, setTexts] = useState([]);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/texts');
      setTexts(data.texts || []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load texts');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 1000);
    return () => clearInterval(id);
  }, [load]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this text entry?')) return;
    setBusyId(id);
    try {
      await api(`/api/rawtext/${id}`, { method: 'DELETE' });
      setTexts((prev) => prev.filter((t) => t.id !== id));
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
          <h1>Incoming text</h1>
          <p className="muted">
            Strings posted to <code>/api/rawtext</code>. Auto-refreshes every second.
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

      {texts.length === 0 && !error ? (
        <div className="empty-state">
          <p>No text received yet.</p>
          <p className="muted">
            POST a JSON body like <code>{`{"text":"hello"}`}</code> to{' '}
            <code>/api/rawtext</code>.
          </p>
        </div>
      ) : (
        <ul className="text-list">
          {texts.map((item) => (
            <li key={item.id} className="text-item">
              <div className="text-meta">
                <span className="text-id">#{item.id}</span>
                <div className="text-meta-right">
                  <time dateTime={item.received_at}>{formatTime(item.received_at)}</time>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    disabled={busyId === item.id}
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <pre className="text-body">{item.content}</pre>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
