/**
 * Campaign Management Tool - Frontend Entry Point
 * React + Vite Application
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div>
      <h1>Campaign Management Tool</h1>
      <p>Frontend application placeholder</p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
