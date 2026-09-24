import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  Lock, 
  Trash2, 
  CheckCircle2, 
  Save, 
  AlertTriangle,
  Smartphone,
  KeyRound,
  LogOut,
  Laptop,
  Globe,
  RefreshCw,
  Camera,
  FileText
} from 'lucide-react';
import AvatarUploadModal from '../components/AvatarUploadModal';
import LegalModal from '../components/LegalModal';
import { apiService } from '../services/api';

export default function SettingsView({ user, onProfileUpdated }) {
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'privacy' | 'notifications' | 'security' | 'delete'
  const [settings, setSettings] = useState(user?.settings || {});
  const [bio, setBio] = useState(user?.bio || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState(null);
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, success: null, error: null });

  // Phone Change State
  const [newPhone, setNewPhone] = useState('');
  const [phoneStatus, setPhoneStatus] = useState({ loading: false, success: null, error: null });

  // UX Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadSettingsAndSecurity() {
      try {
        const [setRes, blockRes, sessRes] = await Promise.allSettled([
          apiService.getSettings(),
          apiService.getBlockedUsers(),
          apiService.getSessions()
        ]);
        if (setRes.status === 'fulfilled' && setRes.value.settings) {
          setSettings(setRes.value.settings);
        }
        if (blockRes.status === 'fulfilled' && blockRes.value.blockedUsers) {
          setBlockedUsers(blockRes.value.blockedUsers);
        }
        if (sessRes.status === 'fulfilled' && sessRes.value.sessions) {
          setSessions(sessRes.value.sessions);
        }
      } catch (err) {
        console.error('Settings load error:', err);
      }
    }
    loadSettingsAndSecurity();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiService.updateSettings({
        ...settings,
        bio,
        department
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnblock = async (publicProfileId) => {
    try {
      await apiService.unblockUser(publicProfileId);
      setBlockedUsers(prev => prev.filter(u => u.public_profile_id !== publicProfileId));
    } catch (err) {
      alert('Failed to unblock: ' + err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ loading: true, success: null, error: null });

    if (newPassword.length < 8) {
      setPasswordStatus({ loading: false, success: null, error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({ loading: false, success: null, error: 'New passwords do not match.' });
      return;
    }

    try {
      const res = await apiService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword: confirmNewPassword
      });
      setPasswordStatus({ loading: false, success: res.message || 'Password updated successfully.', error: null });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordStatus({ loading: false, success: null, error: err.message || 'Failed to update password.' });
    }
  };

  const handleChangePhone = async (e) => {
    e.preventDefault();
    setPhoneStatus({ loading: true, success: null, error: null });

    try {
      const res = await apiService.changePhone(newPhone);
      setPhoneStatus({ loading: false, success: res.message || 'Phone number updated.', error: null });
      setNewPhone('');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      setPhoneStatus({ loading: false, success: null, error: err.message || 'Failed to update phone number.' });
    }
  };

  const handleLogoutOthers = async () => {
    try {
      await apiService.logoutOthers();
      const sessRes = await apiService.getSessions();
      if (sessRes.sessions) setSessions(sessRes.sessions);
      alert('Terminated all other active sessions.');
    } catch (err) {
      alert('Failed to terminate sessions: ' + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } finally {
      window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      alert('Please type DELETE in capital letters to confirm.');
      return;
    }
    if (!confirm('Are you absolutely certain? This will purge all private identifiers and permanently anonymize your account.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await apiService.deleteAccount('DELETE');
      alert('Your account has been deleted. You will now be redirected.');
      window.location.reload();
    } catch (err) {
      alert('Failed to delete account: ' + err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto space-y-4">
      {/* Header */}
      <div className="p-4 bg-white border border-slate-border rounded-2xl shadow-soft-card flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-slate-headline">Settings & Privacy</h1>
          <p className="text-[12px] text-slate-meta">Manage public identity, privacy permissions, and security</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary hover:bg-primary-hover text-white text-[13px] font-bold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="grid grid-cols-5 p-1.5 bg-slate-subtle rounded-2xl border border-slate-border text-[12px] font-semibold gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'account', label: 'Account', icon: User },
          { id: 'privacy', label: 'Privacy', icon: Shield },
          { id: 'notifications', label: 'Alerts', icon: Bell },
          { id: 'security', label: 'Security', icon: Lock },
          { id: 'delete', label: 'Danger', icon: Trash2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 ${
                active 
                  ? 'bg-white text-slate-headline shadow-sm' 
                  : 'text-slate-meta hover:text-slate-headline'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: ACCOUNT                                               */}
      {/* ============================================================ */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-2xl border border-slate-border p-5 space-y-5 shadow-soft-card">
          <div>
            <h2 className="text-[15px] font-bold text-slate-headline">Public Profile Identity</h2>
            <p className="text-[12px] text-slate-meta">
              Other students see only your public handle and display pseudonym. Your real name is strictly private.
            </p>
          </div>

          {/* Read-Only Identity Card with Avatar Editing */}
          <div className="p-3.5 bg-slate-subtle rounded-xl border border-slate-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <img
                  src={avatarUrl || user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full object-cover border border-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                  title="Change avatar"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div>
                <p className="text-[14px] font-bold text-slate-headline">{user?.display_name || 'Anonymous Student'}</p>
                <p className="text-[12px] text-slate-meta">{user?.handle || '@anon'}</p>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  <span>Change Profile Picture</span>
                </button>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-primary-dark">
              Immutable Mask
            </span>
          </div>

          {/* Department & Bio fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-headline mb-1">Department / Branch</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. AI & ML, Computer Science"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-headline mb-1">Public Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief public bio visible on campus profile..."
                maxLength={300}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
              <span className="text-[10px] text-slate-meta">{bio.length}/300 characters</span>
            </div>
          </div>

          {/* Change Phone Section */}
          <div className="pt-3 border-t border-slate-border">
            <h3 className="text-[14px] font-bold text-slate-headline flex items-center gap-1.5 mb-1">
              <Smartphone className="w-4 h-4 text-primary" />
              <span>Change Verified Phone Number</span>
            </h3>
            <p className="text-[11px] text-slate-meta mb-3">
              Current Phone: <span className="font-mono text-slate-headline">{user?.private?.phone_number || '+91 **********'}</span>
            </p>

            <form onSubmit={handleChangePhone} className="flex gap-2">
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Enter new +91 phone number"
                className="grow px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={phoneStatus.loading || !newPhone}
                className="px-4 py-2 rounded-xl bg-slate-headline hover:bg-slate-800 text-white font-bold text-[12px] transition disabled:opacity-50"
              >
                {phoneStatus.loading ? 'Updating...' : 'Update Phone'}
              </button>
            </form>
            {phoneStatus.error && <p className="text-[11px] text-tertiary mt-1">{phoneStatus.error}</p>}
            {phoneStatus.success && <p className="text-[11px] text-primary mt-1">{phoneStatus.success}</p>}
          </div>

          {/* Change Password Section */}
          <div className="pt-3 border-t border-slate-border">
            <h3 className="text-[14px] font-bold text-slate-headline flex items-center gap-1.5 mb-1">
              <KeyRound className="w-4 h-4 text-primary" />
              <span>Change Password</span>
            </h3>
            <p className="text-[11px] text-slate-meta mb-3">
              Requires your current password. Updating password will revoke other active sessions.
            </p>

            <form onSubmit={handleChangePassword} className="space-y-2.5">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-border text-[13px] text-slate-headline focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <button
                type="submit"
                disabled={passwordStatus.loading || !currentPassword || !newPassword}
                className="px-4 py-2 rounded-xl bg-slate-headline hover:bg-slate-800 text-white font-bold text-[12px] transition disabled:opacity-50"
              >
                {passwordStatus.loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
            {passwordStatus.error && <p className="text-[11px] text-tertiary mt-1">{passwordStatus.error}</p>}
            {passwordStatus.success && <p className="text-[11px] text-primary mt-1">{passwordStatus.success}</p>}
          </div>

          {/* Account Verification Details */}
          <div className="pt-3 border-t border-slate-border">
            <h3 className="text-[13px] font-bold text-slate-headline mb-2">Student Verification Status</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-slate-headline">Institutional Email</p>
                  <p className="text-[10px] text-slate-meta font-mono truncate">{user?.private?.email || 'Verified'}</p>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-slate-headline">Phone Verification</p>
                  <p className="text-[10px] text-slate-meta font-mono">OTP Verified (+91)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PRIVACY                                               */}
      {/* ============================================================ */}
      {activeTab === 'privacy' && (
        <div className="bg-white rounded-2xl border border-slate-border p-5 space-y-4 shadow-soft-card">
          <h2 className="text-[15px] font-bold text-slate-headline">Privacy Controls</h2>
          <p className="text-[12px] text-slate-meta">Configure what peers can see and who can interact with you</p>

          <div className="space-y-3 pt-2">
            {/* Field Toggles */}
            <div className="border border-slate-border rounded-xl p-3.5 space-y-3">
              <h3 className="text-[13px] font-bold text-slate-headline">Information Visibility</h3>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-headline">Display Department</p>
                  <p className="text-[11px] text-slate-meta">Show your major on your public profile</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.show_department !== false}
                  onChange={(e) => setSettings({ ...settings, show_department: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-headline">Display Graduation Year</p>
                  <p className="text-[11px] text-slate-meta">Show batch class year on your public profile</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.show_year !== false}
                  onChange={(e) => setSettings({ ...settings, show_year: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-headline">Display Bio</p>
                  <p className="text-[11px] text-slate-meta">Show profile bio description</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.show_bio !== false}
                  onChange={(e) => setSettings({ ...settings, show_bio: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
              </div>
            </div>

            {/* Interaction Permissions */}
            <div className="border border-slate-border rounded-xl p-3.5 space-y-3 bg-slate-subtle/50">
              <h3 className="text-[13px] font-bold text-slate-headline">Interaction Permissions</h3>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-slate-headline">Profile Discoverability</p>
                  <p className="text-[11px] text-slate-meta">Allow peers to find your public pseudonym via search</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.profile_discoverability !== false}
                  onChange={(e) => setSettings({ ...settings, profile_discoverability: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-headline mb-1">Who Can Comment on My Posts?</label>
                <select
                  value={settings.who_can_comment || 'everyone'}
                  onChange={(e) => setSettings({ ...settings, who_can_comment: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-border text-[13px] text-slate-headline"
                >
                  <option value="everyone">Everyone at Sanjivani</option>
                  <option value="followers">Followers only</option>
                  <option value="nobody">Nobody (Disable comments)</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-headline mb-1">Who Can Follow Me?</label>
                <select
                  value={settings.who_can_follow || 'everyone'}
                  onChange={(e) => setSettings({ ...settings, who_can_follow: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-border text-[13px] text-slate-headline"
                >
                  <option value="everyone">Everyone</option>
                  <option value="verified_only">Verified Students Only</option>
                </select>
              </div>
            </div>

            {/* Blocked Users Section */}
            <div className="border border-slate-border rounded-xl p-3.5 space-y-3">
              <h3 className="text-[13px] font-bold text-slate-headline">Blocked Students ({blockedUsers.length})</h3>
              {blockedUsers.length === 0 ? (
                <p className="text-[12px] text-slate-meta">You haven't blocked any students.</p>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-subtle">
                      <span className="text-[12px] font-bold text-slate-headline">{b.anonymous_pseudonym} ({b.handle})</span>
                      <button
                        onClick={() => handleUnblock(b.public_profile_id)}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: NOTIFICATIONS                                         */}
      {/* ============================================================ */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-border p-5 space-y-4 shadow-soft-card">
          <h2 className="text-[15px] font-bold text-slate-headline">Notification Preferences</h2>
          <p className="text-[12px] text-slate-meta">Choose which campus events trigger alerts</p>

          <div className="space-y-3 pt-2">
            {[
              { key: 'notify_likes', label: 'Post Likes & Upvotes', desc: 'When peers upvote your posts' },
              { key: 'notify_comments', label: 'Discussion Comments', desc: 'When peers reply to your posts' },
              { key: 'notify_replies', label: 'Threaded Replies', desc: 'When someone replies directly to your comment' },
              { key: 'notify_followers', label: 'New Followers', desc: 'When another student follows your public profile' },
              { key: 'notify_events', label: 'Campus Event Alerts', desc: 'Reminders for registered hackathons and events' },
              { key: 'notify_announcements', label: 'Official University Announcements', desc: 'Administrative and safety bulletins' }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-slate-border/50">
                <div>
                  <p className="text-[13px] font-semibold text-slate-headline">{item.label}</p>
                  <p className="text-[11px] text-slate-meta">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings[item.key] !== false}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  className="w-4 h-4 text-primary rounded"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: SECURITY & SESSIONS                                   */}
      {/* ============================================================ */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-border p-5 space-y-4 shadow-soft-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold text-slate-headline">Security & Device Sessions</h2>
              <p className="text-[12px] text-slate-meta">Manage active login tokens across devices</p>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleLogoutOthers}
                className="text-[11px] font-bold text-tertiary hover:underline"
              >
                Sign out other devices
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {sessions.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-subtle border border-slate-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Laptop className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-[13px] font-bold text-slate-headline">Current Browser Session</p>
                    <p className="text-[11px] text-slate-meta">Active now • Verified Institutional Access</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-primary-dark">
                  Active
                </span>
              </div>
            ) : (
              sessions.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    s.isCurrent
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-subtle border-slate-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Laptop className={`w-5 h-5 ${s.isCurrent ? 'text-primary' : 'text-slate-meta'}`} />
                    <div>
                      <p className="text-[13px] font-bold text-slate-headline">
                        {s.isCurrent ? 'This Device (Current Session)' : 'Active Device Session'}
                      </p>
                      <p className="text-[11px] text-slate-meta font-mono">
                        IP: {s.ip || '127.0.0.1'} • {s.device ? s.device.slice(0, 35) + '...' : 'Browser'}
                      </p>
                    </div>
                  </div>
                  {s.isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-primary-dark">
                      Current
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-border flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-slate-headline">Sign Out of Campus Radar</p>
              <p className="text-[11px] text-slate-meta">Terminates this device's authenticated session</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-subtle hover:bg-slate-200 text-slate-headline text-[12px] font-bold transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: DANGER ZONE                                           */}
      {/* ============================================================ */}
      {activeTab === 'delete' && (
        <div className="bg-white rounded-2xl border border-red-200 p-5 space-y-4 shadow-soft-card">
          <div className="flex items-center gap-2 text-tertiary">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-[16px] font-bold">Permanently Delete Account</h2>
          </div>

          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[12px] space-y-2 leading-relaxed">
            <p>
              <strong>Warning:</strong> Account deletion is irreversible.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>All private identifiers (full name, student email, phone number) are permanently purged.</li>
              <li>Follow relationships, likes, bookmarks, and notifications are removed.</li>
              <li>Authored public posts and comments are anonymized to <code>Deleted Student</code>.</li>
            </ul>
          </div>

          <div className="pt-2 space-y-2">
            <label className="block text-[12px] font-semibold text-slate-headline">
              To proceed, please type <span className="font-mono text-tertiary">DELETE</span> below:
            </label>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE..."
              className="w-full px-3.5 py-2 rounded-xl border border-red-300 text-[13px] font-mono text-slate-headline focus:outline-none focus:ring-2 focus:ring-tertiary"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmation !== 'DELETE'}
              className="w-full py-2.5 rounded-full bg-tertiary hover:bg-tertiary-hover text-white text-[13px] font-bold shadow-sm transition active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              {isDeleting ? 'Deleting Account...' : 'Confirm Account Deletion'}
            </button>
          </div>
        </div>
      )}

      {/* Terms & Privacy Policy Card */}
      <div className="p-4 bg-white border border-slate-border rounded-2xl shadow-soft-card flex items-center justify-between text-[12px]">
        <div>
          <p className="font-bold text-slate-headline">Campus Radar Policies</p>
          <p className="text-slate-meta text-[11px]">Sanjivani University collegiate network guidelines</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLegalModalTab('terms')}
            className="px-3 py-1.5 rounded-xl border border-slate-border hover:bg-slate-subtle text-slate-headline font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span>Terms of Service</span>
          </button>
          <button
            type="button"
            onClick={() => setLegalModalTab('privacy')}
            className="px-3 py-1.5 rounded-xl border border-slate-border hover:bg-slate-subtle text-slate-headline font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-secondary" />
            <span>Privacy Policy</span>
          </button>
        </div>
      </div>

      {/* Avatar Upload / Replace Modal */}
      <AvatarUploadModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={avatarUrl || user?.avatar}
        onAvatarUpdated={(newUrl) => {
          setAvatarUrl(newUrl);
          if (onProfileUpdated) onProfileUpdated();
        }}
      />

      {/* Legal & Policies Modal */}
      <LegalModal
        isOpen={!!legalModalTab}
        initialTab={legalModalTab || 'terms'}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
}
