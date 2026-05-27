import React from 'react'
import ReactDOM from 'react-dom/client'
import { inject } from '@vercel/analytics'
import App from './App.tsx'
import './index.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'

inject()

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          fontFamily: 'Manrope, sans-serif',
          padding: 24,
        }}>
          <h1 style={{ color: '#306770', fontSize: 22, marginBottom: 12 }}>WANDER/WORK</h1>
          <p style={{ color: '#787878', marginBottom: 8 }}>Something went wrong. Open the browser console (F12) for details.</p>
          <pre style={{
            background: '#fff',
            border: '1px solid #DCDCDC',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 12,
            color: '#c0392b',
            maxWidth: 600,
            overflow: 'auto',
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              borderRadius: 8,
              background: '#306770',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Manrope',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
