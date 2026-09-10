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
import {
  IconUsers,
  IconCrown,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconAlert,
  IconClose,
} from "./Icons";

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
    <div className="card full-width-card" style={{ padding: "20px" }}>
      <div className="card-header-row" style={{ marginBottom: "16px" }}>
        <div>
          <h4>Staff & Cashier Management</h4>
          <p className="subtitle">Manage team members, roles, permissions, and PIN access</p>
        </div>
        <button type="button" className="btn-primary" onClick={openAddModal} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IconPlus size={16} /> Add Staff Member
        </button>
      </div>

      {error && (
        <div className="pin-error" onClick={() => setError(null)} style={{ cursor: "pointer", marginBottom: "14px" }}>
          <IconAlert size={16} /> {error} (click to dismiss)
        </div>
      )}
      {success && (
        <div className="success-banner" onClick={() => setSuccess(null)} style={{ cursor: "pointer", marginBottom: "14px" }}>
          <IconCheck size={16} /> {success} (click to dismiss)
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          <IconUsers size={32} color="var(--primary)" />
          <p style={{ marginTop: "8px" }}>Loading staff accounts...</p>
        </div>
      ) : (
        <div className="table-responsive" style={{ border: "1px solid var(--border-light)", borderRadius: "14px", overflow: "hidden" }}>
          <table className="staff-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.is_active === 0 ? "row-inactive" : ""}>
                  <td>
                    <div className="user-cell" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className="avatar-sm" style={{ background: u.role === "ADMIN" ? "var(--primary)" : "var(--secondary)", color: "#fff", fontWeight: "700" }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <strong>{u.name}</strong>
                        {u.role === "ADMIN" && <IconCrown size={12} color="#D97706" style={{ marginLeft: "4px" }} />}
                      </div>
                    </div>
                  </td>
                  <td>
                    <code style={{ background: "var(--surface-warm)", padding: "3px 8px", borderRadius: "6px", fontSize: "12px" }}>
                      {u.username}
                    </code>
                  </td>
                  <td>
                    <span className={`role-pill role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${u.is_active === 1 ? "active" : "inactive"}`}>
                      {u.is_active === 1 ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => openEditModal(u)}
                      >
                        <IconEdit size={13} /> Edit
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
                        <IconTrash size={13} />
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
          <div className="modal-content" style={{ maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>{editingUser ? "Edit Staff Member" : "Add New Staff Member"}</h3>
              <button
                type="button"
                onClick={closeModal}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <IconClose size={20} />
              </button>
            </div>

            {formError && <div className="pin-error" style={{ marginBottom: "12px" }}>{formError}</div>}

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
                <div className="form-group checkbox-group" style={{ marginTop: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isActive === 1}
                      onChange={(e) => setIsActive(e.target.checked ? 1 : 0)}
                    />
                    Account Active
                  </label>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <IconCheck size={16} /> {editingUser ? "Save Changes" : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
