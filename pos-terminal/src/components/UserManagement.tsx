import { useState, useEffect, FormEvent } from "react";
import { DbUser, Role } from "../lib/authService";
import {
  getAllUsers,
  createStaffUser,
  updateStaffUser,
  toggleStaffStatus,
  deleteStaffUser,
} from "../lib/userService";
import { useAuth } from "../store/useAuth";

const ROLES: Role[] = ["ADMIN", "MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF"];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");
  const [isActive, setIsActive] = useState(1);
  const [formError, setFormError] = useState("");

  const refreshUsersList = () => {
    setLoading(true);
    getAllUsers()
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => {
        setError("Failed to load staff list: " + String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let isSubscribed = true;

    getAllUsers()
      .then((data) => {
        if (isSubscribed) {
          setUsers(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setError("Failed to load staff list: " + String(err));
          setLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setName("");
    setUsername("");
    setPin("");
    setRole("CASHIER");
    setIsActive(1);
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (userToEdit: DbUser) => {
    setEditingUser(userToEdit);
    setName(userToEdit.name);
    setUsername(userToEdit.username);
    setPin(""); // Leave blank unless updating
    setRole(userToEdit.role);
    setIsActive(userToEdit.is_active);
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!currentUser) return;

    if (!name.trim() || !username.trim()) {
      setFormError("Name and username are required.");
      return;
    }

    if (!editingUser && (!pin || pin.length < 4)) {
      setFormError("A valid 4-digit PIN is required for new accounts.");
      return;
    }

    try {
      if (editingUser) {
        await updateStaffUser(
          editingUser.id,
          {
            name,
            username,
            role,
            is_active: isActive,
            pin: pin.trim() ? pin : undefined,
          },
          currentUser.id,
        );
        setSuccess(`Updated staff member "${name}" successfully.`);
      } else {
        await createStaffUser({ name, username, pin, role }, currentUser.id);
        setSuccess(`Created staff member "${name}" (${role}) successfully.`);
      }

      closeModal();
      refreshUsersList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleStatus = async (targetUser: DbUser) => {
    if (!currentUser) return;
    const newStatus = targetUser.is_active === 1 ? false : true;

    try {
      await toggleStaffStatus(targetUser.id, newStatus, currentUser.id);
      setSuccess(`Staff member "${targetUser.name}" ${newStatus ? "activated" : "deactivated"}.`);
      refreshUsersList();
    } catch (err) {
      setError("Failed to update status: " + String(err));
    }
  };

  const handleDelete = async (targetUser: DbUser) => {
    if (!currentUser) return;
    if (targetUser.id === currentUser.id) {
      setError("You cannot delete your own active session account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete staff account "${targetUser.name}"?`)) {
      return;
    }

    try {
      await deleteStaffUser(targetUser.id, currentUser.id);
      setSuccess(`Deleted staff account "${targetUser.name}".`);
      refreshUsersList();
    } catch (err) {
      setError("Failed to delete user: " + String(err));
    }
  };

  return (
    <div className="card full-width-card">
      <div className="card-header-row">
        <div>
          <h4>Staff Account Management (FR-1.3)</h4>
          <p className="subtitle">Create, update roles, reset PINs, and manage active staff</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAddModal}>
          + Add New Staff Member
        </button>
      </div>

      {error && (
        <div className="pin-error" onClick={() => setError(null)}>
          {error} (click to dismiss)
        </div>
      )}
      {success && (
        <div className="success-banner" onClick={() => setSuccess(null)}>
          ✅ {success} (click to dismiss)
        </div>
      )}

      {loading ? (
        <p>Loading staff accounts...</p>
      ) : (
        <div className="table-responsive">
          <table className="staff-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.is_active === 0 ? "row-inactive" : ""}>
                  <td>
                    <div className="user-cell">
                      <div className="avatar-sm">{u.name.charAt(0)}</div>
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td>
                    <code>{u.username}</code>
                  </td>
                  <td>
                    <span className={`role-pill role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${u.is_active === 1 ? "active" : "inactive"}`}>
                      {u.is_active === 1 ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openEditModal(u)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`btn-sm ${u.is_active === 1 ? "btn-warning" : "btn-success"}`}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.is_active === 1 ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser?.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>{editingUser ? "Edit Staff Member" : "Add New Staff Member"}</h3>

            {formError && <div className="pin-error">{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  required
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alexj"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  {editingUser ? "New PIN Code (leave blank to keep current)" : "4-Digit Staff PIN"}
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="e.g. 5555"
                  required={!editingUser}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {editingUser && (
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={isActive === 1}
                      onChange={(e) => setIsActive(e.target.checked ? 1 : 0)}
                    />
                    Account Active
                  </label>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? "Save Changes" : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
