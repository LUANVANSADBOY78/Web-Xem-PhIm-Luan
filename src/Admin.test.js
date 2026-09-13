import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { api } from './api';
jest.mock('./api', () => ({ ...jest.requireActual('./api'), api: jest.fn() }));
jest.mock('hls.js', () => ({ __esModule: true, default: { isSupported: () => false } }));
const movie={id:'m1',slug:'test',name:'Phim kiểm thử',origin_name:'Test',status:'ongoing',type:'series',categories:[],regions:[],episodes:[],created_at:'2026-09-11'};
let role;
beforeEach(()=>{
  role='admin';window.scrollTo=jest.fn();api.mockReset();
  api.mockImplementation((path)=>Promise.resolve(path==='/catalog'?{movies:[movie],settings:{name:'Test site'},banners:[],taxonomies:{categories:[],regions:[]}}:path==='/session'?{user:{id:'u1',name:'Admin Test',role},needsSetup:false}:path==='/admin'?{movies:[movie],users:[],comments:[],ratings:[],reports:[],banners:[],settings:{},taxonomies:{categories:[],regions:[]}}:path==='/admin/statistics'?{days:[{date:'2026-09-11',views:3}],months:[{date:'2026-09',views:8}],totals:{movies:1,episodes:0,users:1,comments:0,views:3},top:[],newest:[],rated:[]}:[]));
});
test('Direct dashboard renders counters and switches to month chart',async()=>{
  render(<MemoryRouter initialEntries={['/admin']}><App/></MemoryRouter>);
  expect(await screen.findByText('Tổng số phim')).toBeInTheDocument();
  expect(screen.getByText('Tổng bình luận')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Khoảng thống kê'),{target:{value:'months'}});
  expect(screen.getByRole('img',{name:'2026-09: 8'})).toBeInTheDocument();
});
test('Movies filter and navigate to a direct edit URL with episode controls',async()=>{
  render(<MemoryRouter initialEntries={['/admin/movies']}><App/></MemoryRouter>);
  await screen.findByText('Danh sách phim (1)');
  fireEvent.change(screen.getByLabelText('Loại phim'),{target:{value:'single'}});
  expect(screen.getByText('Không có phim phù hợp.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Loại phim'),{target:{value:'series'}});
  fireEvent.click(screen.getByRole('link',{name:'Sửa',exact:true}));
  expect(await screen.findByRole('heading',{name:'Sửa phim'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'＋ Thêm tập'}));
  expect(screen.getByLabelText('Tập mới')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Ngôn ngữ')).toHaveLength(2);
});
test('Staff cannot open settings and has no users navigation',async()=>{
  role='staff';
  render(<MemoryRouter initialEntries={['/admin/settings']}><App/></MemoryRouter>);
  expect(await screen.findByText('Bạn không có quyền truy cập mục này.')).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:/Người dùng/})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Lưu cài đặt'})).not.toBeInTheDocument();
});
test('Settings submit actual boolean values',async()=>{
  render(<MemoryRouter initialEntries={['/admin/settings']}><App/></MemoryRouter>);
  await screen.findByRole('heading',{name:'Cài đặt website'});
  fireEvent.change(screen.getByLabelText('Tên website'),{target:{value:'My movies'}});
  fireEvent.click(screen.getByLabelText('Cho phép đăng ký'));
  fireEvent.click(screen.getByRole('button',{name:'Lưu cài đặt'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/admin/settings','PUT',expect.objectContaining({name:'My movies',registration_enabled:false,comments_enabled:true})));
});
