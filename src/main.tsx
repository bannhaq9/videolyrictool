import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ngăn thông báo vô hại ResizeObserver loop limit exceeded của trình duyệt
window.addEventListener('error', (e) => {
  if (
    typeof e.message === 'string' &&
    (e.message.includes('ResizeObserver loop') ||
     e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
     e.message.includes('ResizeObserver loop limit exceeded'))
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
