import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from './api';
import { Context } from './App';

export function RatingPeople() {
  const { movies } = React.useContext(Context);
  const { slug } = useParams();
  const location = useLocation();
  const [ratings, setRatings] = useState([]);
  useEffect(() => {
    if (!slug || location.pathname.startsWith('/xem-phim/')) return undefined;
    api('/movies/' + slug + '/community').then(data => setRatings(data.ratings || [])).catch(() => setRatings([]));
    return () => setRatings([]);
  }, [slug, location.pathname]);
  if (!slug || location.pathname.startsWith('/xem-phim/') || !ratings.length) return null;
  const movie = movies.find(item => item.slug === slug);
  return <section className="panel rating-people"><h2>Người đánh giá {movie ? '· ' + movie.name : ''}</h2><div>{ratings.map(rating => <span key={rating.id} className="rating-person"><b>{rating.name || 'Người dùng'}</b><small>★ {rating.score}/10</small></span>)}</div></section>;
}

const answers = [
  [/tìm|search|kiếm/i, 'Bạn nhập tên phim vào ô Tìm tên phim ở đầu trang, sau đó chọn kết quả phù hợp.'],
  [/tập|episode|ep/i, 'Mở trang chi tiết phim, kéo tới Danh sách tập phim rồi chọn tập muốn xem.'],
  [/server|máy chủ|nguồn/i, 'Trong trang xem phim, dùng ô Máy chủ phát để đổi nguồn nếu nguồn hiện tại không hoạt động.'],
  [/lỗi|không phát|video/i, 'Hãy thử đổi máy chủ, tải lại trang bằng Ctrl + F5 và gửi báo lỗi nếu tất cả nguồn đều không phát.'],
  [/admin|quản trị/i, 'Trang quản trị nằm tại /admin và chỉ tài khoản có quyền Admin mới truy cập được.'],
];
function answer(text) { return answers.find(([pattern]) => pattern.test(text))?.[1] || 'Mình có thể giúp bạn tìm phim, chọn tập, đổi server hoặc xử lý lỗi video.'; }
export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Xin chào! Bạn cần tìm phim hay gặp lỗi khi xem?' }]);
  function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages(list => [...list, { from: 'user', text }, { from: 'bot', text: answer(text) }]);
    setInput('');
  }
  return <><button className="chatbot-launcher" aria-label="Mở trợ lý Văn Luân" onClick={() => setOpen(value => !value)}>✦</button>{open && <section className="chatbot" aria-label="Trợ lý Văn Luân"><header><b>Trợ lý Văn Luân</b><button aria-label="Đóng trợ lý" onClick={() => setOpen(false)}>×</button></header><div className="chatbot-messages">{messages.map((message, index) => <p className={message.from} key={index}>{message.text}</p>)}</div><form onSubmit={send}><input aria-label="Tin nhắn cho trợ lý" placeholder="Hỏi cách xem phim..." value={input} onChange={event => setInput(event.target.value)} /><button aria-label="Gửi tin nhắn">Gửi</button></form></section>}</>;
}
