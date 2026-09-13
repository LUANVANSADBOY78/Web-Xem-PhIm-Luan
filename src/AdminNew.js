import React, { useContext, useState } from 'react';
import { Context } from './App';
import { api } from './api';

export function ServersManager({ data, load, patch }) {
  const { notify } = useContext(Context);
  const [editing, setEditing] = useState(null);
  const servers = data?.videoServers || [];

  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      name: form.name.value.trim(),
      priority: Number(form.priority.value || 1),
      status: form.status.value,
      is_default: form.is_default.checked
    };
    try {
      if (editing?.id) {
        await patch('videoServers', editing.id, body);
      } else {
        await api('/admin/videoServers', 'POST', body);
      }
      setEditing(null);
      form.reset();
      await load();
      notify('Đã lưu máy chủ video.');
    } catch (err) {
      notify(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Bạn có chắc muốn xóa máy chủ này?')) return;
    try {
      await api('/admin/videoServers/' + id, 'DELETE');
      await load();
      notify('Đã xóa máy chủ.');
    } catch (err) {
      notify(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Quản lý Máy chủ Video (Video Servers)</h2>
        <button className="primary-button" onClick={() => setEditing({})}>＋ Thêm Server</button>
      </div>
      <p className="muted">Quản lý các nguồn phát và cụm máy chủ dự phòng cho phim.</p>

      {editing && (
        <form className="panel" onSubmit={save} style={{ background: '#192638', margin: '16px 0' }}>
          <h3>{editing.id ? 'Sửa Server' : 'Thêm Server mới'}</h3>
          <div className="form-grid">
            <label>Tên Server<input name="name" defaultValue={editing.name || ''} required placeholder="Ví dụ: Server VIP Fast" /></label>
            <label>Thứ tự ưu tiên<input type="number" name="priority" defaultValue={editing.priority || 1} min="1" max="99" /></label>
            <label>Trạng thái
              <select name="status" defaultValue={editing.status || 'online'}>
                <option value="online">🟢 ONLINE (Hoạt động)</option>
                <option value="offline">🔴 OFFLINE (Tạm dừng)</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
              <input type="checkbox" name="is_default" defaultChecked={editing.is_default || false} />
              Đặt làm server mặc định
            </label>
          </div>
          <div style={{ marginTop: '12px' }}>
            <button className="primary-button" type="submit">Lưu</button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tên Server</th>
              <th>Độ ưu tiên</th>
              <th>Trạng thái</th>
              <th>Mặc định</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {servers.map(s => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.priority}</td>
                <td>
                  <span style={{ color: s.status === 'online' ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                    {s.status === 'online' ? '● ONLINE' : '○ OFFLINE'}
                  </span>
                </td>
                <td>{s.is_default ? '★ Mặc định' : '—'}</td>
                <td>
                  <button onClick={() => setEditing(s)}>Sửa</button>
                  <button onClick={() => remove(s.id)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!servers.length && <tr><td colSpan="5">Chưa có máy chủ nào được thêm.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ActorsManager({ data, load, patch }) {
  const { notify } = useContext(Context);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const actors = (data?.actors || []).filter(a => !a.deleted && (a.name || '').toLowerCase().includes(search.toLowerCase()));

  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      name: form.name.value.trim(),
      avatar: form.avatar.value.trim(),
      nationality: form.nationality.value.trim(),
      bio: form.bio.value.trim()
    };
    try {
      if (editing?.id) {
        await patch('actors', editing.id, body);
      } else {
        await api('/admin/actors', 'POST', body);
      }
      setEditing(null);
      form.reset();
      await load();
      notify('Đã lưu thông tin diễn viên.');
    } catch (err) {
      notify(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Xác nhận xóa diễn viên này?')) return;
    try {
      await api('/admin/actors/' + id, 'DELETE');
      await load();
      notify('Đã xóa diễn viên.');
    } catch (err) {
      notify(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Quản lý Diễn viên ({actors.length})</h2>
        <button className="primary-button" onClick={() => setEditing({})}>＋ Thêm Diễn viên</button>
      </div>
      <input className="admin-search" placeholder="Tìm kiếm tên diễn viên..." value={search} onChange={e => setSearch(e.target.value)} />

      {editing && (
        <form className="panel" onSubmit={save} style={{ background: '#192638', margin: '16px 0' }}>
          <h3>{editing.id ? 'Sửa thông tin diễn viên' : 'Thêm Diễn viên mới'}</h3>
          <div className="form-grid">
            <label>Tên diễn viên<input name="name" defaultValue={editing.name || ''} required /></label>
            <label>Quốc gia<input name="nationality" defaultValue={editing.nationality || ''} placeholder="Ví dụ: Hàn Quốc, Trung Quốc..." /></label>
            <label>Ảnh đại diện (URL)<input name="avatar" defaultValue={editing.avatar || ''} placeholder="https://..." /></label>
          </div>
          <label>Tiểu sử<textarea name="bio" rows="3" defaultValue={editing.bio || ''} placeholder="Tiểu sử tóm tắt..." /></label>
          <div>
            <button className="primary-button" type="submit">Lưu</button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên Diễn viên</th>
              <th>Quốc gia</th>
              <th>Tiểu sử</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {actors.map(a => (
              <tr key={a.id}>
                <td>
                  <img src={a.avatar || '/poster-fallback.svg'} alt={a.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} onError={e => { e.currentTarget.src = '/poster-fallback.svg'; }} />
                </td>
                <td><strong>{a.name}</strong></td>
                <td>{a.nationality || '—'}</td>
                <td><small className="muted">{a.bio ? (a.bio.slice(0, 60) + '...') : '—'}</small></td>
                <td>
                  <button onClick={() => setEditing(a)}>Sửa</button>
                  <button onClick={() => remove(a.id)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!actors.length && <tr><td colSpan="5">Chưa có thông tin diễn viên.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DirectorsManager({ data, load, patch }) {
  const { notify } = useContext(Context);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const directors = (data?.directors || []).filter(d => !d.deleted && (d.name || '').toLowerCase().includes(search.toLowerCase()));

  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      name: form.name.value.trim(),
      avatar: form.avatar.value.trim(),
      bio: form.bio.value.trim()
    };
    try {
      if (editing?.id) {
        await patch('directors', editing.id, body);
      } else {
        await api('/admin/directors', 'POST', body);
      }
      setEditing(null);
      form.reset();
      await load();
      notify('Đã lưu thông tin đạo diễn.');
    } catch (err) {
      notify(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Xác nhận xóa đạo diễn này?')) return;
    try {
      await api('/admin/directors/' + id, 'DELETE');
      await load();
      notify('Đã xóa đạo diễn.');
    } catch (err) {
      notify(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Quản lý Đạo diễn ({directors.length})</h2>
        <button className="primary-button" onClick={() => setEditing({})}>＋ Thêm Đạo diễn</button>
      </div>
      <input className="admin-search" placeholder="Tìm kiếm tên đạo diễn..." value={search} onChange={e => setSearch(e.target.value)} />

      {editing && (
        <form className="panel" onSubmit={save} style={{ background: '#192638', margin: '16px 0' }}>
          <h3>{editing.id ? 'Sửa thông tin đạo diễn' : 'Thêm Đạo diễn mới'}</h3>
          <div className="form-grid">
            <label>Tên đạo diễn<input name="name" defaultValue={editing.name || ''} required /></label>
            <label>Ảnh đại diện (URL)<input name="avatar" defaultValue={editing.avatar || ''} placeholder="https://..." /></label>
          </div>
          <label>Tiểu sử<textarea name="bio" rows="3" defaultValue={editing.bio || ''} placeholder="Tiểu sử..." /></label>
          <div>
            <button className="primary-button" type="submit">Lưu</button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên Đạo diễn</th>
              <th>Tiểu sử</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {directors.map(d => (
              <tr key={d.id}>
                <td>
                  <img src={d.avatar || '/poster-fallback.svg'} alt={d.name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} onError={e => { e.currentTarget.src = '/poster-fallback.svg'; }} />
                </td>
                <td><strong>{d.name}</strong></td>
                <td><small className="muted">{d.bio ? (d.bio.slice(0, 60) + '...') : '—'}</small></td>
                <td>
                  <button onClick={() => setEditing(d)}>Sửa</button>
                  <button onClick={() => remove(d.id)}>Xóa</button>
                </td>
              </tr>
            ))}
            {!directors.length && <tr><td colSpan="4">Chưa có thông tin đạo diễn.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrendingManager({ data, patch }) {
  const [search, setSearch] = useState('');
  const movies = (data?.movies || []).filter(m => !m.deleted && (m.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Quản lý Phim HOT & Nổi bật</h2>
      </div>
      <p className="muted">Ghim phim vào danh sách Phim HOT, Phim Đề cử, Top Tuần, Đánh giá cao.</p>
      <input className="admin-search" placeholder="Tìm tên phim cần ghim HOT..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tên Phim</th>
              <th>🔥 Phim HOT</th>
              <th>🌟 Đề cử</th>
              <th>🎬 Chiếu rạp</th>
              <th>🏆 Top Tuần</th>
              <th>★ Đánh giá cao</th>
            </tr>
          </thead>
          <tbody>
            {movies.slice(0, 30).map(m => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong><small className="admin-subtext">{m.origin_name}</small></td>
                <td><input type="checkbox" checked={!!m.is_hot} onChange={e => patch('movies', m.id, { is_hot: e.target.checked })} /></td>
                <td><input type="checkbox" checked={!!m.is_recommended} onChange={e => patch('movies', m.id, { is_recommended: e.target.checked })} /></td>
                <td><input type="checkbox" checked={!!m.is_shown_in_theater} onChange={e => patch('movies', m.id, { is_shown_in_theater: e.target.checked })} /></td>
                <td><input type="checkbox" checked={!!m.homepage_top} onChange={e => patch('movies', m.id, { homepage_top: e.target.checked })} /></td>
                <td><input type="checkbox" checked={!!m.homepage_rated} onChange={e => patch('movies', m.id, { homepage_rated: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ScheduleManager({ data, load, patch }) {
  const { notify } = useContext(Context);
  const [editing, setEditing] = useState(null);
  const schedule = data?.schedule || [];
  const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      day: form.day.value,
      time: form.time.value,
      movie_slug: form.movie_slug.value,
      episode_name: form.episode_name.value,
      note: form.note.value
    };
    try {
      if (editing?.id) {
        await patch('schedule', editing.id, body);
      } else {
        await api('/admin/schedule', 'POST', body);
      }
      setEditing(null);
      form.reset();
      await load();
      notify('Đã lưu lịch phát hành.');
    } catch (err) {
      notify(err.message);
    }
  }

  async function remove(id) {
    if (!window.confirm('Xác nhận xóa lịch này?')) return;
    try {
      await api('/admin/schedule/' + id, 'DELETE');
      await load();
      notify('Đã xóa lịch phát hành.');
    } catch (err) {
      notify(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Lịch Phát Hành Phim Theo Tuần</h2>
        <button className="primary-button" onClick={() => setEditing({})}>＋ Thêm Lịch</button>
      </div>
      <p className="muted">Lịch chiếu phim cố định trong tuần để người xem tiện theo dõi tập mới.</p>

      {editing && (
        <form className="panel" onSubmit={save} style={{ background: '#192638', margin: '16px 0' }}>
          <h3>{editing.id ? 'Sửa Lịch' : 'Thêm Lịch phát sóng'}</h3>
          <div className="form-grid">
            <label>Ngày trong tuần
              <select name="day" defaultValue={editing.day || 'Thứ 2'}>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>Giờ phát sóng<input name="time" defaultValue={editing.time || '20:00'} placeholder="20:00" /></label>
            <label>Chọn phim
              <select name="movie_slug" defaultValue={editing.movie_slug || ''}>
                {(data?.movies || []).filter(m => !m.deleted).map(m => (
                  <option key={m.slug} value={m.slug}>{m.name}</option>
                ))}
              </select>
            </label>
            <label>Tập dự kiến<input name="episode_name" defaultValue={editing.episode_name || ''} placeholder="Ví dụ: Tập 12" /></label>
          </div>
          <label>Ghi chú<input name="note" defaultValue={editing.note || ''} placeholder="Vietsub phát sớm lúc 20h..." /></label>
          <div>
            <button className="primary-button" type="submit">Lưu</button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
        {days.map(d => {
          const items = schedule.filter(s => s.day === d);
          return (
            <div key={d} className="panel" style={{ background: '#101a28' }}>
              <h3 style={{ color: '#f98a27', borderBottom: '1px solid #253044', paddingBottom: '8px' }}>{d}</h3>
              {items.map(s => {
                const movie = (data?.movies || []).find(m => m.slug === s.movie_slug);
                return (
                  <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid #1a273a' }}>
                    <div style={{ fontWeight: 'bold' }}>{movie?.name || s.movie_slug}</div>
                    <small style={{ color: '#a9b6ca' }}>🕒 {s.time} · {s.episode_name}</small>
                    <div style={{ marginTop: '4px' }}>
                      <button style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setEditing(s)}>Sửa</button>
                      <button style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => remove(s.id)}>Xóa</button>
                    </div>
                  </div>
                );
              })}
              {!items.length && <p className="muted" style={{ fontSize: '12px' }}>Không có lịch</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RolesManager({ data, patch }) {
  const roles = [
    { name: 'Super Admin', desc: 'Toàn quyền kiểm soát hệ thống, quản lý tài khoản, cài đặt và bảo mật.', perms: ['Toàn quyền'] },
    { name: 'Content Manager', desc: 'Thêm/sửa phim, quản lý tập phim, thể loại, quốc gia, diễn viên, banner.', perms: ['Phim', 'Tập', 'Thể loại', 'Quốc gia', 'Banner'] },
    { name: 'Moderator', desc: 'Kiểm duyệt bình luận, đánh giá, xử lý báo cáo từ người dùng.', perms: ['Bình luận', 'Đánh giá', 'Báo cáo'] },
    { name: 'Editor', desc: 'Chỉnh sửa thông tin phim, viết mô tả, cập nhật tập mới (không được xóa phim).', perms: ['Phim (Sửa)', 'Tập'] }
  ];

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Phân Quyền & Vai Trò Hệ Thống</h2>
      </div>
      <p className="muted">Cấu hình các quyền hạn áp dụng cho tài khoản quản trị.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
        {roles.map(r => (
          <div key={r.name} className="panel" style={{ background: '#101a28' }}>
            <h3 style={{ color: '#ff9c49' }}>🛡 {r.name}</h3>
            <p style={{ fontSize: '13px', color: '#c5d2e5' }}>{r.desc}</p>
            <div style={{ marginTop: '12px' }}>
              <small className="muted">Quyền được cấp:</small>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {r.perms.map(p => (
                  <span key={p} style={{ background: '#253044', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' }}>✓ {p}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivityLogs({ data, load }) {
  const logs = data?.activity_logs || [];

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Nhật Ký Hoạt Động Admin (Activity Logs)</h2>
        <button onClick={load}>🔄 Làm mới</button>
      </div>
      <p className="muted">Theo dõi các thay đổi dữ liệu, hành động cập nhật của các tài khoản quản trị.</p>

      <div className="table-scroll" style={{ marginTop: '16px' }}>
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người thực hiện</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td><small>{new Date(log.time).toLocaleString('vi-VN')}</small></td>
                <td><strong>{log.user}</strong></td>
                <td>{log.action}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan="3">Chưa có nhật ký hoạt động được ghi lại.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function MaintenanceManager({ data, load }) {
  const { notify } = useContext(Context);
  const settings = data?.settings || {};
  const [maintenance, setMaintenance] = useState(!!settings.maintenance_mode);
  const [message, setMessage] = useState(settings.maintenance_message || 'Website đang bảo trì nâng cấp. Chúng tôi sẽ trở lại sớm!');

  async function save(e) {
    e.preventDefault();
    try {
      await api('/admin/settings', 'PUT', {
        ...settings,
        maintenance_mode: maintenance,
        maintenance_message: message
      });
      await load();
      notify('Đã cập nhật trạng thái bảo trì.');
    } catch (err) {
      notify(err.message);
    }
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Chế độ Bảo Trì (Maintenance Mode)</h2>
      </div>
      <p className="muted">Khi bật chế độ bảo trì, người dùng thông thường sẽ thấy thông báo bảo trì. Chỉ Admin đăng nhập mới xem được toàn bộ website.</p>

      <form onSubmit={save} style={{ maxWidth: '600px', marginTop: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
          <input type="checkbox" checked={maintenance} onChange={e => setMaintenance(e.target.checked)} />
          <strong>Bật chế độ bảo trì hệ thống</strong>
        </label>

        <label style={{ marginTop: '16px' }}>
          Thông điệp hiển thị cho người xem:
          <textarea rows="4" value={message} onChange={e => setMessage(e.target.value)} />
        </label>

        <div style={{ marginTop: '16px' }}>
          <button className="primary-button" type="submit">Lưu cấu hình</button>
        </div>
      </form>
    </section>
  );
}
