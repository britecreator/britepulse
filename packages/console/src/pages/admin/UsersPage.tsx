import { useState } from 'react';
import { useUsers, useCreateUser, useDeleteUser, useApps, useUpdateUser } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import type { User } from '../../types';

type UserRole = 'Admin' | 'PO' | 'Engineer' | 'ReadOnly';
const ROLES: UserRole[] = ['Admin', 'PO', 'Engineer', 'ReadOnly'];

const ROLE_COLORS: Record<UserRole, string> = {
  Admin: 'bg-red-100 text-red-800',
  PO: 'bg-blue-100 text-blue-800',
  Engineer: 'bg-green-100 text-green-800',
  ReadOnly: 'bg-gray-100 text-gray-800',
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, error } = useUsers();
  const { data: apps } = useApps();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'ReadOnly' as UserRole,
    app_access: [] as string[],
  });
  const [editUserData, setEditUserData] = useState({
    role: 'ReadOnly' as UserRole,
    app_access: [] as string[],
  });

  // Get update mutation - we need to call the hook at the top level
  // but pass the user ID when mutating
  const updateUserMutation = useUpdateUser(editingUser?.user_id || '');

  function handleEditUser(user: User) {
    setEditingUser(user);
    setEditUserData({
      role: user.role as UserRole,
      app_access: user.app_access || [],
    });
  }

  function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    updateUserMutation.mutate(
      {
        role: editUserData.role,
        app_access: editUserData.app_access,
      },
      {
        onSuccess: () => {
          setEditingUser(null);
        },
      }
    );
  }

  function toggleEditAppAccess(appId: string) {
    setEditUserData((prev) => ({
      ...prev,
      app_access: prev.app_access.includes(appId)
        ? prev.app_access.filter((id) => id !== appId)
        : [...prev.app_access, appId],
    }));
  }

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    createUser.mutate(
      {
        email: newUser.email,
        name: newUser.name || undefined,
        role: newUser.role,
        app_access: newUser.app_access,
      },
      {
        onSuccess: () => {
          setShowAddModal(false);
          setNewUser({ email: '', name: '', role: 'ReadOnly', app_access: [] });
        },
      }
    );
  }

  function handleDeleteUser(userId: string, email: string) {
    if (confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      deleteUser.mutate(userId);
    }
  }

  function toggleAppAccess(appId: string) {
    setNewUser((prev) => ({
      ...prev,
      app_access: prev.app_access.includes(appId)
        ? prev.app_access.filter((id) => id !== appId)
        : [...prev.app_access, appId],
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage user access and roles for BritePulse
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-600">
            Failed to load users: {(error as Error).message}
          </div>
        ) : users?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No users found. Add your first user to get started.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  App Access
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {user.email?.[0]?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || user.email.split('@')[0]}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${ROLE_COLORS[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.role === 'Admin' ? (
                      <span className="italic">All Apps</span>
                    ) : user.app_access?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.app_access.slice(0, 3).map((appId) => {
                          const app = apps?.find((a) => a.app_id === appId);
                          return (
                            <span
                              key={appId}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                            >
                              {app?.name || appId.slice(0, 8)}
                            </span>
                          );
                        })}
                        {user.app_access.length > 3 && (
                          <span className="text-gray-400">
                            +{user.app_access.length - 3} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    {user.user_id !== currentUser?.user_id && (
                      <>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.user_id, user.email)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setShowAddModal(false)}
            />
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <form onSubmit={handleCreateUser}>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add New User</h3>

                <div className="space-y-4">
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      required
                      className="input mt-1"
                      placeholder="user@brite.co"
                      value={newUser.email}
                      onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">Name (optional)</label>
                    <input
                      type="text"
                      className="input mt-1"
                      placeholder="John Doe"
                      value={newUser.name}
                      onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">Role</label>
                    <select
                      className="input mt-1"
                      value={newUser.role}
                      onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as UserRole }))}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Admin: Full access. PO: Can manage issues. Engineer: Can view/update issues. ReadOnly: View only.
                    </p>
                  </div>

                  {newUser.role !== 'Admin' && apps && apps.length > 0 && (
                    <div>
                      <label className="label">App Access</label>
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {apps.map((app) => (
                          <label key={app.app_id} className="flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              checked={newUser.app_access.includes(app.app_id)}
                              onChange={() => toggleAppAccess(app.app_id)}
                            />
                            <span className="ml-2 text-sm text-gray-700">{app.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 sm:mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUser.isPending || !newUser.email}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    {createUser.isPending ? 'Adding...' : 'Add User'}
                  </button>
                </div>

                {createUser.isError && (
                  <p className="mt-2 text-sm text-red-600">
                    Error: {(createUser.error as Error).message}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setEditingUser(null)}
            />
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <form onSubmit={handleUpdateUser}>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>

                <div className="space-y-4">
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      disabled
                      className="input mt-1 bg-gray-100"
                      value={editingUser.email}
                    />
                  </div>

                  <div>
                    <label className="label">Name</label>
                    <input
                      type="text"
                      disabled
                      className="input mt-1 bg-gray-100"
                      value={editingUser.name || ''}
                    />
                  </div>

                  <div>
                    <label className="label">Role</label>
                    <select
                      className="input mt-1"
                      value={editUserData.role}
                      onChange={(e) => setEditUserData((p) => ({ ...p, role: e.target.value as UserRole }))}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Admin: Full access. PO: Can manage issues. Engineer: Can view/update issues. ReadOnly: View only.
                    </p>
                  </div>

                  {editUserData.role !== 'Admin' && apps && apps.length > 0 && (
                    <div>
                      <label className="label">App Access</label>
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {apps.map((app) => (
                          <label key={app.app_id} className="flex items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              checked={editUserData.app_access.includes(app.app_id)}
                              onChange={() => toggleEditAppAccess(app.app_id)}
                            />
                            <span className="ml-2 text-sm text-gray-700">{app.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 sm:mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateUserMutation.isPending}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                {updateUserMutation.isError && (
                  <p className="mt-2 text-sm text-red-600">
                    Error: {(updateUserMutation.error as Error).message}
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
