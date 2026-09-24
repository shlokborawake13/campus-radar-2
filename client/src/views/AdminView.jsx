import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageCircle,
  MessageSquare,
  Calendar,
  Flag,
  ShieldCheck,
  Activity,
  Lock,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  RotateCcw,
  UserX,
  UserCheck,
  Plus,
  BarChart3,
  TrendingUp,
  Globe,
  Sliders,
  ExternalLink,
  Info
} from 'lucide-react';
import { apiService } from '../services/api';

export default function AdminView({ currentUser }) {
  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'users' | 'posts' | 'confessions' | 'comments' | 'events' | 'reports' | 'audit' | 'analytics' | 'security'
  const [timeRange, setTimeRange] = useState('7d');

  // Loading & Global Status
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  // 1. Dashboard State
  const [dashboardData, setDashboardData] = useState(null);

  // 2. Users State
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersQuery, setUsersQuery] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('all');
  const [usersStatusFilter, setUsersStatusFilter] = useState('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [userTimeline, setUserTimeline] = useState([]);
  const [userModalTab, setUserModalTab] = useState('identity'); // 'identity' | 'account' | 'activity' | 'security' | 'timeline'
  const [editingUser, setEditingUser] = useState(null);

  // 3. Posts State
  const [posts, setPosts] = useState([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsPage, setPostsPage] = useState(1);
  const [postsQuery, setPostsQuery] = useState('');
  const [postsStatusFilter, setPostsStatusFilter] = useState('active');

  // 4. Confessions State
  const [confessions, setConfessions] = useState([]);
  const [confessionsTotal, setConfessionsTotal] = useState(0);
  const [confessionsPage, setConfessionsPage] = useState(1);
  const [confessionsQuery, setConfessionsQuery] = useState('');
  const [confessionsStatusFilter, setConfessionsStatusFilter] = useState('active');

  // 5. Comments State
  const [comments, setComments] = useState([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsQuery, setCommentsQuery] = useState('');
  const [commentsStatusFilter, setCommentsStatusFilter] = useState('active');

  // 6. Events State
  const [events, setEvents] = useState([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    category: 'Campus Life',
    location: '',
    event_date: '',
    image_url: '',
    is_published: true
  });

  // 7. Reports State
  const [reports, setReports] = useState([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsStatusFilter, setReportsStatusFilter] = useState('all');
  const [resolvingReport, setResolvingReport] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [deleteReportedContent, setDeleteReportedContent] = useState(false);

  // 8. Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditQuery, setAuditQuery] = useState('');

  // 9. Analytics State
  const [analyticsOverview, setAnalyticsOverview] = useState(null);
  const [pageAnalytics, setPageAnalytics] = useState([]);

  // 10. Security State
  const [securityData, setSecurityData] = useState(null);

  // Confirmation Modal
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // ==========================================================================
  // DATA FETCHERS
  // ==========================================================================

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminOverview(timeRange);
      if (res && res.stats) {
        setDashboardData(res);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminUsers({
        q: usersQuery,
        role: usersRoleFilter,
        status: usersStatusFilter,
        page: usersPage,
        limit: 15
      });
      if (res) {
        setUsers(res.users || []);
        setUsersTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [usersQuery, usersRoleFilter, usersStatusFilter, usersPage]);

  const fetchPosts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminPosts({
        q: postsQuery,
        status: postsStatusFilter,
        page: postsPage,
        limit: 15
      });
      if (res) {
        setPosts(res.posts || []);
        setPostsTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [postsQuery, postsStatusFilter, postsPage]);

  const fetchConfessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminConfessions({
        q: confessionsQuery,
        status: confessionsStatusFilter,
        page: confessionsPage,
        limit: 15
      });
      if (res) {
        setConfessions(res.confessions || []);
        setConfessionsTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [confessionsQuery, confessionsStatusFilter, confessionsPage]);

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminComments({
        q: commentsQuery,
        status: commentsStatusFilter,
        page: commentsPage,
        limit: 15
      });
      if (res) {
        setComments(res.comments || []);
        setCommentsTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [commentsQuery, commentsStatusFilter, commentsPage]);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminEvents();
      if (res) {
        setEvents(res.events || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminReports({
        status: reportsStatusFilter,
        page: reportsPage,
        limit: 20
      });
      if (res) {
        setReports(res.reports || []);
        setReportsTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [reportsStatusFilter, reportsPage]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminAuditLogs({
        q: auditQuery,
        action: auditActionFilter,
        page: auditPage,
        limit: 30
      });
      if (res) {
        setAuditLogs(res.logs || []);
        setAuditTotal(res.total || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [auditQuery, auditActionFilter, auditPage]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      const [overviewRes, pagesRes] = await Promise.all([
        apiService.getAdminAnalyticsOverview(timeRange),
        apiService.getAdminAnalyticsPages()
      ]);
      if (overviewRes) setAnalyticsOverview(overviewRes);
      if (pagesRes) setPageAnalytics(pagesRes.pages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  const fetchSecurity = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiService.getAdminSecurityOverview();
      if (res) setSecurityData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Dispatch fetcher according to active tab
  useEffect(() => {
    setError(null);
    if (activeTab === 'dashboard') fetchDashboard();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'posts') fetchPosts();
    else if (activeTab === 'confessions') fetchConfessions();
    else if (activeTab === 'comments') fetchComments();
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'reports') fetchReports();
    else if (activeTab === 'audit') fetchAuditLogs();
    else if (activeTab === 'analytics') fetchAnalytics();
    else if (activeTab === 'security') fetchSecurity();
  }, [activeTab, fetchDashboard, fetchUsers, fetchPosts, fetchConfessions, fetchComments, fetchEvents, fetchReports, fetchAuditLogs, fetchAnalytics, fetchSecurity]);

  // Load User Detail with Timeline
  const handleInspectUser = async (userId) => {
    setActionLoading(userId);
    try {
      const res = await apiService.getAdminUserDetail(userId);
      if (res && res.user) {
        setSelectedUserDetail(res.user);
        setUserModalTab('identity');
        // Concurrently fetch timeline
        const timelineRes = await apiService.getAdminUserTimeline(userId);
        if (timelineRes && timelineRes.timeline) {
          setUserTimeline(timelineRes.timeline);
        }
      }
    } catch (err) {
      alert('Failed to load user profile: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Execute Confirmed Admin Actions
  const handleExecuteConfirmedAction = async () => {
    if (!confirmDialog) return;
    const { type, id, payload } = confirmDialog;
    setActionLoading(id || 'executing');
    try {
      if (type === 'SUSPEND_USER') {
        await apiService.suspendAdminUser(id, payload.reason);
        showToast('User account suspended and active sessions terminated');
        fetchUsers();
        if (selectedUserDetail) handleInspectUser(id);
      } else if (type === 'UNSUSPEND_USER') {
        await apiService.unsuspendAdminUser(id);
        showToast('User account restored to active status');
        fetchUsers();
        if (selectedUserDetail) handleInspectUser(id);
      } else if (type === 'BAN_USER') {
        await apiService.banAdminUser(id, payload.reason);
        showToast('User permanently banned');
        fetchUsers();
        if (selectedUserDetail) handleInspectUser(id);
      } else if (type === 'UNBAN_USER') {
        await apiService.unbanAdminUser(id);
        showToast('User unbanned');
        fetchUsers();
        if (selectedUserDetail) handleInspectUser(id);
      } else if (type === 'DELETE_USER') {
        await apiService.deleteAdminUser(id, payload.reason);
        showToast('User account deactivated');
        fetchUsers();
        setSelectedUserDetail(null);
      } else if (type === 'RESTORE_USER') {
        await apiService.restoreAdminUser(id);
        showToast('User reinstated');
        fetchUsers();
        if (selectedUserDetail) handleInspectUser(id);
      } else if (type === 'DELETE_POST') {
        await apiService.deleteAdminPost(id, payload.reason);
        showToast('Post removed from feed');
        fetchPosts();
      } else if (type === 'RESTORE_POST') {
        await apiService.restoreAdminPost(id);
        showToast('Post restored');
        fetchPosts();
      } else if (type === 'DELETE_CONFESSION') {
        await apiService.deleteAdminConfession(id, payload.reason);
        showToast('Confession removed');
        fetchConfessions();
      } else if (type === 'RESTORE_CONFESSION') {
        await apiService.restoreAdminConfession(id);
        showToast('Confession restored');
        fetchConfessions();
      } else if (type === 'DELETE_COMMENT') {
        await apiService.deleteAdminComment(id, payload.reason);
        showToast('Comment removed');
        fetchComments();
      } else if (type === 'RESTORE_COMMENT') {
        await apiService.restoreAdminComment(id);
        showToast('Comment restored');
        fetchComments();
      } else if (type === 'DELETE_EVENT') {
        await apiService.deleteAdminEvent(id, payload.reason);
        showToast('Event deleted');
        fetchEvents();
      } else if (type === 'RESTORE_EVENT') {
        await apiService.restoreAdminEvent(id);
        showToast('Event restored');
        fetchEvents();
      }
    } catch (err) {
      alert('Action failed: ' + err.message);
    } finally {
      setActionLoading(null);
      setConfirmDialog(null);
    }
  };

  // Submit User Field Edits
  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionLoading(editingUser.id);
    try {
      await apiService.updateAdminUser(editingUser.id, {
        full_name: editingUser.fullName,
        department: editingUser.department,
        graduation_year: editingUser.graduationYear,
        bio: editingUser.bio,
        role: editingUser.role,
        status: editingUser.status
      });
      showToast('Student information successfully updated & audited');
      setEditingUser(null);
      if (selectedUserDetail) handleInspectUser(editingUser.id);
      fetchUsers();
    } catch (err) {
      alert('Update failed: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Submit Event Creation
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setActionLoading('create-event');
    try {
      await apiService.createAdminEvent(newEvent);
      showToast('New campus event published successfully');
      setIsEventModalOpen(false);
      setNewEvent({
        title: '',
        description: '',
        category: 'Campus Life',
        location: '',
        event_date: '',
        image_url: '',
        is_published: true
      });
      fetchEvents();
    } catch (err) {
      alert('Failed to create event: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Resolve Report Submission
  const handleResolveReport = async () => {
    if (!resolvingReport) return;
    setActionLoading(resolvingReport.id);
    try {
      await apiService.resolveAdminReport(resolvingReport.id, {
        resolution: resolutionText || 'Violation resolved and addressed',
        deleteContent: deleteReportedContent
      });
      showToast('Report marked as resolved');
      setResolvingReport(null);
      setResolutionText('');
      setDeleteReportedContent(false);
      fetchReports();
    } catch (err) {
      alert('Failed to resolve report: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Dismiss Report Submission
  const handleDismissReport = async (reportId) => {
    setActionLoading(reportId);
    try {
      await apiService.dismissAdminReport(reportId, 'Dismissed by administrator: No policy violation.');
      showToast('Report dismissed');
      fetchReports();
    } catch (err) {
      alert('Failed to dismiss: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Access check
  if (error && error.includes('404')) {
    return (
      <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-5xl mx-auto">
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-border p-8 shadow-sm">
          <AlertCircle className="w-14 h-14 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-headline mb-1">404 Not Found</h2>
          <p className="text-sm text-slate-meta max-w-md mx-auto">
            The requested resource cannot be found or you lack administrative authorization to view it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-6xl mx-auto space-y-4">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="p-4 bg-white border border-slate-border rounded-2xl shadow-soft-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-headline flex items-center gap-2">
              Campus Radar Admin Command Center
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {currentUser?.role || 'Admin'}
              </span>
            </h1>
            <p className="text-xs text-slate-meta">
              Dual-system administration: Production Management Panel & Real-Time Student Activity Telemetry
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          {['dashboard', 'analytics'].includes(activeTab) && (
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="text-xs font-semibold bg-slate-subtle border border-slate-border rounded-lg px-2.5 py-1.5 text-slate-headline focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          )}

          <button
            onClick={() => {
              if (activeTab === 'dashboard') fetchDashboard();
              else if (activeTab === 'users') fetchUsers();
              else if (activeTab === 'posts') fetchPosts();
              else if (activeTab === 'confessions') fetchConfessions();
              else if (activeTab === 'comments') fetchComments();
              else if (activeTab === 'events') fetchEvents();
              else if (activeTab === 'reports') fetchReports();
              else if (activeTab === 'audit') fetchAuditLogs();
              else if (activeTab === 'analytics') fetchAnalytics();
              else if (activeTab === 'security') fetchSecurity();
            }}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-subtle border border-slate-border text-slate-meta hover:text-slate-headline hover:bg-slate-border/50 transition disabled:opacity-50"
            title="Refresh active view"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-subtle border border-slate-border rounded-xl overflow-x-auto text-xs font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'users' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users</span>
        </button>

        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'posts' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Posts</span>
        </button>

        <button
          onClick={() => setActiveTab('confessions')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'confessions' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>Confessions</span>
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'comments' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Comments</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'events' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Events</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'reports' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Reports</span>
        </button>

        <div className="w-[1px] h-5 bg-slate-border mx-1 shrink-0" />

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'audit' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>Admin Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'analytics' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-600" />
          <span>User Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition ${
            activeTab === 'security' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-meta hover:text-slate-headline'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-rose-600" />
          <span>Security</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. DASHBOARD OVERVIEW                                                */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {dashboardData?.stats ? (
            <>
              {/* Primary Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                  <span className="text-[11px] font-semibold text-slate-meta block">Total Users</span>
                  <span className="text-xl font-black text-slate-headline">{dashboardData.stats.totalUsers}</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">+{dashboardData.stats.newUsersToday} today</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                  <span className="text-[11px] font-semibold text-slate-meta block">Active Students</span>
                  <span className="text-xl font-black text-emerald-600">{dashboardData.stats.activeUsers}</span>
                  <span className="text-[10px] text-slate-meta block mt-0.5">{dashboardData.stats.verifiedUsers} verified</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                  <span className="text-[11px] font-semibold text-slate-meta block">DAU / WAU</span>
                  <span className="text-xl font-black text-indigo-600">{dashboardData.stats.dau} / {dashboardData.stats.wau}</span>
                  <span className="text-[10px] text-slate-meta block mt-0.5">MAU: {dashboardData.stats.mau}</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                  <span className="text-[11px] font-semibold text-slate-meta block">Online Now</span>
                  <span className="text-xl font-black text-emerald-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {dashboardData.stats.onlineUsers}
                  </span>
                  <span className="text-[10px] text-slate-meta block mt-0.5">Active sessions (15m)</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                  <span className="text-[11px] font-semibold text-slate-meta block">Pending Reports</span>
                  <span className={`text-xl font-black ${dashboardData.stats.pendingReports > 0 ? 'text-amber-600' : 'text-slate-headline'}`}>
                    {dashboardData.stats.pendingReports}
                  </span>
                  <span className="text-[10px] text-slate-meta block mt-0.5">{dashboardData.stats.totalReports} all-time</span>
                </div>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                  <span className="text-[11px] font-semibold text-slate-meta block">Moderated / Banned</span>
                  <span className="text-xl font-black text-rose-600">
                    {dashboardData.stats.suspendedUsers + dashboardData.stats.bannedUsers}
                  </span>
                  <span className="text-[10px] text-slate-meta block mt-0.5">{dashboardData.stats.deletedContent} items removed</span>
                </div>
              </div>

              {/* Content Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-meta font-medium">Posts</span>
                    <p className="text-base font-bold text-slate-headline">{dashboardData.stats.totalPosts}</p>
                  </div>
                  <FileText className="w-5 h-5 text-indigo-500 opacity-60" />
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-meta font-medium">Confessions</span>
                    <p className="text-base font-bold text-slate-headline">{dashboardData.stats.totalConfessions}</p>
                  </div>
                  <MessageCircle className="w-5 h-5 text-purple-500 opacity-60" />
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-meta font-medium">Comments</span>
                    <p className="text-base font-bold text-slate-headline">{dashboardData.stats.totalComments}</p>
                  </div>
                  <MessageSquare className="w-5 h-5 text-sky-500 opacity-60" />
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-meta font-medium">Events</span>
                    <p className="text-base font-bold text-slate-headline">{dashboardData.stats.totalEvents}</p>
                  </div>
                  <Calendar className="w-5 h-5 text-amber-500 opacity-60" />
                </div>
              </div>

              {/* Activity Trend Breakdown */}
              <div className="bg-white p-4 rounded-2xl border border-slate-border shadow-soft-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-headline flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Activity & Registration Trends ({timeRange.toUpperCase()})
                  </h3>
                  <span className="text-xs text-slate-meta font-semibold">Live Database Metrics</span>
                </div>
                {dashboardData.charts?.registrations?.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-7 gap-2 pt-2">
                      {dashboardData.charts.registrations.slice(-7).map((d) => (
                        <div key={d.date} className="bg-slate-subtle p-2 rounded-xl text-center">
                          <span className="text-[10px] text-slate-meta block">{d.date.slice(5)}</span>
                          <span className="text-xs font-bold text-indigo-700">+{d.count} users</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-meta py-4 text-center">No trend events in selected window.</p>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-meta">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              <p className="text-sm font-semibold">Aggregating live college metrics...</p>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. USER MANAGEMENT                                                   */}
      {/* ==================================================================== */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
                Student Directory & Account Governance
              </h2>
              <p className="text-xs text-slate-meta">
                Verified real student identities (Privileged Administrator View)
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-subtle rounded-lg text-slate-headline">
              {usersTotal} registered students
            </span>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-meta" />
              <input
                type="text"
                value={usersQuery}
                onChange={(e) => {
                  setUsersQuery(e.target.value);
                  setUsersPage(1);
                }}
                placeholder="Search by real name, email, handle, or department..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-border bg-slate-subtle/50 text-slate-headline focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={usersRoleFilter}
              onChange={(e) => {
                setUsersRoleFilter(e.target.value);
                setUsersPage(1);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-border bg-slate-subtle text-slate-headline"
            >
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>

            <select
              value={usersStatusFilter}
              onChange={(e) => {
                setUsersStatusFilter(e.target.value);
                setUsersPage(1);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-border bg-slate-subtle text-slate-headline"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-subtle text-slate-meta font-bold uppercase tracking-wider border-y border-slate-border">
                <tr>
                  <th className="py-2.5 px-3">Identity (Real & Public)</th>
                  <th className="py-2.5 px-3">Email & Phone</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Status / Role</th>
                  <th className="py-2.5 px-3">Engagement</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-border">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-meta">
                      No matching students found in directory.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-subtle/50 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-headline text-[13px]">{u.full_name || 'N/A'}</div>
                        <div className="text-[11px] text-slate-meta flex items-center gap-1.5">
                          <span>{u.anonymous_pseudonym}</span>
                          <span className="font-mono text-indigo-600">({u.handle})</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-headline">{u.email}</div>
                        <div className="text-[11px] text-slate-meta font-mono">{u.phone_number || 'No Phone'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-body">{u.department || 'General'}</span>
                        <div className="text-[11px] text-slate-meta">
                          {u.graduation_year ? `Class of '${String(u.graduation_year).slice(-2)}` : 'Enrolled'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            u.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            u.status === 'suspended' ? 'bg-amber-100 text-amber-800' :
                            u.status === 'banned' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {u.status}
                          </span>
                          <span className="text-[10px] font-mono text-slate-meta uppercase">{u.role}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-meta text-[11px]">
                          <span>{u.posts_count} posts</span> · <span>{u.confessions_count} conf</span>
                        </div>
                        <div className="text-[10px] text-amber-600">
                          {u.reports_count > 0 ? `${u.reports_count} reports against` : 'Clear record'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleInspectUser(u.id)}
                            disabled={actionLoading === u.id}
                            className="p-1.5 rounded-lg border border-slate-border text-slate-meta hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Inspect 4-Tier User Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setEditingUser({
                              id: u.id,
                              fullName: u.full_name || '',
                              department: u.department || '',
                              graduationYear: u.graduation_year || 2026,
                              bio: u.bio || '',
                              role: u.role || 'student',
                              status: u.status || 'active'
                            })}
                            className="p-1.5 rounded-lg border border-slate-border text-slate-meta hover:text-amber-600 hover:bg-amber-50 transition"
                            title="Controlled Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {u.status === 'active' ? (
                            <button
                              onClick={() => setConfirmDialog({
                                type: 'SUSPEND_USER',
                                id: u.id,
                                title: `Suspend student ${u.full_name}?`,
                                description: 'This will revoke all active student sessions immediately and block login until reinstated.',
                                payload: { reason: 'Violation of collegiate code of conduct' }
                              })}
                              disabled={u.role === 'admin' || u.role === 'super_admin'}
                              className="p-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition disabled:opacity-30"
                              title="Suspend User"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDialog({
                                type: 'UNSUSPEND_USER',
                                id: u.id,
                                title: `Reinstate student ${u.full_name}?`,
                                description: 'The student will regain access and be permitted to sign in.',
                                payload: {}
                              })}
                              className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition"
                              title="Reinstate to Active"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2 text-xs text-slate-meta">
            <span>Page {usersPage} of {Math.max(1, Math.ceil(usersTotal / 15))}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                disabled={usersPage <= 1}
                className="px-2.5 py-1 rounded-lg border border-slate-border bg-slate-subtle disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setUsersPage(p => p + 1)}
                disabled={usersPage * 15 >= usersTotal}
                className="px-2.5 py-1 rounded-lg border border-slate-border bg-slate-subtle disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. POSTS MANAGEMENT                                                  */}
      {/* ==================================================================== */}
      {activeTab === 'posts' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Discussion Feed Moderation ({postsTotal})
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={postsStatusFilter}
                onChange={(e) => { setPostsStatusFilter(e.target.value); setPostsPage(1); }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-border bg-slate-subtle"
              >
                <option value="active">Active Posts</option>
                <option value="deleted">Soft-Deleted Posts</option>
                <option value="all">All Posts</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-meta" />
            <input
              type="text"
              value={postsQuery}
              onChange={(e) => { setPostsQuery(e.target.value); setPostsPage(1); }}
              placeholder="Search posts by headline, content, topic tag, or author..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-border bg-slate-subtle/50 text-slate-headline focus:outline-none"
            />
          </div>

          <div className="space-y-2.5">
            {posts.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-meta">No posts matching filters.</p>
            ) : (
              posts.map((p) => (
                <div key={p.id} className="p-3.5 rounded-xl border border-slate-border bg-slate-subtle/30 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-headline">{p.author_name}</span>
                        <span className="text-[11px] font-mono text-slate-meta">({p.anonymous_pseudonym})</span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold">
                          #{p.tag}
                        </span>
                        {p.deleted_at && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 uppercase">
                            Soft Deleted ({p.deletion_reason || 'Policy Violation'})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-body mt-1 line-clamp-3">{p.content}</p>
                      {p.image_url && (
                        <div className="mt-1.5">
                          <img src={p.image_url} alt="Attached" className="h-16 w-auto rounded-lg object-cover border border-slate-border" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {p.deleted_at ? (
                        <button
                          onClick={() => setConfirmDialog({
                            type: 'RESTORE_POST',
                            id: p.id,
                            title: 'Restore Post to Feed?',
                            description: 'This will restore the post so it is visible to students in the feed.',
                            payload: {}
                          })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDialog({
                            type: 'DELETE_POST',
                            id: p.id,
                            title: 'Soft-Delete Post?',
                            description: 'The post will be removed from student view. You can restore it later.',
                            payload: { reason: 'Admin moderation violation' }
                          })}
                          className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-meta pt-1 border-t border-slate-border/50">
                    <span>{p.likes_count} likes · {p.comments_count} comments · {p.reports_count} reports</span>
                    <span>{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. CONFESSIONS MANAGEMENT                                            */}
      {/* ==================================================================== */}
      {activeTab === 'confessions' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Anonymous Confessions Moderation ({confessionsTotal})
            </h2>
            <select
              value={confessionsStatusFilter}
              onChange={(e) => { setConfessionsStatusFilter(e.target.value); setConfessionsPage(1); }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-border bg-slate-subtle"
            >
              <option value="active">Active Confessions</option>
              <option value="deleted">Deleted Confessions</option>
            </select>
          </div>

          <div className="space-y-2.5">
            {confessions.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-meta">No confessions found.</p>
            ) : (
              confessions.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl border border-slate-border bg-slate-subtle/30 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                          {c.anonymous_pseudonym}
                        </span>
                        <span className="text-[11px] text-slate-meta">
                          Real Author: <strong>{c.author_name}</strong> ({c.author_email})
                        </span>
                        {c.deleted_at && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 uppercase">
                            Deleted
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-body mt-1 italic">"{c.content}"</p>
                    </div>

                    <div className="shrink-0">
                      {c.deleted_at ? (
                        <button
                          onClick={() => setConfirmDialog({
                            type: 'RESTORE_CONFESSION',
                            id: c.id,
                            title: 'Restore Confession?',
                            description: 'Reinstate confession to student feed.',
                            payload: {}
                          })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDialog({
                            type: 'DELETE_CONFESSION',
                            id: c.id,
                            title: 'Remove Confession?',
                            description: 'Will be deleted from anonymous feed with reason logged.',
                            payload: { reason: 'Anonymous harassment policy' }
                          })}
                          className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. COMMENTS MANAGEMENT                                               */}
      {/* ==================================================================== */}
      {activeTab === 'comments' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Comments Governance ({commentsTotal})
            </h2>
            <select
              value={commentsStatusFilter}
              onChange={(e) => { setCommentsStatusFilter(e.target.value); setCommentsPage(1); }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-border bg-slate-subtle"
            >
              <option value="active">Active Comments</option>
              <option value="deleted">Deleted Comments</option>
            </select>
          </div>

          <div className="space-y-2">
            {comments.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-meta">No comments recorded.</p>
            ) : (
              comments.map((cm) => (
                <div key={cm.id} className="p-3 rounded-xl border border-slate-border bg-slate-subtle/30 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-headline flex items-center gap-2">
                      <span>{cm.author_name} ({cm.author_email})</span>
                      {cm.is_anonymous && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                          Anon: {cm.anonymous_pseudonym}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-body mt-1">"{cm.content}"</p>
                  </div>
                  <div className="shrink-0">
                    {cm.deleted_at ? (
                      <button
                        onClick={() => setConfirmDialog({
                          type: 'RESTORE_COMMENT',
                          id: cm.id,
                          title: 'Restore Comment?',
                          description: 'Comment will be reinstated on the thread.',
                          payload: {}
                        })}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDialog({
                          type: 'DELETE_COMMENT',
                          id: cm.id,
                          title: 'Delete Comment?',
                          description: 'Comment will be soft-deleted and counters adjusted.',
                          payload: { reason: 'Abusive language' }
                        })}
                        className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 text-[10px] font-bold"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. EVENTS MANAGEMENT                                                 */}
      {/* ==================================================================== */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
                Collegiate Events Management ({events.length})
              </h2>
              <p className="text-xs text-slate-meta">Manage workshops, hackathons, and university gatherings</p>
            </div>
            <button
              onClick={() => setIsEventModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create Event</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {events.map((ev) => (
              <div key={ev.id} className="p-3.5 rounded-xl border border-slate-border bg-slate-subtle/30 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">
                      {ev.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-headline mt-1">{ev.title}</h3>
                  </div>
                  <button
                    onClick={() => setConfirmDialog({
                      type: 'DELETE_EVENT',
                      id: ev.id,
                      title: `Delete event "${ev.title}"?`,
                      description: 'The event will be cancelled and removed from the student calendar.',
                      payload: { reason: 'Cancelled event' }
                    })}
                    className="p-1 rounded text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-body line-clamp-2">{ev.description}</p>
                <div className="text-[11px] text-slate-meta space-y-0.5">
                  <div>📍 {ev.location}</div>
                  <div>🗓️ {new Date(ev.event_date).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. REPORTS / MODERATION CENTER                                       */}
      {/* ==================================================================== */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Student Incident Reports Queue ({reportsTotal})
            </h2>
            <select
              value={reportsStatusFilter}
              onChange={(e) => { setReportsStatusFilter(e.target.value); setReportsPage(1); }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-border bg-slate-subtle font-semibold"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="py-12 text-center text-slate-meta">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-headline">Queue is Clear</p>
                <p className="text-xs">No active incident reports requiring moderation.</p>
              </div>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="p-3.5 rounded-xl border border-slate-border bg-slate-subtle/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase">
                        {r.target_type}
                      </span>
                      <span className="text-xs font-bold text-slate-headline">{r.reason}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {r.status}
                    </span>
                  </div>

                  {r.details && (
                    <p className="text-xs text-slate-body bg-white p-2.5 rounded-lg border border-slate-border">
                      "{r.details}"
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-meta">
                    <span>
                      Reported by: <strong>{r.reporter_name || r.reporter_pseudonym || 'Student'}</strong>
                    </span>

                    {r.status === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setResolvingReport(r);
                            setResolutionText('');
                            setDeleteReportedContent(false);
                          }}
                          className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition"
                        >
                          Resolve Report
                        </button>
                        <button
                          onClick={() => handleDismissReport(r.id)}
                          className="px-3 py-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] transition"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. IMMUTABLE ADMIN AUDIT LOG                                         */}
      {/* ==================================================================== */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-headline uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Immutable Administrative Audit Trail
            </h2>
            <p className="text-xs text-slate-meta">
              Append-only ledger of all administrator actions, moderation decisions, and identity viewings.
            </p>
          </div>

          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-meta">No audit entries found.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-slate-border bg-slate-subtle/50 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[10px] uppercase bg-slate-200 px-2 py-0.5 rounded text-slate-headline">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-slate-meta">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-body text-[11px]">
                    Actor: <span className="font-semibold text-slate-headline">{log.admin_name || 'Administrator'}</span> ({log.admin_email})
                    <span className="ml-2 font-mono text-[10px] text-slate-meta">IP: {log.ip_address || '127.0.0.1'}</span>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="text-[10px] bg-white p-1.5 rounded border border-slate-border font-mono text-slate-meta overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 9. USER BEHAVIOR ANALYTICS & TIME SPENT ENGINE                       */}
      {/* ==================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {analyticsOverview?.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                <span className="text-xs text-slate-meta font-medium block">Total Page Views</span>
                <span className="text-xl font-black text-slate-headline">{analyticsOverview.metrics.totalPageViews}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                <span className="text-xs text-slate-meta font-medium block">Unique Visitors</span>
                <span className="text-xl font-black text-indigo-600">{analyticsOverview.metrics.uniqueVisitors}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                <span className="text-xs text-slate-meta font-medium block">Total Active Time</span>
                <span className="text-xl font-black text-emerald-600">{analyticsOverview.metrics.totalActiveMinutes} mins</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border shadow-soft-card">
                <span className="text-xs text-slate-meta font-medium block">Avg Time / Page</span>
                <span className="text-xl font-black text-amber-600">{analyticsOverview.metrics.avgActiveSecondsPerPage}s</span>
              </div>
            </div>
          )}

          {/* Top Pages Ranked by Active Duration */}
          <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-3">
            <h3 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Most Visited Application Pages & Active Time Spent
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-subtle text-slate-meta font-bold uppercase border-y border-slate-border">
                  <tr>
                    <th className="py-2.5 px-3">Page Name</th>
                    <th className="py-2.5 px-3">Total Views</th>
                    <th className="py-2.5 px-3">Unique Students</th>
                    <th className="py-2.5 px-3">Avg Active Duration</th>
                    <th className="py-2.5 px-3">Total Active Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-border">
                  {pageAnalytics.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-subtle/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-headline">{p.page}</td>
                      <td className="py-2.5 px-3 font-bold text-indigo-700">{p.views}</td>
                      <td className="py-2.5 px-3 text-slate-meta">{p.unique_users}</td>
                      <td className="py-2.5 px-3 text-slate-body">{p.avg_active_seconds}s</td>
                      <td className="py-2.5 px-3 text-emerald-700 font-semibold">{p.total_active_minutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 10. SECURITY ANALYTICS                                               */}
      {/* ==================================================================== */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          {securityData?.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border">
                <span className="text-xs text-slate-meta block">Successful Logins (30d)</span>
                <span className="text-xl font-black text-emerald-600">{securityData.stats.successfulLogins30d}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border">
                <span className="text-xs text-slate-meta block">Failed Auth Attempts (30d)</span>
                <span className="text-xl font-black text-rose-600">{securityData.stats.failedLogins30d}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border">
                <span className="text-xs text-slate-meta block">Suspended / Banned</span>
                <span className="text-xl font-black text-amber-600">{securityData.stats.suspendedOrBannedUsers}</span>
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-slate-border">
                <span className="text-xs text-slate-meta block">Active Sessions In DB</span>
                <span className="text-xl font-black text-indigo-600">{securityData.stats.activeSessions}</span>
              </div>
            </div>
          )}

          {/* Failed Login Telemetry */}
          <div className="bg-white rounded-2xl border border-slate-border p-4 shadow-soft-card space-y-3">
            <h3 className="text-sm font-bold text-slate-headline uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              Recent Authentication Failures (Zero Password Leakage)
            </h3>
            <div className="space-y-2">
              {securityData?.recentFailures?.map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-slate-border bg-slate-subtle/50 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-mono text-slate-headline font-semibold">{f.email}</span>
                    <span className="text-rose-600 text-[11px] ml-2 font-bold">({f.failure_reason})</span>
                    <div className="text-[10px] text-slate-meta font-mono mt-0.5">IP: {f.ip_address}</div>
                  </div>
                  <span className="text-[11px] text-slate-meta">{new Date(f.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: PRIVILEGED USER DETAIL DRAWER (4 TABS + TIMELINE)           */}
      {/* ==================================================================== */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-border max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-border pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-headline">
                  Collegiate Identity Dossier
                </h3>
                <p className="text-xs text-slate-meta">Authorized Administrator View (Zero credentials exposed)</p>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1 rounded-full text-slate-meta hover:bg-slate-subtle"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex gap-2 border-b border-slate-border text-xs font-bold pb-2">
              <button
                onClick={() => setUserModalTab('identity')}
                className={`px-3 py-1 rounded-lg ${userModalTab === 'identity' ? 'bg-indigo-600 text-white' : 'text-slate-meta'}`}
              >
                1. Identity
              </button>
              <button
                onClick={() => setUserModalTab('account')}
                className={`px-3 py-1 rounded-lg ${userModalTab === 'account' ? 'bg-indigo-600 text-white' : 'text-slate-meta'}`}
              >
                2. Account
              </button>
              <button
                onClick={() => setUserModalTab('activity')}
                className={`px-3 py-1 rounded-lg ${userModalTab === 'activity' ? 'bg-indigo-600 text-white' : 'text-slate-meta'}`}
              >
                3. Activity
              </button>
              <button
                onClick={() => setUserModalTab('security')}
                className={`px-3 py-1 rounded-lg ${userModalTab === 'security' ? 'bg-indigo-600 text-white' : 'text-slate-meta'}`}
              >
                4. Security
              </button>
              <button
                onClick={() => setUserModalTab('timeline')}
                className={`px-3 py-1 rounded-lg ${userModalTab === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-meta'}`}
              >
                5. Activity Timeline
              </button>
            </div>

            {/* TAB: IDENTITY */}
            {userModalTab === 'identity' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-subtle p-3 rounded-xl">
                  <div>
                    <span className="text-slate-meta block font-medium">Real Full Name:</span>
                    <span className="font-bold text-slate-headline text-sm">{selectedUserDetail.identity.fullName}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block font-medium">Sanjivani Email:</span>
                    <span className="font-mono font-bold text-slate-headline">{selectedUserDetail.identity.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block font-medium">Verified Phone:</span>
                    <span className="font-mono text-slate-headline">{selectedUserDetail.identity.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block font-medium">Department / Branch:</span>
                    <span className="font-semibold text-slate-headline">{selectedUserDetail.identity.department || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block font-medium">Public Pseudonym:</span>
                    <span className="font-semibold text-indigo-700">{selectedUserDetail.identity.anonymousPseudonym}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block font-medium">Public Handle:</span>
                    <span className="font-mono text-indigo-700">{selectedUserDetail.identity.handle}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ACCOUNT */}
            {userModalTab === 'account' && (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-subtle p-3 rounded-xl">
                  <div>
                    <span className="text-slate-meta block">Account Status:</span>
                    <span className="font-bold uppercase text-emerald-700">{selectedUserDetail.account.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block">Role:</span>
                    <span className="font-bold uppercase text-indigo-700">{selectedUserDetail.account.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block">Registration Date:</span>
                    <span>{new Date(selectedUserDetail.account.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-meta block">Reputation Karma:</span>
                    <span className="font-bold text-slate-headline">{selectedUserDetail.account.reputationScore}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ACTIVITY */}
            {userModalTab === 'activity' && (
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="p-3 bg-slate-subtle rounded-xl">
                  <span className="text-lg font-bold text-slate-headline block">{selectedUserDetail.activity.postsCount}</span>
                  <span className="text-slate-meta text-[11px]">Posts</span>
                </div>
                <div className="p-3 bg-slate-subtle rounded-xl">
                  <span className="text-lg font-bold text-slate-headline block">{selectedUserDetail.activity.confessionsCount}</span>
                  <span className="text-slate-meta text-[11px]">Confessions</span>
                </div>
                <div className="p-3 bg-slate-subtle rounded-xl">
                  <span className="text-lg font-bold text-slate-headline block">{selectedUserDetail.activity.commentsCount}</span>
                  <span className="text-slate-meta text-[11px]">Comments</span>
                </div>
                <div className="p-3 bg-slate-subtle rounded-xl">
                  <span className="text-lg font-bold text-slate-headline block">{selectedUserDetail.activity.likesCount}</span>
                  <span className="text-slate-meta text-[11px]">Likes Given</span>
                </div>
                <div className="p-3 bg-slate-subtle rounded-xl">
                  <span className="text-lg font-bold text-slate-headline block">{selectedUserDetail.activity.followersCount}</span>
                  <span className="text-slate-meta text-[11px]">Followers</span>
                </div>
                <div className="p-3 bg-slate-subtle rounded-xl">
                  <span className="text-lg font-bold text-amber-600 block">{selectedUserDetail.activity.reportsAgainstCount}</span>
                  <span className="text-slate-meta text-[11px]">Reports Involving</span>
                </div>
              </div>
            )}

            {/* TAB: SECURITY */}
            {userModalTab === 'security' && (
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-headline block">Recent Authentication Events:</span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {selectedUserDetail.security?.recentLogins?.map((l, i) => (
                    <div key={i} className="p-2 rounded bg-slate-subtle flex items-center justify-between text-[11px]">
                      <span>Status: <strong className={l.status === 'SUCCESS' ? 'text-emerald-700' : 'text-rose-700'}>{l.status}</strong></span>
                      <span className="font-mono text-slate-meta">IP: {l.ip_address}</span>
                      <span className="text-slate-meta">{new Date(l.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: TIMELINE */}
            {userModalTab === 'timeline' && (
              <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                {userTimeline.length === 0 ? (
                  <p className="py-4 text-center text-slate-meta">No activity recorded for this user yet.</p>
                ) : (
                  userTimeline.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-slate-subtle/60 text-[11px]">
                      <span className="font-bold text-indigo-700">{item.event_type}</span>
                      <span className="text-slate-meta">Page: {item.page || 'app'}</span>
                      <span className="ml-auto text-slate-meta">{new Date(item.created_at).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CONTROLLED USER EDIT (EXPLICIT ALLOWED FIELDS)              */}
      {/* ==================================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <form onSubmit={handleSaveUserEdit} className="bg-white rounded-3xl border border-slate-border max-w-md w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Controlled Student Information Update
            </h3>
            <p className="text-xs text-slate-meta">Every change is audited with target ID and changed fields.</p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="font-semibold text-slate-meta block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-meta block mb-1">Department</label>
                <input
                  type="text"
                  value={editingUser.department}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-meta block mb-1">Graduation Year</label>
                <input
                  type="number"
                  value={editingUser.graduationYear}
                  onChange={(e) => setEditingUser({ ...editingUser, graduationYear: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-meta block mb-1">Bio</label>
                <textarea
                  value={editingUser.bio}
                  onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-meta block mb-1">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  >
                    <option value="student">Student</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-meta block mb-1">Status</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-border">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === editingUser.id}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Save & Audit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: CREATE CAMPUS EVENT                                         */}
      {/* ==================================================================== */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <form onSubmit={handleCreateEvent} className="bg-white rounded-3xl border border-slate-border max-w-md w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Publish Collegiate Event
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <label className="font-semibold text-slate-meta block mb-1">Event Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g. Annual Sanjivani Hackathon 2026"
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-meta block mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event details, guidelines, and schedule..."
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-meta block mb-1">Category</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  >
                    <option value="Campus Life">Campus Life</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Sports">Sports</option>
                    <option value="Cultural">Cultural</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-meta block mb-1">Location / Venue</label>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="e.g. Auditorium Hall B"
                    className="w-full p-2 rounded-lg border border-slate-border text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-meta block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={newEvent.event_date}
                  onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-border">
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'create-event'}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Publish Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: RESOLVE REPORT WITH OPTIONAL CONTENT ACTION                 */}
      {/* ==================================================================== */}
      {resolvingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl border border-slate-border max-w-md w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-headline uppercase tracking-wider">
              Resolve Incident Report
            </h3>
            <p className="text-xs text-slate-meta">
              Target: <strong className="text-indigo-600">{resolvingReport.target_type}</strong> · Reason: {resolvingReport.reason}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-meta block mb-1">Resolution Summary</label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Describe resolution taken..."
                  className="w-full p-2 rounded-lg border border-slate-border text-xs"
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-subtle p-2.5 rounded-xl border border-slate-border">
                <input
                  type="checkbox"
                  checked={deleteReportedContent}
                  onChange={(e) => setDeleteReportedContent(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="font-semibold text-slate-headline">
                  Also soft-delete reported {resolvingReport.target_type} from application
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-border">
              <button
                onClick={() => setResolvingReport(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveReport}
                disabled={actionLoading === resolvingReport.id}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: DANGEROUS ACTION CONFIRMATION DIALOG                        */}
      {/* ==================================================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl border border-slate-border max-w-sm w-full p-5 space-y-3 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-headline">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-body leading-relaxed">{confirmDialog.description}</p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-border">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-border text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteConfirmedAction}
                disabled={actionLoading !== null}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
