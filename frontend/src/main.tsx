// frontend/src/main.tsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/api/query-client';
import { AuthProvider } from '@/auth/context';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* router and app shell arrive in phase 2 */}
        <div className="p-8">
          <h1 className="text-2xl font-semibold text-foreground">Tuition Centre Management</h1>
          <p className="mt-2 text-muted-foreground">api client and auth context set up...</p>
        </div>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);