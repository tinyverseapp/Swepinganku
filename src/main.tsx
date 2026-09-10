import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate';
import { TeamMembersPanel } from './components/TeamMembersPanel';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
      <TeamMembersPanel />
    </AuthGate>
  </StrictMode>,
);
