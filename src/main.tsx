import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AIWindow from './views/ai/AIWindow'
import StudyWindow from './views/study/StudyWindow'
import ContextMenuProvider from './components/ContextMenu'
import ModalProvider from './providers/ModalProvider'
import ToastProvider from './providers/ToastProvider'
import UpdaterProvider from './providers/UpdaterProvider'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Nie znaleziono elementu głównego aplikacji.')

const windowType = new URLSearchParams(window.location.search).get('window')
const content = windowType === 'ai' ? <AIWindow /> : windowType === 'study' ? <StudyWindow /> : <App />

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ContextMenuProvider>
      <ToastProvider>
        <UpdaterProvider>
          {/* ModalProvider renders its portal outside the DOM subtree of App.
              It must stay INSIDE UpdaterProvider so modal content can call useUpdater(). */}
          <ModalProvider>
            {content}
          </ModalProvider>
        </UpdaterProvider>
      </ToastProvider>
    </ContextMenuProvider>
  </React.StrictMode>
)
