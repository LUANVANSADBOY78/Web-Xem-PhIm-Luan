import React, { useContext, useEffect, useState } from 'react';
import { Link, NavLink, Redirect, useLocation, useHistory } from 'react-router-dom';
import { Context } from './App';
import { api, normalize } from './api';
import { Taxonomies, BannerManager } from './AdminExtras';
import { Dashboard, Settings, Homepage, RatingSummary } from './AdminPanels';
import { ServersManager, ActorsManager, DirectorsManager, TrendingManager, ScheduleManager, RolesManager, ActivityLogs, MaintenanceManager } from './AdminNew';
import './Admin.css';

const blank = { name: '', slug: '', origin_name: '', description: '', thumb_url: '', poster_url: '', publish_year: 2026, type: 'single', status: 'ongoing', quality: 'FHD', language: 'Vietsub', episode_total: '1', episode_current: '', episode_time: '', rating_star: '0', view_total: 0, view_week: 0, view_month: 0, categories: [], regions: [], episodes: [], is_recommended: false, is_shown_in_theater: false };
const slugify = text => normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function MovieEditor({ movie, close, done }) {
  const { notify } = useContext(Context);
  const [value, setValue] = useState(JSON.parse(JSON.stringify(movie)));
  const [busy, setBusy] = useState(false);
  const [taxonomyText, setTaxonomyText] = useState({ categories: movie.categories.map(c => c.name).join(', '), regions: movie.regions.map(c => c.name).join(', ') });
  const update = (key, val) => setValue(v => ({ ...v, [key]: val }));
  function imageUpload(event, field) {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2000000) { notify('Chọn ảnh JPG, PNG hoặc WebP dưới 2 MB.'); return; }
    const reader = new FileReader(); reader.onload = () => update(field, reader.result); reader.readAsDataURL(file);
  }
  function moveEpisode(index, direction) { const episodes = [...value.episodes]; const target = index + direction; if (target < 0 || target >= episodes.length) return; [episodes[index], episodes[target]] = [episodes[target], episodes[index]]; update('episodes', episodes); }
  async function save(e) {
    e.preventDefault(); setBusy(true);
    const payload = { ...value, episodes: value.episodes.map((ep, order) => ({ ...ep, order, ...(ep.subtitle_url !== undefined ? { subtitles: ep.subtitle_url ? [{ lang: 'vi', label: 'Tiếng Việt', url: ep.subtitle_url }] : [] } : {}) })) };
    for (const key of ['categories', 'regions']) payload[key] = taxonomyText[key].split(',').map(name => name.trim()).filter(Boolean).map(name => ({ name, slug: slugify(name) }));
    try { await api('/admin/movies', 'POST', payload); await done(); notify('Đã lưu phim.'); close(); } catch (e) { notify(e.message); } finally { setBusy(false); }
  }
  return <section className="panel movie-editor"><div className="section-heading"><h2>{movie.id ? 'Sửa phim' : 'Thêm phim'}</h2><button onClick={close}>Đóng</button></div><form onSubmit={save}><div className="form-grid">{[['name', 'Tên phim'], ['slug', 'Slug URL (không dấu)'], ['origin_name', 'Tên gốc / tiếng Anh'], ['publish_year', 'Năm phát hành'], ['episode_total', 'Tổng số tập'], ['episode_current', 'Trạng thái tập (VD: Tập 6/24)'], ['episode_time', 'Thời lượng'], ['quality', 'Chất lượng'], ['language', 'Ngôn ngữ'], ['actor', 'Diễn viên'], ['director', 'Đạo diễn'], ['trailer', 'URL trailer'], ['rating_star', 'Điểm tham khảo']].map(([key, label]) => <label key={key}>{label}<input required={['name', 'slug'].includes(key)} readOnly={key === 'slug' && !!movie.id} value={value[key] || ''} onChange={e => { update(key, e.target.value); if (key === 'name' && !movie.id) update('slug', slugify(e.target.value)); }} /></label>)}<label>Loại phim<select value={value.type} onChange={e => update('type', e.target.value)}><option value="single">Phim lẻ</option><option value="series">Phim bộ</option><option value="hoathinh">Hoạt hình</option><option value="tvshows">TV Shows</option></select></label><label>Trạng thái<select value={value.status} onChange={e => update('status', e.target.value)}><option value="ongoing">Đang chiếu</option><option value="completed">Hoàn tất</option><option value="trailer">Trailer</option></select></label><label>Mùa Anime<select value={value.anime_season || ''} onChange={e => update('anime_season', e.target.value)}><option value="">Chưa phân loại</option><option value="spring">Xuân</option><option value="summer">Hạ</option><option value="autumn">Thu</option><option value="winter">Đông</option></select></label>{[['categories', 'Thể loại (ngăn cách bởi dấu phẩy)'], ['regions', 'Quốc gia (ngăn cách bởi dấu phẩy)']].map(([key, title]) => <label key={key}>{title}<input value={taxonomyText[key]} onChange={e => setTaxonomyText({ ...taxonomyText, [key]: e.target.value })} /></label>)}{[['thumb_url', 'Poster dọc'], ['poster_url', 'Ảnh ngang / banner']].map(([key, title]) => <label key={key}>{title}<input value={value[key]} onChange={e => update(key, e.target.value)} placeholder="URL ảnh" /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => imageUpload(e, key)} /></label>)}</div><label>Nội dung phim<textarea value={value.description || ''} onChange={e => update('description', e.target.value)} rows={5} /></label><div className="checkboxes">{[['is_recommended', 'Phim đề cử / nổi bật'], ['is_shown_in_theater', 'Phim chiếu rạp'], ['is_hot', 'Phim hot'], ['is_new', 'Phim mới']].map(([key, label]) => <label key={key}><input type="checkbox" checked={!!value[key]} onChange={e => update(key, e.target.checked)} />{label}</label>)}</div><h2>Quản lý tập & nguồn phát</h2><p className="muted">Thêm URL MP4, HLS (.m3u8) hoặc trang phát nhúng. Mỗi dòng tương ứng một tập trên một máy chủ.</p>{value.episodes.map((ep, i) => <div className="episode-editor" key={i}>{[['name', 'Tên tập'], ['server', 'Máy chủ / ngôn ngữ'], ['link', 'URL video'], ['subtitle_url', 'URL phụ đề VTT (nếu có)']].map(([key, label]) => <label key={key}>{label}<input required={key !== 'subtitle_url'} value={ep[key] || ''} onChange={e => update('episodes', value.episodes.map((x, n) => n === i ? { ...x, [key]: e.target.value } : x))} /></label>)}<label>Ngôn ngữ<select value={ep.language || 'Vietsub'} onChange={e => update('episodes', value.episodes.map((x, n) => n === i ? { ...x, language: e.target.value } : x))}>{['Vietsub', 'Thuyết minh', 'Lồng tiếng'].map(x => <option key={x}>{x}</option>)}</select></label><label><input type="checkbox" checked={!!ep.is_new} onChange={e => update('episodes', value.episodes.map((x,n) => n === i ? {...x,is_new:e.target.checked}:x))} />Tập mới</label><label>Định dạng<select value={ep.type} onChange={e => update('episodes', value.episodes.map((x, n) => n === i ? { ...x, type: e.target.value } : x))}><option value="m3u8">HLS</option><option value="mp4">MP4</option><option value="embed">Nhúng</option></select></label><div className="episode-tools"><button type="button" disabled={i === 0} aria-label={'Đưa tập lên ' + ep.name} onClick={() => moveEpisode(i, -1)}>↑</button><button type="button" disabled={i === value.episodes.length - 1} aria-label={'Đưa tập xuống ' + ep.name} onClick={() => moveEpisode(i, 1)}>↓</button><button type="button" aria-label={'Xóa tập ' + ep.name} onClick={() => update('episodes', value.episodes.filter((_, n) => n !== i))}>×</button></div></div>)}<button type="button" onClick={() => update('episodes', [...value.episodes, { id: String(Date.now()), slug: 'tap-' + Date.now(), name: String(value.episodes.length + 1), server: 'Vietsub', type: 'mp4', link: '' }])}>＋ Thêm tập</button><div className="editor-actions"><button disabled={busy} className="primary-button">{busy ? 'Đang lưu...' : 'Lưu phim & tập phim'}</button><button type="button" onClick={close}>Hủy thay đổi</button></div></form></section>;
}
export default function Admin() {
  const { user, refresh, notify, setUser, notificationItems } = useContext(Context);
  const location = useLocation();
  const history = useHistory();
  const [data, setData] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({type:'', status:'', category:'', region:'', visibility:'active'});
  const [error, setError] = useState('');
  const [page,setPage] = useState(1);
  const allowed = ['admin','staff'].includes(user?.role);
  const tab = location.pathname.split('/')[2] || 'dashboard';
  
  // Phân nhóm Menu Sidebar như yêu cầu
  const menuGroups = [
    { title: '', items: [['dashboard','📊','Dashboard']] },
    { title: '🎬 NỘI DUNG', items: [['movies','🎬','Phim'],['episodes','📺','Tập phim'],['servers','🎥','Server video'],['categories','🏷','Thể loại'],['countries','🌍','Quốc gia'],['actors','🎭','Diễn viên'],['directors','🎬','Đạo diễn']] },
    { title: '🏠 GIAO DIỆN', items: [['homepage','🏠','Trang chủ'],['banners','🖼','Banner'],['trending','🔥','Phim HOT'],['schedule','📅','Lịch phát hành']] },
    { title: '👥 NGƯỜI DÙNG', items: [['users','👤','Người dùng'],['roles','👥','Vai trò'],['permissions','🔑','Phân quyền']] },
    { title: '💬 CỘNG ĐỒNG', items: [['comments','💬','Bình luận'],['ratings','⭐','Đánh giá'],['reports','🚨','Báo cáo']] },
    { title: '📈 THỐNG KÊ', items: [['statistics','📈','Analytics'],['activity-logs','📝','Activity Logs']] },
    { title: '⚙️ HỆ THỐNG', items: [['settings','⚙','Cài đặt'],['maintenance','🚧','Bảo trì']] }
  ];
  
  // Lấy tất cả tab hiện có để kiểm tra active
  const tabs = menuGroups.flatMap(g => g.items);
  
  async function load() { const result = await api('/admin'); setData(result); await refresh(); }
  useEffect(() => { if (allowed) api('/admin').then(setData).catch(e => setError(e.message)); }, [allowed]);
  useEffect(()=>{setQuery('');setPage(1);},[location.pathname]);
  async function patch(collection,id,body) { try { await api('/admin/'+collection+'/'+encodeURIComponent(id),'PATCH',body);await load();notify('Đã cập nhật.'); } catch(e) {notify(e.message);} }
  if (!allowed) return <Redirect to="/admin/login" />;
  if (error) return <main className="page container"><p role="alert">{error}</p><button onClick={()=>{setError('');load().catch(e=>setError(e.message));}}>Thử lại</button></main>;
  if (!data) return <main className="page container">Đang tải quản trị...</main>;
  const adminOnly = ['users','settings','reports','roles','permissions','activity-logs','maintenance'];
  const editingId = /^\/admin\/movies\/([^/]+)\/edit\/?$/.exec(location.pathname)?.[1];
  const creating = location.pathname === '/admin/movies/create';
  const editing = creating ? blank : editingId ? data.movies.find(m=>String(m.id)===decodeURIComponent(editingId)) : null;
  const filtered = data.movies.filter(m => normalize([m.name,m.origin_name,m.slug].join(' ')).includes(normalize(query)) && (!filters.type || m.type===filters.type) && (!filters.status || m.status===filters.status) && (!filters.category || m.categories.some(c=>c.slug===filters.category)) && (!filters.region || m.regions.some(c=>c.slug===filters.region)) && (filters.visibility==='trash' ? m.deleted : filters.visibility==='hidden' ? m.hidden&&!m.deleted : !m.deleted));
  const pages = Math.max(1,Math.ceil(filtered.length/20));
  const currentPage = Math.min(page,pages);
  const movieName = slug => data.movies.find(m=>m.slug===slug)?.name || slug;
  const search = placeholder => <input className="admin-search" aria-label={placeholder} placeholder={placeholder} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} />;
  const editLink = m => '/admin/movies/'+encodeURIComponent(m.id)+'/edit';
  return <main className="admin-shell"><aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><span>▶</span> ADMIN MOVIE</Link>
    <div className="admin-sidebar-scroll">
      {menuGroups.map((group, i) => (
        <div key={i} className="admin-nav-group">
          {group.title && <p className="muted">{group.title}</p>}
          <nav>
            {group.items.filter(([key])=>user.role==='admin'||!adminOnly.includes(key)).map(([key,icon,label])=><NavLink key={key} to={'/admin/'+key} isActive={()=>tab===key}><span>{icon}</span>{label}</NavLink>)}
          </nav>
        </div>
      ))}
    </div>
    <Link className="admin-back" to="/">↗ Xem website</Link></aside><div className="admin-workspace"><header className="admin-topbar"><div><small>Không gian quản trị</small><h1>{tabs.find(([key])=>key===tab)?.[2] || 'Quản trị'}</h1></div><div className="admin-account"><Link to="/thong-bao" aria-label="Thông báo">🔔 {notificationItems.filter(n=>!n.read).length}</Link><details><summary>{user.name} · {user.role.toUpperCase()} ▾</summary><button onClick={async()=>{try{await api('/auth/logout','POST');setUser(null);history.replace('/admin/login');}catch(e){notify(e.message);}}}>Đăng xuất</button></details></div></header><div className="admin-body">
  {user.role!=='admin'&&adminOnly.includes(tab) ? <section className="panel">Bạn không có quyền truy cập mục này.</section> : creating || editingId ? (editing ? <MovieEditor key={editing.id||'new'} movie={editing} close={()=>history.push('/admin/movies')} done={load}/> : <p>Không tìm thấy phim. <Link to="/admin/movies">Về danh sách</Link></p>) : <>
  {['dashboard','statistics'].includes(tab)&&<Dashboard key={tab} statistics={tab==='statistics'}/>}
  {['movies','episodes'].includes(tab)&&<section className="panel"><div className="section-heading"><h2>{tab==='episodes'?'Chọn phim để quản lý tập':'Danh sách phim'} ({filtered.length})</h2><Link className="primary-button" to="/admin/movies/create">＋ Thêm phim</Link></div>{search('Tìm tên phim, tên gốc, slug...')}<div className="admin-filters">{[['type','Loại phim',[['single','Phim lẻ'],['series','Phim bộ'],['hoathinh','Hoạt hình'],['tvshows','TV Shows']]],['status','Trạng thái',[['ongoing','Đang chiếu'],['completed','Hoàn tất'],['trailer','Trailer']]],['category','Thể loại',data.taxonomies.categories.map(c=>[c.slug,c.name])],['region','Quốc gia',data.taxonomies.regions.map(c=>[c.slug,c.name])]].map(([key,label,options])=><select key={key} aria-label={label} value={filters[key]} onChange={e=>{setFilters({...filters,[key]:e.target.value});setPage(1);}}><option value="">Tất cả {label.toLowerCase()}</option>{options.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select>)}<select aria-label="Danh sách hoặc thùng rác" value={filters.visibility} onChange={e=>{setFilters({...filters,visibility:e.target.value});setPage(1);}}><option value="active">Danh sách hiện tại</option><option value="hidden">Phim đang ẩn</option><option value="trash">Thùng rác</option></select></div><div className="table-scroll"><table><thead><tr><th>Phim</th><th>Năm</th><th>Trạng thái</th><th>Nguồn tập</th><th>Thao tác</th></tr></thead><tbody>{filtered.slice((currentPage-1)*20,currentPage*20).map(m=><tr key={m.id}><td><strong>{m.name}</strong><small className="admin-subtext">{m.origin_name} {m.hidden?'· Đang ẩn':''}</small></td><td>{m.publish_year}</td><td><select aria-label={'Trạng thái '+m.name} value={m.status} onChange={e=>patch('movies',m.id,{status:e.target.value})}><option value="ongoing">Đang chiếu</option><option value="completed">Hoàn tất</option><option value="trailer">Trailer</option></select></td><td>{m.episodes.length}</td><td><Link className="admin-edit" to={editLink(m)}>{tab==='episodes'?'Quản lý tập':'Sửa'}</Link><button onClick={()=>patch('movies',m.id,{deleted:!m.deleted})}>{m.deleted?'Khôi phục':'Xóa'}</button><button onClick={()=>patch('movies',m.id,{hidden:!m.hidden})}>{m.hidden?'Hiện':'Ẩn'}</button></td></tr>)}</tbody></table></div>{!filtered.length&&<p>Không có phim phù hợp.</p>}<div className="admin-pagination"><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>← Trước</button><span>Trang {currentPage}/{pages}</span><button disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Sau →</button></div></section>}
  {['categories','countries'].includes(tab)&&<Taxonomies key={tab} kind={tab==='countries'?'regions':'categories'} data={data} load={load}/>}
  {tab==='users'&&<section className="panel"><h2>Quản lý tài khoản</h2>{search('Tìm tên, email hoặc ID người dùng...')}<p className="muted">STAFF quản lý nội dung và xem thống kê. Chỉ ADMIN được quản lý tài khoản và cài đặt.</p><div className="table-scroll"><table><thead><tr><th>ID / Username</th><th>Email</th><th>Ngày đăng ký</th><th>Trạng thái</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>{data.users.filter(u=>normalize([u.id,u.name,u.email].join(' ')).includes(normalize(query))).map(u=><tr key={u.id}><td>{u.name}<small className="admin-subtext">{u.id}</small></td><td>{u.email}</td><td>{u.created_at?new Date(u.created_at).toLocaleDateString('vi-VN'):'Chưa ghi nhận'}</td><td>{u.deleted?'Đã xóa':u.blocked?'Đã khóa':'Hoạt động'}</td><td><select aria-label={'Vai trò '+u.name} disabled={u.id===user.id} value={u.role} onChange={e=>patch('users',u.id,{role:e.target.value})}>{['admin','staff','user'].map(r=><option key={r} value={r}>{r.toUpperCase()}</option>)}</select></td><td><button disabled={u.id===user.id} onClick={()=>patch('users',u.id,{blocked:!u.blocked})}>{u.blocked?'Mở khóa':'Khóa'}</button><button disabled={u.id===user.id} onClick={()=>patch('users',u.id,{deleted:!u.deleted})}>{u.deleted?'Khôi phục':'Xóa'}</button></td></tr>)}</tbody></table></div></section>}
  {tab==='comments'&&<section className="panel"><h2>Quản lý bình luận</h2>{search('Tìm người dùng, phim hoặc nội dung bình luận...')}<div className="table-scroll"><table><thead><tr><th>Người dùng / Phim</th><th>Nội dung</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.comments.filter(c=>normalize([c.name,c.text,movieName(c.slug)].join(' ')).includes(normalize(query))).map(c=><tr key={c.id}><td>{c.name}<small className="admin-subtext">{movieName(c.slug)}</small></td><td>{c.text}</td><td>{c.deleted?'Đã xóa':c.hidden?'Ẩn':'Hiển thị'}</td><td><button onClick={()=>patch('comments',c.id,{hidden:!c.hidden})}>{c.hidden?'Hiện':'Ẩn'}</button><button onClick={()=>patch('comments',c.id,{deleted:!c.deleted})}>{c.deleted?'Khôi phục':'Xóa'}</button><button onClick={()=>patch('comments',c.id,{pinned:!c.pinned})}>{c.pinned?'Bỏ ghim':'Ghim'}</button>{user.role==='admin'&&<button disabled={c.userId===user.id||!data.users.some(u=>u.id===c.userId)} onClick={()=>patch('users',c.userId,{blocked:true})}>Khóa người dùng</button>}</td></tr>)}</tbody></table></div>{!data.comments.length&&<p>Chưa có bình luận.</p>}</section>}
  {tab==='ratings'&&<section className="panel"><h2>Đánh giá theo phim</h2><RatingSummary data={data}/><h2>Kiểm duyệt đánh giá</h2>{search('Tìm phim hoặc người đánh giá...')}{data.ratings.filter(r=>normalize([r.name,movieName(r.slug)].join(' ')).includes(normalize(query))).map(r=><div className="comment" key={r.id}>{r.name} · {movieName(r.slug)} · ★ {r.score}/10 · {r.hidden?'Đã loại':'Hợp lệ'} <button onClick={()=>patch('ratings',r.id,{hidden:!r.hidden})}>{r.hidden?'Khôi phục':'Xóa đánh giá không hợp lệ'}</button></div>)}</section>}
  {tab==='homepage'&&<Homepage data={data} patch={patch}/>}
  {tab==='banners'&&<BannerManager data={data} load={load}/>}
  {tab==='reports'&&<section className="panel"><h2>Báo lỗi / Liên hệ</h2>{!data.reports.length&&<p>Chưa có phản hồi.</p>}{data.reports.map(r=><article className="comment" key={r.id}><b>{r.email||'Khách'}</b><p>{r.message}</p><select aria-label="Trạng thái báo lỗi" value={r.status} onChange={e=>patch('reports',r.id,{status:e.target.value})}>{['Mới','Đang xử lý','Đã xử lý'].map(x=><option key={x}>{x}</option>)}</select></article>)}</section>}
  {tab==='settings'&&<Settings data={data} load={load}/>}
  
  {/* Các module mới */ }
  {tab==='servers'&&<ServersManager data={data} load={load} patch={patch} />}
  {tab==='actors'&&<ActorsManager data={data} load={load} patch={patch} />}
  {tab==='directors'&&<DirectorsManager data={data} load={load} patch={patch} />}
  {tab==='trending'&&<TrendingManager data={data} load={load} patch={patch} />}
  {tab==='schedule'&&<ScheduleManager data={data} load={load} patch={patch} />}
  {tab==='roles'&&<RolesManager data={data} load={load} patch={patch} />}
  {tab==='permissions'&&<RolesManager data={data} load={load} patch={patch} />}
  {tab==='activity-logs'&&<ActivityLogs data={data} load={load} patch={patch} />}
  {tab==='maintenance'&&<MaintenanceManager data={data} load={load} patch={patch} />}

  {!tabs.some(([key])=>key===tab)&&<p>Không tìm thấy trang quản trị. <Link to="/admin">Về Dashboard</Link></p>}
  </>}</div></div></main>;
}
