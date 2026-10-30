import React, { useEffect, useState } from 'react';
import {
  X,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  FileText,
  List,
  Lock,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AuthorizedUser } from '../shared/types';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsersUpdated?: (users: AuthorizedUser[]) => void;
  onLogoutAdmin?: () => void;
  currentAdminUser?: string;
}

const LOCAL_STORAGE_KEY = 'wkt_authorized_streamers_backup';

function generateRandomKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(Math.floor(Math.random() * chars.length));
    p2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LIVE-${p1}-${p2}`;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onUsersUpdated,
  onLogoutAdmin,
  currentAdminUser = 'Admin',
}) => {
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newKey, setNewKey] = useState(generateRandomKey);
  const [newLabel, setNewLabel] = useState('');

  // Mode: list view, bulk edit, or change credentials
  const [tab, setTab] = useState<'list' | 'bulk' | 'credentials'>('list');
  const [bulkText, setBulkText] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  // Credentials change state
  const [credCurrentPass, setCredCurrentPass] = useState('');
  const [credNewUser, setCredNewUser] = useState(currentAdminUser);
  const [credNewPass, setCredNewPass] = useState('');
  const [credConfirmPass, setCredConfirmPass] = useState('');
  const [showCredPass, setShowCredPass] = useState(false);
  const [credLoading, setCredLoading] = useState(false);

  // Fetch authorized users when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setStatusMessage(null);

    fetch('/api/admin/authorized-users')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.ok && Array.isArray(data.users)) {
          setUsers(data.users);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.users));
          } catch {}
        } else {
          fallbackLocal();
        }
      })
      .catch(() => {
        if (isMounted) fallbackLocal();
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    function fallbackLocal() {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setUsers(parsed);
          return;
        }
      } catch {}
      setUsers([
        {
          username: 'mindtipgames',
          key: 'LIVE-KEY-2026',
          label: 'Default Streamer',
          createdAt: Date.now(),
        },
      ]);
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Synchronize bulk text when switching to bulk tab
  useEffect(() => {
    if (tab === 'bulk') {
      const lines = users.map((u) => {
        const labelPart = u.label ? ` # ${u.label}` : '';
        return `@${u.username} : ${u.key}${labelPart}`;
      });
      setBulkText(lines.join('\n'));
    }
  }, [tab, users]);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyReveal = (username: string) => {
    setRevealedKeys((prev) => ({ ...prev, [username]: !prev[username] }));
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsername.trim().replace(/^@/, '').toLowerCase();
    const cleanKey = newKey.trim();

    if (!cleanUser) {
      setStatusMessage({ text: 'Please enter a TikTok @username', isError: true });
      return;
    }
    if (!cleanKey) {
      setStatusMessage({ text: 'Please provide or generate a key', isError: true });
      return;
    }

    // Check if user already exists
    if (users.some((u) => u.username.toLowerCase() === cleanUser)) {
      setStatusMessage({ text: `@${cleanUser} is already in the list. Edit or remove them below.`, isError: true });
      return;
    }

    const updated = [
      ...users,
      {
        username: cleanUser,
        key: cleanKey,
        label: newLabel.trim() || undefined,
        createdAt: Date.now(),
      },
    ];

    setUsers(updated);
    setNewUsername('');
    setNewKey(generateRandomKey());
    setNewLabel('');
    setStatusMessage({ text: `Added @${cleanUser}. Remember to click "Save Changes".` });
  };

  const handleDeleteUser = (usernameToDelete: string) => {
    const updated = users.filter((u) => u.username.toLowerCase() !== usernameToDelete.toLowerCase());
    setUsers(updated);
    setStatusMessage({ text: `Removed @${usernameToDelete}. Click "Save Changes" to apply.` });
  };

  const handleApplyBulkText = () => {
    const lines = bulkText.split('\n');
    const parsedList: AuthorizedUser[] = [];
    const seen = new Set<string>();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      let commentPart = '';
      let entryPart = line;
      if (line.includes('#')) {
        const parts = line.split('#');
        entryPart = parts[0];
        commentPart = parts.slice(1).join('#').trim();
      }

      // Check for delimiter ":" or "," or "\t"
      let userStr = '';
      let keyStr = '';

      if (entryPart.includes(':')) {
        const spl = entryPart.split(':');
        userStr = spl[0].trim();
        keyStr = spl.slice(1).join(':').trim();
      } else if (entryPart.includes(',')) {
        const spl = entryPart.split(',');
        userStr = spl[0].trim();
        keyStr = spl.slice(1).join(',').trim();
      } else if (entryPart.includes('\t')) {
        const spl = entryPart.split('\t');
        userStr = spl[0].trim();
        keyStr = spl.slice(1).join('\t').trim();
      } else {
        const parts = entryPart.split(/\s+/);
        if (parts.length >= 2) {
          userStr = parts[0];
          keyStr = parts[1];
        }
      }

      const cleanUser = userStr.replace(/^@/, '').toLowerCase().trim();
      const cleanKey = keyStr.trim();

      if (cleanUser && cleanKey && !seen.has(cleanUser)) {
        seen.add(cleanUser);
        parsedList.push({
          username: cleanUser,
          key: cleanKey,
          label: commentPart || undefined,
          createdAt: Date.now(),
        });
      }
    }

    if (parsedList.length === 0) {
      setStatusMessage({ text: 'No valid user:key pairs found in text.', isError: true });
      return;
    }

    setUsers(parsedList);
    setTab('list');
    setStatusMessage({ text: `Loaded ${parsedList.length} streamers. Click "Save Changes" to commit.` });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/authorized-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users }),
      });

      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.users));
        } catch {}
        setStatusMessage({ text: `Successfully saved ${data.users.length} authorized streamers!` });
        onUsersUpdated?.(data.users);
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err: any) {
      // Local fallback save
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(users));
      } catch {}
      setStatusMessage({
        text: `Saved locally (${err?.message || 'Server sync error'}).`,
      });
      onUsersUpdated?.(users);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credCurrentPass) {
      setStatusMessage({ text: 'Please enter your current admin password', isError: true });
      return;
    }
    if (!credNewUser || credNewUser.trim().length < 2) {
      setStatusMessage({ text: 'New username must be at least 2 characters', isError: true });
      return;
    }
    if (!credNewPass || credNewPass.length < 4) {
      setStatusMessage({ text: 'New password must be at least 4 characters', isError: true });
      return;
    }
    if (credNewPass !== credConfirmPass) {
      setStatusMessage({ text: 'New passwords do not match', isError: true });
      return;
    }

    setCredLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: credCurrentPass,
          newUsername: credNewUser.trim(),
          newPassword: credNewPass,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setStatusMessage({ text: 'Admin username and password updated successfully!' });
        try {
          localStorage.setItem(
            'wkt_admin_creds',
            JSON.stringify({ username: credNewUser.trim(), password: credNewPass })
          );
        } catch {}
        setCredCurrentPass('');
        setCredNewPass('');
        setCredConfirmPass('');
      } else {
        setStatusMessage({ text: data.message || 'Failed to update credentials', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'Failed to connect to server', isError: true });
    } finally {
      setCredLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#111923] border-2 border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#0d141c] border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Streamer Access Administration
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Logged in as {currentAdminUser}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage registered @usernames and individual admin-provided access keys
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onLogoutAdmin && (
              <button
                type="button"
                onClick={() => {
                  onLogoutAdmin();
                  onClose();
                }}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition flex items-center gap-1"
                title="Log out of Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center justify-between px-5 pt-3 bg-[#111923] border-b border-slate-800/60 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                tab === 'list'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Streamer List ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('bulk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                tab === 'bulk'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Bulk Paste / Export
            </button>
            <button
              type="button"
              onClick={() => setTab('credentials')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                tab === 'credentials'
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Change Password
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
                statusMessage.isError
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-xs underline opacity-75 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {tab === 'list' ? (
            <>
              {/* Add New Streamer Card */}
              <div className="p-4 rounded-xl bg-[#0d141c] border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-orange-400" />
                    Authorize New Streamer
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewKey(generateRandomKey())}
                    className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1"
                    title="Generate a fresh random key"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate Key
                  </button>
                </div>

                <form onSubmit={handleAddUser} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        TikTok Username
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="@streamer"
                        className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Streamer Key
                      </label>
                      <input
                        type="text"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        placeholder="LIVE-XXXX-XXXX"
                        className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Note / Label (Optional)
                      </label>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Main host, tournament..."
                        className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Streamer
                    </button>
                  </div>
                </form>
              </div>

              {/* Authorized Users List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Authorized Accounts ({users.length})</span>
                  <span>Click key to toggle visibility</span>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Loading authorized streamers...
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center bg-[#0d141c] border border-slate-800 rounded-xl">
                    <p className="text-xs text-slate-400">
                      No authorized streamers configured yet.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Add a TikTok username and key above to allow live chat relay.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {users.map((u) => {
                      const isRevealed = !!revealedKeys[u.username];
                      const isCopied = copiedKey === u.username;
                      return (
                        <div
                          key={u.username}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d141c] border border-slate-800/70 hover:border-slate-700/80 transition group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-orange-400 uppercase shrink-0">
                              {u.username[0] || 'T'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white tracking-wide">
                                  @{u.username}
                                </span>
                                {u.label && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                    {u.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleKeyReveal(u.username)}
                                  className="text-[11px] font-mono text-slate-400 hover:text-slate-200 transition text-left"
                                  title="Click to reveal/hide"
                                >
                                  Key:{' '}
                                  <span className="text-orange-300">
                                    {isRevealed
                                      ? u.key
                                      : `${u.key.slice(0, 5)}••••••••`}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopy(u.key, u.username)}
                              className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded-lg transition"
                              title="Copy access key"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.username)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                              title="Remove streamer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : tab === 'bulk' ? (
            /* Bulk Paste / Import Tab */
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                <p>Paste one user per line using format:</p>
                <code className="text-[11px] text-orange-300 bg-slate-900 px-2 py-0.5 rounded">
                  @username : ACCESS-KEY # optional label
                </code>
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={10}
                placeholder={`@mindtipgames : LIVE-KEY-2026 # Main Streamer\n@streamer2 : LIVE-ABCD-EFGH # Secondary Host`}
                className="w-full bg-[#0d141c] border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bulkText);
                    setStatusMessage({ text: 'Copied bulk list to clipboard.' });
                  }}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg transition"
                >
                  Copy All to Clipboard
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkText}
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Parse &amp; Update List
                </button>
              </div>
            </div>
          ) : (
            /* Change Admin Credentials Tab */
            <div className="p-4 rounded-xl bg-[#0d141c] border border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Update Admin Login Credentials
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Change the username and password required to open this Admin panel.
                Default credentials are <span className="text-orange-400 font-mono">User: Admin</span>,{' '}
                <span className="text-orange-400 font-mono">Password: MissingWiki</span>.
              </p>

              <form onSubmit={handleChangeCredentials} className="space-y-3 max-w-md">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Current Admin Password
                  </label>
                  <input
                    type="password"
                    value={credCurrentPass}
                    onChange={(e) => setCredCurrentPass(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    autoComplete="current-password"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    New Admin Username
                  </label>
                  <input
                    type="text"
                    value={credNewUser}
                    onChange={(e) => setCredNewUser(e.target.value)}
                    placeholder="Admin"
                    className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    New Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCredPass ? 'text' : 'password'}
                      value={credNewPass}
                      onChange={(e) => setCredNewPass(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCredPass(!showCredPass)}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-200"
                    >
                      {showCredPass ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Confirm New Admin Password
                  </label>
                  <input
                    type="password"
                    value={credConfirmPass}
                    onChange={(e) => setCredConfirmPass(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-[#16212e] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    autoComplete="new-password"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={credLoading}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {credLoading ? 'Updating...' : 'Update Admin Credentials'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0d141c] border-t border-[#1e293b]">
          <span className="text-[11px] text-slate-500">
            Streamers must enter their matching key to access TikTok Live relay.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Close
            </button>
            {tab !== 'credentials' && (
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
