import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth.jsx';
import { ToastProvider } from './lib/toast.jsx';
import { registerServiceWorker } from './lib/push.js';
import Landing from './pages/Landing.jsx';
import './styles/base.css';
import './styles/components.css';
import './styles/landing.css';
import './styles/app.css';

// The family dashboard and the parent app are split into their own chunks so
// the landing page and the parent's phone load as little as possible.
const Auth = lazy(() => import('./pages/Auth.jsx'));
const AppShell = lazy(() => import('./pages/app/AppShell.jsx'));
const AppHome = lazy(() => import('./pages/app/AppHome.jsx'));
const NewCircle = lazy(() => import('./pages/app/NewCircle.jsx'));
const CircleDashboard = lazy(() => import('./pages/app/CircleDashboard.jsx'));
const Join = lazy(() => import('./pages/Join.jsx'));
const ParentApp = lazy(() => import('./pages/parent/ParentApp.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: (count, err) => (err?.status >= 400 && err?.status < 500 ? false : count < 2),
    },
  },
});

function PageLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div className="spinner" aria-label="Loading" />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Auth mode="login" />} />
                <Route path="/signup" element={<Auth mode="signup" />} />
                <Route path="/join/:token" element={<Join />} />
                <Route path="/p/*" element={<ParentApp />} />
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<AppHome />} />
                  <Route path="new" element={<NewCircle />} />
                  <Route path="c/:circleId" element={<Navigate to="today" replace />} />
                  <Route path="c/:circleId/:tab" element={<CircleDashboard />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

registerServiceWorker();
