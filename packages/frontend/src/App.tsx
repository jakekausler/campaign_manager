/**
 * Campaign Management Tool - Main App Component
 */

import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Campaign Management Tool</h1>
      <p>React + Vite + TypeScript Frontend</p>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={() => setCount((count) => count + 1)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: '#f0f0f0',
          }}
        >
          Count is {count}
        </button>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          Click the button to test hot reload functionality
        </p>
      </div>
    </div>
  );
}

export default App;
