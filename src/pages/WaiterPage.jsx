import { useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'

export default function WaiterPage() {
    const [orders, setOrders] = useState([])
    const [notifications, setNotifications] = useState([])
    const [token, setToken] = useState(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const seenOrderIds = useRef(new Set())

    const login = async () => {
        try {
            const res = await api.post('/token/', credentials)
            setToken(res.data.access)
            setLoggedIn(true)
            loadOrders(res.data.access)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
    }

    const loadOrders = async (accessToken) => {
        try {
            const res = await api.get('/orders/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            setOrders(res.data)
        } catch (err) {
            console.error('Eroare încărcare comenzi:', err)
        }
    }

    useWebSocket(
        'ws://localhost:5173/ws/waiters/',
        (data) => {
            if (data.type === 'item_ready') {
                setNotifications(prev => {
                    const exists = prev.find(n => n.item_id === data.item_id)
                    if (exists) return prev
                    return [data, ...prev]
                })
                if (token) loadOrders(token)
            }
            if (data.type === 'assistance_requested') {
                setNotifications(prev => [data, ...prev])
            }
            if (data.type === 'new_order') {
                loadOrders(token)
            }
            if (data.type === 'product_availability') {
                if (!data.is_available) {
                    setOrders(prev => prev.map(order => ({
                        ...order,
                        items: order.items.map(item =>
                            item.product.id === data.product_id
                                ? {
                                    ...item,
                                    status: 'rejected',
                                    rejection_reason: 'Produs indisponibil'
                                }
                                : item
                        )
                    })))
                }
            }
        }
    )

    const dismissNotification = (idx) => {
        setNotifications(prev => prev.filter((_, i) => i !== idx))
    }

    const markServed = async (itemId) => {
        try {
            await api.patch(
                `/orders/items/${itemId}/status/`,
                { status: 'served' },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setNotifications(prev => prev.filter(n => n.item_id !== itemId))
            loadOrders(token)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const getStatusLabel = (status) => {
        const labels = {
            pending: '⏳ Așteptare',
            in_progress: '👨‍🍳 Preparare',
            ready: '✅ Gata',
            served: '🍽️ Servit',
            rejected: '❌ Refuzat'
        }
        return labels[status] || status
    }

    const getStatusColor = (status) => {
        const colors = {
            pending: '#94a3b8',
            in_progress: '#f59e0b',
            ready: '#16a34a',
            served: '#2563eb',
            rejected: '#ef4444'
        }
        return colors[status] || '#94a3b8'
    }

    if (!loggedIn) {
        return (
            <div style={styles.loginContainer}>
                <h1 style={styles.title}>Ospătar</h1>
                <input
                    style={styles.input}
                    placeholder="Username"
                    value={credentials.username}
                    onChange={e => setCredentials(p => ({ ...p, username: e.target.value }))}
                />
                <input
                    style={styles.input}
                    type="password"
                    placeholder="Parolă"
                    value={credentials.password}
                    onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))}
                />
                <button style={styles.loginBtn} onClick={login}>
                    Intră
                </button>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Ospătar</h1>

            {notifications.length > 0 && (
                <div style={styles.notifSection}>
                    <h2 style={styles.subtitle}>Notificări</h2>
                    {notifications.map((n, idx) => (
                        <div key={idx} style={styles.notifCard}>
                            <div style={styles.notifText}>
                                {n.type === 'item_ready'
                                    ? `✅ ${n.product_name} — Masa ${n.table_number} e gata!`
                                    : `🔔 Masa ${n.table_number} cere asistență`
                                }
                            </div>
                            <div style={styles.notifActions}>
                                {n.type === 'item_ready' && (
                                    <button
                                        style={styles.servedBtn}
                                        onClick={() => markServed(n.item_id)}
                                    >
                                        Marchează servit
                                    </button>
                                )}
                                <button
                                    style={styles.dismissBtn}
                                    onClick={() => dismissNotification(idx)}
                                >
                                    Închide
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <h2 style={styles.subtitle}>Comenzi active</h2>
            {orders.length === 0 ? (
                <div style={styles.empty}>Nicio comandă activă</div>
            ) : (
                orders.map(order => (
                    <div key={order.id} style={styles.orderCard}>
                        <div style={styles.orderHeader}>
                            <span style={styles.tableLabel}>Masa {order.table_number}</span>
                            <span style={styles.orderTime}>
                                {new Date(order.created_at).toLocaleTimeString()}
                            </span>
                        </div>
                        {order.notes && (
                            <div style={styles.orderNotes}>Mențiuni: {order.notes}</div>
                        )}
                        {order.items.map(item => (
                            <div key={item.id} style={styles.itemRow}>
                                <span>{item.quantity}x {item.product.name}</span>
                                <span style={{
                                    ...styles.statusPill,
                                    background: getStatusColor(item.status)
                                }}>
                                    {getStatusLabel(item.status)}
                                </span>
                            </div>
                        ))}
                        <div style={styles.orderTotal}>
                            Total: {order.total} lei
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

const styles = {
    loginContainer: { maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' },
    container: { maxWidth: 640, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, color: '#1e293b' },
    subtitle: { fontSize: 20, fontWeight: '600', marginBottom: 12, color: '#334155' },
    input: { display: 'block', width: '100%', padding: '10px 14px', marginBottom: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, boxSizing: 'border-box' },
    loginBtn: { width: '100%', padding: '12px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' },
    notifSection: { marginBottom: 24 },
    notifCard: { background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: 14, marginBottom: 8 },
    notifText: { fontSize: 15, marginBottom: 8, color: '#713f12' },
    notifActions: { display: 'flex', gap: 8 },
    servedBtn: { background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
    dismissBtn: { background: '#94a3b8', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 },
    orderCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 },
    orderHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 },
    tableLabel: { fontWeight: 'bold', color: '#2563eb', fontSize: 16 },
    orderTime: { color: '#94a3b8', fontSize: 13 },
    orderNotes: { color: '#f59e0b', fontSize: 13, marginBottom: 8 },
    itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f1f5f9' },
    statusPill: { color: 'white', fontSize: 12, padding: '3px 10px', borderRadius: 12 },
    orderTotal: { fontWeight: 'bold', marginTop: 10, fontSize: 16, textAlign: 'right' },
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 16 }
}