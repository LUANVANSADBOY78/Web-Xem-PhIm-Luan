import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Context } from './App';
import { api } from './api';

export function NotificationBell() {
  const { user, notificationItems = [] } = useContext(Context);
  if (!user) return null;
  const unread = notificationItems.filter(n => !n.read).length;
  return <Link className="notification-bell" aria-label={'Thông báo: ' + unread + ' chưa đọc'} to="/thong-bao">♧{unread > 0 && <b>{unread}</b>}</Link>;
}
export default function Notifications() {
  const { user, setUser, notificationItems = [], loadNotifications, notify } = useContext(Context);
  const [prefs, setPrefs] = useState(user?.notificationPreferences || { newMovies: true, newEpisodes: true });
  useEffect(() => { if (user) loadNotifications(); }, [user?.id, loadNotifications]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return <main className="page container"><h1>Thông báo</h1><Link to="/dang-nhap">Đăng nhập để nhận thông báo.</Link></main>;
  async function mark(id) { try { await api('/notifications/read', 'POST', id ? { id } : {}); await loadNotifications(); } catch (e) { notify(e.message); } }
  return <main className="container page"><div className="section-heading"><h1>Thông báo</h1><button onClick={() => mark()}>Đánh dấu tất cả đã đọc</button></div><form className="panel" onSubmit={async e => { e.preventDefault(); try { const saved = await api('/notifications/preferences', 'PUT', prefs); setUser({ ...user, notificationPreferences: saved }); notify('Đã lưu tùy chọn thông báo.'); } catch (e) { notify(e.message); } }}><h2>Tùy chọn thông báo trên website</h2><div className="checkboxes">{[['newMovies', 'Khi có phim mới'], ['newEpisodes', 'Khi phim đang theo dõi có tập mới']].map(([key, label]) => <label key={key}><input type="checkbox" checked={prefs[key]} onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} />{label}</label>)}</div><button>Lưu tùy chọn</button></form>{!notificationItems.length && <p className="empty">Chưa có thông báo. Theo dõi phim để nhận cập nhật tập mới.</p>}{notificationItems.map(n => <article key={n.id} className={'panel notification ' + (n.read ? '' : 'unread')}><Link onClick={() => mark(n.id)} to={'/phim/' + n.slug}><h2>{n.title}</h2></Link><time className="muted">{new Date(n.date).toLocaleString('vi-VN')}</time>{!n.read && <button onClick={() => mark(n.id)}>Đã đọc</button>}</article>)}</main>;
}
