import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { MusicPlayerProvider } from './contexts/MusicPlayerContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <MusicPlayerProvider>
        <App />
      </MusicPlayerProvider>
    </HashRouter>
  </React.StrictMode>,
)
