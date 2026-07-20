import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { App } from './App';
import { AuthProvider } from '@/contexts/AuthContext';
import { ensureCanonicalLoopbackHost } from '@/lib/loopback';
import './app.css';

if (ensureCanonicalLoopbackHost()) {
  // Redirecting localhost → 127.0.0.1 so Auth0 gateway cookie can attach.
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
          {/* Hobby-free: Web Analytics (50k) + Speed Insights (1 project — Buyer only) */}
          <Analytics />
          <SpeedInsights />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
