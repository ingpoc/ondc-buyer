import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { App } from './App';
import { WalletProvider } from './providers/WalletProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import './app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <AuthProvider>
          <App />
          {/* Hobby-free: Web Analytics (50k) + Speed Insights (1 project — Buyer only) */}
          <Analytics />
          <SpeedInsights />
        </AuthProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
