import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Quick dev-time diagnostic: log key CSS variables so we can verify the theme is loaded.
if (process.env.NODE_ENV === 'development') {
  // run after the DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    try {
      const root = getComputedStyle(document.documentElement);
      // trim values to make output concise
      console.log('Theme variables:', {
        '--primary-color': root.getPropertyValue('--primary-color').trim(),
        '--surface': root.getPropertyValue('--surface').trim(),
        '--on-primary': root.getPropertyValue('--on-primary').trim(),
      });
    } catch (e) {
      console.log('Theme debug: failed to read CSS variables', e);
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
