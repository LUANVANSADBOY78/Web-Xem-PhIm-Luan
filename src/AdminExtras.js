import React, { useContext, useEffect, useState } from 'react';
import { Context } from './App';
import { api, number } from './api';

export function Taxonomies({ kind, data, load }) {
  const { notify } = useContext(Context);
  async function save(body) { try { await api('/admin/taxonomies/' + kind, 'POST', body); await load(); notify('Đã lưu phân loại.'); } catch (e) { notify(e.message); } }
  return <section className="panel"><h2>{kind === 'categories' ? 'Thể loại' : 'Quốc gia'}</h2><form className="taxonomy-row" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; save({ name: new FormData(form).get('name') }).then(() => form.reset()); }}><input name="name" required placeholder="Tên phân loại mới" aria-label="Tên phân loại mới" /><button className="primary-button">Thêm</button></form>{(data.taxonomies?.[kind] || []).map(c => <form className="taxonomy-row" key={c.id} onSubmit={e => { e.preventDefault(); save({ ...c, name: new FormData(e.currentTarget).get('name') }); }}><input aria-label={'Tên ' + c.name} name="name" defaultValue={c.name} required /><small>{data.movies.filter(m => !m.deleted && m[kind].some(t => t.slug === c.slug)).length} phim</small><button>Lưu</button><button type="button" onClick={() => save({ ...c, deleted: !c.deleted })}>{c.deleted ? 'Khôi phục' : 'Xóa'}</button></form>)}</section>;
}
export function ViewChart() {
  const [days, setDays] = useState([]);
  const { notify } = useContext(Context);
  useEffect(() => { api('/admin/statistics').then(d => setDays(d.days)).catch(e => notify(e.message)); }, [notify]);
  const max = Math.max(1, ...days.map(d => d.views));
  return <section className="panel"><h2>Lượt xem 30 ngày gần nhất</h2><p className="muted">Lượt xem ghi nhận tại website này: {number(days.reduce((s, d) => s + d.views, 0))}</p><div className="views-chart" role="img" aria-label={days.map(d => d.date + ': ' + d.views + ' lượt xem').join('; ')}>{days.map(d => <div key={d.date} title={d.date + ': ' + d.views}><span style={{ height: (d.views / max * 140) + 'px' }} /><small>{d.date.slice(8)}</small></div>)}</div></section>;
}
export function BannerManager({ data, load }) {
  const { notify } = useContext(Context);
  const [image, setImage] = useState('');
  const [editing, setEditing] = useState(null);
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2000000) return notify('Chọn ảnh JPG, PNG hoặc WebP dưới 2 MB.');
    const reader = new FileReader(); reader.onload = () => setImage(reader.result); reader.readAsDataURL(file);
  }
  return <section className="panel"><h2>Banner trang chủ</h2><form key={editing?.id || 'new'} onSubmit={async e => { e.preventDefault(); try { await api('/admin/banners', 'POST', { ...Object.fromEntries(new FormData(e.currentTarget)), image, id: editing?.id }); setImage(''); setEditing(null); await load(); notify('Đã lưu banner.'); } catch (e) { notify(e.message); } }}><label>URL ảnh<input required value={image} onChange={e => setImage(e.target.value)} /></label><label>Hoặc tải ảnh<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label><label>Phim liên kết<select name="slug" defaultValue={editing?.slug}>{data.movies.filter(m => !m.deleted).map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label><button className="primary-button">{editing ? 'Lưu banner' : 'Thêm banner'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setImage(''); }}>Hủy</button>}</form>{data.banners.map(b => <div className="comment" key={b.id}><p>{data.movies.find(m => m.slug === b.slug)?.name}</p><button onClick={() => { setEditing(b); setImage(b.image); }}>Sửa</button> <button onClick={async () => { try { await api('/admin/banners/' + b.id, 'PATCH', { deleted: !b.deleted }); await load(); } catch (e) { notify(e.message); } }}>{b.deleted ? 'Hiện lại' : 'Ẩn'}</button></div>)}</section>;
}
