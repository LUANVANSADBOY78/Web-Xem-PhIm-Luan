import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './App.css';
import './Features.css';
import './Layout.css';
import './Polish.css';
import './Alignment.css';
import './FinalPolish.css';
import './SupportWidgets.css';

class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <main className="page"><h1>Không thể hiển thị trang</h1><p>Vui lòng tải lại trang để thử lại.</p><button onClick={() => window.location.reload()}>Tải lại</button></main> : this.props.children; }
}
ReactDOM.render(<ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary>, document.getElementById('root'));
