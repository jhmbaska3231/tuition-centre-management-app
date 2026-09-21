// frontend/src/main.tsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* replaced in phase 2 by the router and providers */}
    <div className="p-8 text-foreground">
      <h1 className="text-2xl font-semibold">Tuition Centre Management</h1>
      <p className="mt-2 text-muted-foreground">Frontend setup in progress...</p>
    </div>
  </StrictMode>,
);