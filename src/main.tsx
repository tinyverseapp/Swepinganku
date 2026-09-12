import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate';
import { AdminOwnerShell } from './components/AdminOwnerShell';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <AdminOwnerShell>
        <App />
      </AdminOwnerShell>
    </AuthGate>
  </StrictMode>,
);
