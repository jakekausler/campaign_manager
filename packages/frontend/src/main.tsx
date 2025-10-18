/**
 * Campaign Management Tool - Frontend Entry Point
 * React + Vite Application
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Load and validate environment configuration at startup
import '@/config/env';

import './index.css';
import App from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
