import React from 'react';
import { createRoot } from 'react-dom/client';
import AccountTracker from './AccountTracker.jsx';
import './styles.css';

// localStorage-backed storage shim exposing the async window.storage API the
// app uses. All keys are namespaced with the "att_" prefix. Defined before the
// first render so the load effect can read it.
window.storage = {
  get: async (key) => {
    try {
      const v = localStorage.getItem('att_' + key);
      return v === null ? null : { value: v };
    } catch (e) { return null; }
  },
  set: async (key, value) => {
    try { localStorage.setItem('att_' + key, value); } catch (e) {}
  },
  remove: async (key) => {
    try { localStorage.removeItem('att_' + key); } catch (e) {}
  },
};

createRoot(document.getElementById('root')).render(<AccountTracker />);
