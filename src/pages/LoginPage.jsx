import { useState } from 'react'
import api from '../api/axios'
import './LoginPage.css'

export default function LoginPage() {
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        if (!credentials.username.trim() || !credentials.password) {
            setError('Te rugăm să completezi utilizatorul și parola.')
            return
        }

        setError('')
        setLoading(true)

        try {
            const res = await api.post('/token/', credentials)
            const token = res.data.access
            const refresh = res.data.refresh
            
            // Decode the JWT token payload
            const payload = JSON.parse(atob(token.split('.')[1]))
            const role = payload.role
            const isSuperuser = payload.is_superuser
            
            // Clean up any stale tokens first to avoid cross-role issues
            sessionStorage.removeItem('admin_token')
            sessionStorage.removeItem('access_token')
            sessionStorage.removeItem('refresh_token')
            sessionStorage.removeItem('kitchen_token')
            sessionStorage.removeItem('bar_token')
            sessionStorage.removeItem('waiter_username')

            if (isSuperuser || role === 'admin') {
                sessionStorage.setItem('admin_token', token)
                window.location.replace('/dashboard')
            } else if (role === 'waiter') {
                sessionStorage.setItem('access_token', token)
                sessionStorage.setItem('refresh_token', refresh)
                sessionStorage.setItem('waiter_username', credentials.username)
                window.location.replace('/waiter')
            } else if (role === 'kitchen') {
                sessionStorage.setItem('kitchen_token', token)
                window.location.replace('/kitchen')
            } else if (role === 'barman') {
                sessionStorage.setItem('bar_token', token)
                window.location.replace('/bar')
            } else {
                setError('Acest cont nu are un rol valid asociat.')
            }
        } catch (err) {
            console.error('Eroare login:', err)
            setError('Nume de utilizator sau parolă incorectă!')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="premium-login-container">
            <div className="premium-login-bg-glow"></div>
            <div className="premium-login-card">
                <div className="premium-login-header">
                    <div className="premium-login-icon">🍽️</div>
                    <h1 className="premium-login-title">Platformă Restaurant</h1>
                    <p className="premium-login-subtitle">Introduceți credențialele pentru a vă accesa contul</p>
                </div>

                <form onSubmit={handleLogin} className="premium-login-form" autoComplete="off">
                    {error && (
                        <div className="premium-login-error">
                            <span className="premium-login-error-icon">⚠️</span>
                            <span className="premium-login-error-text">{error}</span>
                        </div>
                    )}

                    <div className="premium-login-input-group">
                        <label className="premium-login-label" htmlFor="username">Utilizator</label>
                        <div className="premium-login-input-wrapper">
                            <span className="premium-login-field-icon">👤</span>
                            <input
                                id="username"
                                type="text"
                                className="premium-login-input"
                                placeholder="ex: ospatar1, admin, barman"
                                value={credentials.username}
                                onChange={e => setCredentials(p => ({ ...p, username: e.target.value }))}
                                disabled={loading}
                                autoComplete="off"
                            />
                        </div>
                    </div>

                    <div className="premium-login-input-group">
                        <label className="premium-login-label" htmlFor="password">Parolă</label>
                        <div className="premium-login-input-wrapper">
                            <span className="premium-login-field-icon">🔒</span>
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                className="premium-login-input"
                                placeholder="••••••••"
                                value={credentials.password}
                                onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))}
                                disabled={loading}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="premium-login-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                                aria-label={showPassword ? "Ascunde parola" : "Afișează parola"}
                            >
                                {showPassword ? "👁️" : "🙈"}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={`premium-login-submit ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="premium-login-spinner"></span>
                        ) : (
                            'Autentificare'
                        )}
                    </button>
                </form>
            </div>
            <div className="premium-login-footer">
                © {new Date().getFullYear()} Sistem Gestiune Restaurant. Toate drepturile rezervate.
            </div>
        </div>
    )
}
