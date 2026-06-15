import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SettingsApp from './SettingsApp.jsx'

// Which window is this? Settings window is opened with ?window=settings
const params = new URLSearchParams(window.location.search);
const isSettings = params.get('window') === 'settings';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isSettings ? <SettingsApp /> : <App />}
  </StrictMode>,
)
