import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
// 구글 OAuth 프로바이더 임포트
import { GoogleOAuthProvider } from '@react-oauth/google'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 발급받은 클라이언트 ID를 아래에 정확히 붙여넣으세요 */}
    <GoogleOAuthProvider clientId="507901595001-uqajv7bk87pkc9qe40u4ukb4e4fka3go.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)