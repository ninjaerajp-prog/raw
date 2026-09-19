import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/users');
      setUsers(data.users || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id, status) {
    setBusyId(id);
    try {
      await api(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(id) {
    if (!window.confirm('Delete this user?')) return;
    setBusyId(id);
    try {
      await api(`/api/users/${id}`, { method: 'DELETE' });
      await load();
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
          <h1>User management</h1>
          <p className="muted">Approve, reject, or remove registered accounts.</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = u.role === 'admin';
              const busy = busyId === u.id;
              return (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`status status-${u.status}`}>{u.status}</span>
                  </td>
                  <td className="muted">{u.created_at}</td>
                  <td className="actions">
                    {isAdmin ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        {u.status !== 'approved' && (
                          <button
                            type="button"
                            className="btn btn-small btn-primary"
                            disabled={busy}
                            onClick={() => setStatus(u.id, 'approved')}
                          >
                            Approve
                          </button>
                        )}
                        {u.status !== 'rejected' && (
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={busy}
                            onClick={() => setStatus(u.id, 'rejected')}
                          >
                            Reject
                          </button>
                        )}
                        {u.status !== 'pending' && (
                          <button
                            type="button"
                            className="btn btn-small btn-ghost"
                            disabled={busy}
                            onClick={() => setStatus(u.id, 'pending')}
                          >
                            Pending
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          disabled={busy}
                          onClick={() => removeUser(u.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
