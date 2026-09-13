import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Context } from './App';
import { api, number, normalize } from './api';

export function Dashboard({ statistics = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('days');
  useEffect(() => { api('/admin/statistics').then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Đang tải thống kê...</p>;
  const points = data[period];
  const max = Math.max(1, ...points.map(p => p.views));
  const generalLabels = [['movies', 'Tổng số phim'], ['episodes', 'Tổng số tập'], ['users', 'Tổng người dùng'], ['views', 'Tổng lượt xem'], ['comments', 'Tổng bình luận']];
  const timeLabels = [['today', 'Lượt xem hôm nay'], ['week', 'Lượt xem tuần'], ['month', 'Lượt xem tháng'], ['newUsers', 'Người dùng mới'], ['newComments', 'Bình luận mới']];
  const labels = statistics ? timeLabels : generalLabels;
  return <><div className="stats">{labels.map(([key, label]) => <div className="panel" key={key}><p>{label}</p><strong>{number(data.totals[key]||0)}</strong></div>)}</div>
    {!statistics && <div className="stats" style={{marginTop:'-12px'}}>{timeLabels.map(([key, label]) => <div className="panel" key={key} style={{borderTop:'3px solid #6c788a'}}><p>{label}</p><strong>{number(data.totals[key]||0)}</strong></div>)}</div>}
    <section className="panel"><div className="section-heading"><h2>Thống kê lượt xem</h2><select aria-label="Khoảng thống kê" value={period} onChange={e => setPeriod(e.target.value)}><option value="days">30 ngày gần nhất</option><option value="months">12 tháng gần nhất</option></select></div><p className="muted">Lượt xem ghi nhận tại website · Múi giờ UTC.</p><div className="admin-chart" role="img" aria-label={points.map(p => `${p.date}: ${p.views}`).join('; ')}>{points.map(p => <div key={p.date} title={`${p.date}: ${number(p.views)} lượt xem`}><small>{p.views > 0 ? number(p.views) : ''}</small><span style={{ height: `${p.views / max * 160}px` }} /><small>{period === 'days' ? p.date.slice(8) : p.date.slice(2)}</small></div>)}</div>{!points.some(p => p.views) && <p>Chưa ghi nhận lượt xem trong khoảng này.</p>}</section>
    <div className="admin-two-columns"><section className="panel"><h2>Phim được xem nhiều nhất</h2>{data.top.map((m,i) => <div className="admin-ranking" key={m.id}><b>{i+1}</b><Link to={'/phim/'+m.slug}>{m.name}</Link><span>{number(m.views)}</span></div>)}</section><section className="panel"><h2>{statistics ? 'Phim được đánh giá cao' : 'Phim mới cập nhật'}</h2>{(statistics ? data.rated : data.newest).map(m => <div className="admin-ranking" key={m.id}><Link to={'/phim/'+m.slug}>{m.name}</Link><span>{statistics ? `${m.score.toFixed(1)} / 10 · ${m.count} đánh giá` : new Date(m.created_at).toLocaleDateString('vi-VN')}</span></div>)}{!(statistics ? data.rated : data.newest).length && <p className="muted">{statistics ? 'Chưa có đánh giá của người dùng.' : 'Chưa có phim có ngày tạo. Dữ liệu cũ chưa ghi nhận ngày thêm.'}</p>}</section></div></>;
}

export function RatingSummary({ data }) {
  const rows = data.movies.map(m => { const ratings = data.ratings.filter(r => !r.hidden && r.slug === m.slug); return { ...m, count: ratings.length, score: ratings.length ? (ratings.reduce((s,r) => s+r.score,0)/ratings.length).toFixed(1) : '—' }; }).filter(m => m.count);
  return <div className="table-scroll"><table><thead><tr><th>Phim</th><th>Điểm</th><th>Số đánh giá</th></tr></thead><tbody>{rows.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.score}</td><td>{m.count}</td></tr>)}</tbody></table>{!rows.length && <p>Chưa có đánh giá hợp lệ.</p>}</div>;
}

export function Homepage({ data, patch }) {
  const [query,setQuery] = useState('');
  const flags = [['is_recommended','Đề cử'],['is_hot','Hot'],['is_shown_in_theater','Chiếu rạp'],['homepage_single','Phim lẻ mới'],['homepage_series','Phim bộ mới'],['homepage_animation','Hoạt hình'],['homepage_top','Hot trong tuần'],['homepage_rated','Đánh giá cao']];
  return <section className="panel"><h2>Điều khiển trang chủ</h2><p className="muted">Đề cử, Hot và Chiếu rạp dùng danh sách được chọn. Các khu vực còn lại ưu tiên phim được chọn, sau đó bổ sung theo loại phim hoặc thứ hạng.</p><input aria-label="Tìm phim trang chủ" placeholder="Tìm phim..." value={query} onChange={e=>setQuery(e.target.value)} /><div className="table-scroll"><table><thead><tr><th>Phim</th>{flags.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{data.movies.filter(m=>!m.deleted && normalize(m.name).includes(normalize(query))).map(m=><tr key={m.id}><td>{m.name}</td>{flags.map(([key,label])=><td key={key}><input aria-label={`${m.name}: ${label}`} type="checkbox" checked={!!m[key]} onChange={e=>patch('movies',m.id,{[key]:e.target.checked})} /></td>)}</tr>)}</tbody></table></div></section>;
}

export function Settings({ data, load }) {
  const { notify } = useContext(Context);
  const [busy,setBusy]=useState(false);
  return <section className="panel"><h2>Cài đặt website</h2><form onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);const body=Object.fromEntries(form);for(const key of ['registration_enabled','comments_enabled'])body[key]=form.has(key);setBusy(true);try{await api('/admin/settings','PUT',body);await load();notify('Đã lưu cài đặt.');}catch(e){notify(e.message);}finally{setBusy(false);}}}><div className="form-grid">{[['name','Tên website'],['logo','URL logo'],['favicon','URL favicon'],['contact_email','Email liên hệ']].map(([key,label])=><label key={key}>{label}<input name={key} type={key==='contact_email'?'email':'text'} required={key==='name'} defaultValue={data.settings[key]||''}/></label>)}</div>{[['description','Mô tả website'],['footer','Thông tin footer'],['about','Giới thiệu'],['faq','Hướng dẫn'],['privacy','Chính sách'],['terms','Điều khoản']].map(([key,label])=><label key={key}>{label}<textarea name={key} defaultValue={data.settings[key]||''} rows={3}/></label>)}<div className="checkboxes">{[['registration_enabled','Cho phép đăng ký'],['comments_enabled','Cho phép bình luận']].map(([key,label])=><label key={key}><input type="checkbox" name={key} defaultChecked={data.settings[key]!==false}/>{label}</label>)}</div><button className="primary-button" disabled={busy}>{busy?'Đang lưu...':'Lưu cài đặt'}</button></form></section>;
}
