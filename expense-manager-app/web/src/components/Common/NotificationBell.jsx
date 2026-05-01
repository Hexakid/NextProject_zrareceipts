import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const [notifRes, countRes] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.unreadCount()
      ]);
      setNotifications(notifRes.data);
      setUnread(countRes.data.count);
    } catch {}
  };

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => { setOpen(!open); if (!open) load(); };

  const markRead = async (id) => {
    await notificationsApi.markRead(id).catch(() => {});
    load();
  };

  const typeColors = {
    approval_approved: 'bg-green-100 text-green-700',
    approval_rejected: 'bg-red-100 text-red-700',
    approval_request: 'bg-blue-100 text-blue-700',
    budget_alert: 'bg-yellow-100 text-yellow-700',
    recurring_due: 'bg-purple-100 text-purple-700'
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => notificationsApi.markAllRead().then(load)}
                className="text-xs text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">No notifications</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${!n.isRead ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 shrink-0 ${typeColors[n.type] || 'bg-gray-100 text-gray-600'}`}>
                      {n.type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
