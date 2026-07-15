import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// 初始化主题
const savedTheme = localStorage.getItem('private-workbench-store')
if (savedTheme) {
  try {
    const store = JSON.parse(savedTheme)
    if (store.state?.theme === 'dark') {
      document.documentElement.classList.add('dark')
    }
  } catch {
    // ignore
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
