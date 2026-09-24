import React from 'react';
import { Bell, CheckCheck, BookOpen, Heart, Calendar, Users, ArrowRight } from 'lucide-react';

export default function NotificationsView({
  notifications = [],
  onMarkAllRead,
  onSelectNotification
}) {
  const getIcon = (type) => {
    switch (type) {
      case 'academic':
        return (
          <div className="w-9 h-9 rounded-full bg-red-100 text-tertiary flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
        );
      case 'social':
        return (
          <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4" />
          </div>
        );
      case 'event':
        return (
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-secondary flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-primary flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col pb-24 lg:pb-8 w-full max-w-[740px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border border-slate-border rounded-2xl shadow-soft-card">
        <div>
          <h2 className="text-[17px] font-bold text-slate-headline">Notifications & Alerts</h2>
          <p className="text-[12px] text-slate-meta">Stay synced with course updates and campus buzz</p>
        </div>
        <button
          onClick={onMarkAllRead}
          className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark Read</span>
        </button>
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-border p-6">
          <Bell className="w-8 h-8 text-slate-meta mx-auto mb-2" />
          <p className="text-[14px] font-bold text-slate-headline">No notifications yet</p>
          <p className="text-[12px] text-slate-meta mt-1">You're completely caught up with campus radar!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => onSelectNotification(notif)}
              className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 relative ${
                notif.unread
                  ? 'bg-white border-primary/30 shadow-sm'
                  : 'bg-white/60 border-slate-border hover:bg-white'
              }`}
            >
              {getIcon(notif.type)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h4 className="text-[13px] font-bold text-slate-headline truncate">
                    {notif.title}
                  </h4>
                  <span className="text-[11px] text-slate-meta shrink-0">{notif.timestamp}</span>
                </div>
                <p className="text-[12px] text-slate-body leading-relaxed line-clamp-2">
                  {notif.message}
                </p>
              </div>

              {/* Unread indicator dot */}
              {notif.unread && (
                <span className="w-2 h-2 rounded-full bg-tertiary shrink-0 mt-1.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
