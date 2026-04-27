import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/manrope/wght.css'
import '@fontsource/material-symbols-outlined/400.css'
import { YoboErrorBoundary } from './components/YoboErrorBoundary'
import { YoboVirtualKeyboardProvider } from './components/YoboVirtualKeyboard'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <YoboErrorBoundary>
      <YoboVirtualKeyboardProvider>
        <App />
      </YoboVirtualKeyboardProvider>
    </YoboErrorBoundary>
  </StrictMode>,
)
