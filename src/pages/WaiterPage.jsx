import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'
import '../DesktopLayout.css'

export default function WaiterPage() {
    const [tables, setTables] = useState([])
    const [orders, setOrders] = useState([])
    const [notifications, setNotifications] = useState([])
    const [token, setToken] = useState(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [selectedTable, setSelectedTable] = useState(null)
    const [payingOrder, setPayingOrder] = useState(null)
    const [payingGroup, setPayingGroup] = useState(null)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [tip, setTip] = useState(0)
    const [paidGroups, setPaidGroups] = useState(new Set())
    const [username, setUsername] = useState(sessionStorage.getItem('waiter_username') || '')

    useEffect(() => {
        const savedToken = sessionStorage.getItem('access_token')
        if (savedToken) {
            setToken(savedToken)
            setLoggedIn(true)
            loadData(savedToken)
        }
    }, [])

    const login = async () => {
        try {
            const res = await api.post('/token/', credentials)
            const payload = JSON.parse(atob(res.data.access.split('.')[1]))

            if (payload.role !== 'waiter' && !payload.is_superuser) {
                alert('Nu ai permisiunea de a accesa interfața ospătar!')
                return
            }

            sessionStorage.setItem('access_token', res.data.access)
            sessionStorage.setItem('refresh_token', res.data.refresh)
            sessionStorage.setItem('waiter_username', credentials.username)
            setToken(res.data.access)
            setLoggedIn(true)
            setUsername(credentials.username)
            await loadData(res.data.access)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
    }

    const logout = () => {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('refresh_token')
        sessionStorage.removeItem('waiter_username')
        setToken(null)
        setLoggedIn(false)
        setOrders([])
        setTables([])
        setNotifications([])
        setUsername('')
    }

    const loadData = async (accessToken) => {
        try {
            const [tablesRes, ordersRes] = await Promise.all([
                api.get('/tables/all/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/orders/', { headers: { Authorization: `Bearer ${accessToken}` } })
            ])
            setTables(tablesRes.data)
            setOrders(ordersRes.data)

            const paidGroupIds = new Set()
            ordersRes.data.forEach(order => {
                order.payments?.forEach(payment => {
                    if (payment.group && payment.status === 'completed') {
                        paidGroupIds.add(payment.group)
                    }
                })
            })
            setPaidGroups(paidGroupIds)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const loadOrders = async (accessToken) => {
        try {
            const res = await api.get('/orders/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            setOrders(res.data)
        } catch (err) {
            console.error('Eroare:', err)
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
                if (token) loadOrders(token)
            }
            if (data.type === 'product_availability') {
                if (!data.is_available) {
                    setOrders(prev => prev.map(order => ({
                        ...order,
                        items: order.items.map(item =>
                            item.product.id === data.product_id
                                ? { ...item, status: 'rejected', rejection_reason: 'Produs indisponibil' }
                                : item
                        )
                    })))
                }
            }
            if (data.type === 'item_status_update') {
                if (data.status === 'served' || data.status === 'rejected') {
                    setNotifications(prev => prev.filter(n => n.item_id !== data.item_id))
                }
                if (token) loadOrders(token)
            }
            if (data.type === 'payment_completed') {
                if (token) loadOrders(token)
            }
        }
    )

    const getTableOrder = (tableNumber) => {
        return orders.find(o => o.table_number === tableNumber && o.status === 'open')
    }

    const getTableStatus = (tableNumber) => {
        const order = getTableOrder(tableNumber)
        if (!order) return 'free'
        const hasReady = order.items.some(i => i.status === 'ready')
        const allServed = order.items.every(i => ['served', 'rejected'].includes(i.status))
        if (hasReady) return 'ready'
        if (allServed) return 'served'
        return 'active'
    }

    const getTableStatusColor = (status) => {
        const colors = {
            free: '#e2e8f0',
            active: '#bfdbfe',
            ready: '#bbf7d0',
            served: '#f1f5f9'
        }
        return colors[status] || '#e2e8f0'
    }

    const getTableStatusLabel = (tableNumber) => {
        const order = getTableOrder(tableNumber)
        if (!order) return 'Liberă'
        const readyCount = order.items.filter(i => i.status === 'ready').length
        if (readyCount > 0) return `⚠ ${readyCount} item${readyCount > 1 ? 'e' : ''} gata`
        const total = order.items
            .filter(i => i.status !== 'rejected')
            .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
        return `${order.items.length} iteme • ${total.toFixed(2)} lei`
    }

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
            await loadOrders(token)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const openPayment = (order, group = null) => {
        setPayingOrder(order)
        setPayingGroup(group)
        setTip(0)
        setPaymentMethod('cash')
    }

    const getPaymentItems = () => {
        if (!payingOrder) return []
        if (payingGroup) return payingGroup.items.filter(i => i.status !== 'rejected')
        return payingOrder.groups
            ? payingOrder.groups
                .filter(g => !paidGroups.has(g.id))
                .flatMap(g => g.items)
                .filter(i => i.status !== 'rejected')
            : payingOrder.items.filter(i => i.status !== 'rejected')
    }

    const getPaymentTotal = () => {
        return getPaymentItems().reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
    }

    const processPayment = async () => {
        const items = getPaymentItems()
        const unserved = items.filter(i => !['served', 'rejected'].includes(i.status))
        if (unserved.length > 0) {
            const ok = window.confirm(
                `Atenție! Produse neservite:\n${unserved.map(i => i.product.name).join(', ')}\n\nContinui?`
            )
            if (!ok) return
        }
        try {
            const payload = {
                order_id: payingOrder.id,
                method: paymentMethod,
                tip: parseFloat(tip) || 0
            }
            if (payingGroup) payload.group_id = payingGroup.id

            await api.post('/payments/create/', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (payingGroup) {
                setPaidGroups(prev => new Set([...prev, payingGroup.id]))
            }

            setPayingOrder(null)
            setPayingGroup(null)
            setTip(0)
            setPaymentMethod('cash')
            loadOrders(token)
            alert(`Plată înregistrată! Total: ${(getPaymentTotal() + (parseFloat(tip) || 0)).toFixed(2)} lei`)
        } catch (err) {
            console.error('Eroare plată:', err)
            alert('Eroare la înregistrarea plății!')
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

    const selectedOrder = selectedTable ? getTableOrder(selectedTable.number) : null

    if (!loggedIn) {
        return (
            <div className="login-screen">
                <div className="login-box">
                    <h1 className="page-title" style={{ marginBottom: '24px' }}>Ospătar</h1>
                    <input
                        className="login-input"
                        placeholder="Username"
                        value={credentials.username}
                        onChange={e => setCredentials(p => ({ ...p, username: e.target.value }))}
                    />
                    <input
                        className="login-input"
                        type="password"
                        placeholder="Parolă"
                        value={credentials.password}
                        onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))}
                    />
                    <button className="login-btn" onClick={login}>Intră</button>
                </div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title" style={{ marginBottom: 0 }}>Ospătar</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 15, color: '#475569', fontWeight: '600' }}>👤 {username}</span>
                    <button className="logout-btn" onClick={logout}>Logout</button>
                </div>
            </div>

            {notifications.length > 0 && (
                <div className="notif-section">
                    {notifications.map((n, idx) => (
                        <div key={idx} className="notif-card">
                            <div className="notif-text">
                                {n.type === 'item_ready'
                                    ? `✅ ${n.product_name} — Masa ${n.table_number} e gata!`
                                    : `🔔 Masa ${n.table_number} cere asistență`
                                }
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {n.type === 'item_ready' && (
                                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => markServed(n.item_id)}>
                                        Servit
                                    </button>
                                )}
                                <button className="logout-btn" style={{ padding: '6px 12px' }} onClick={() => dismissNotification(idx)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="split-view">
                <div className="tables-section">
                    <h2 style={{ fontSize: '24px', color: '#1e293b', marginBottom: '20px', fontWeight: '700' }}>Mese</h2>
                    <div className="table-grid">
                        {tables.map(table => {
                            const status = getTableStatus(table.number)
                            const isSelected = selectedTable?.id === table.id
                            return (
                                <div
                                    key={table.id}
                                    className={`table-card ${isSelected ? 'selected' : ''}`}
                                    style={{ background: getTableStatusColor(status) }}
                                    onClick={() => setSelectedTable(isSelected ? null : table)}
                                >
                                    <div className="number">Masa {table.number}</div>
                                    <div className="status">
                                        {getTableStatusLabel(table.number)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="details-panel" style={{ display: selectedTable ? 'block' : 'none' }}>
                    {selectedTable && (
                        <>
                            <div className="detail-header">
                                <span className="detail-title">Masa {selectedTable.number}</span>
                                <button className="close-btn" onClick={() => setSelectedTable(null)}>✕</button>
                            </div>

                            {!selectedOrder ? (
                                <div className="empty-state" style={{ border: 'none', padding: '40px 0', margin: 0 }}>Masă liberă — nicio comandă activă</div>
                            ) : (
                                <>
                                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 24, fontWeight: '500' }}>
                                        Comandă din {new Date(selectedOrder.created_at).toLocaleTimeString()}
                                    </div>

                                    {selectedOrder.groups && selectedOrder.groups.length > 0 ? (
                                        <>
                                            {selectedOrder.groups.map(group => {
                                                const isPaid = paidGroups.has(group.id)
                                                const groupTotal = group.items
                                                    .filter(i => i.status !== 'rejected')
                                                    .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                                return (
                                                    <div key={group.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #f1f5f9', opacity: isPaid ? 0.6 : 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                            <span style={{ fontWeight: '700', color: '#4f46e5', fontSize: 16 }}>
                                                                {group.name}
                                                                {isPaid && <span style={{ color: '#10b981', marginLeft: 8 }}>✓ Plătit</span>}
                                                            </span>
                                                            <span style={{ fontWeight: '700', color: '#0f172a', fontSize: 16 }}>{groupTotal.toFixed(2)} lei</span>
                                                        </div>
                                                        {group.items.map(item => (
                                                            <div key={item.id} className="card-item-row">
                                                                <div>
                                                                    <span style={{ fontWeight: '600' }}>{item.quantity}x {item.product.name}</span>
                                                                    {item.notes && (
                                                                        <div className="item-notes" style={{ display: 'block', marginTop: 4 }}>
                                                                            {item.notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="status-pill" style={{ background: getStatusColor(item.status) }}>
                                                                    {getStatusLabel(item.status)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {!isPaid && (
                                                            <button
                                                                className="btn-primary"
                                                                style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                                                                onClick={() => openPayment(selectedOrder, group)}
                                                            >
                                                                Încasează {group.name}
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {(() => {
                                                const unpaidGroups = selectedOrder.groups.filter(g => !paidGroups.has(g.id))
                                                const unpaidTotal = unpaidGroups
                                                    .flatMap(g => g.items)
                                                    .filter(i => i.status !== 'rejected')
                                                    .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                                const allPaid = unpaidGroups.length === 0
                                                return (
                                                    <>
                                                        <div style={{ fontWeight: '800', marginTop: 24, fontSize: 20, textAlign: 'right', color: '#0f172a' }}>
                                                            {allPaid
                                                                ? 'Toate grupurile au plătit ✓'
                                                                : `Total rămas: ${unpaidTotal.toFixed(2)} lei`
                                                            }
                                                        </div>
                                                        {!allPaid && (
                                                            <button className="btn-primary" style={{ width: '100%', marginTop: 16, fontSize: 16 }} onClick={() => openPayment(selectedOrder, null)}>
                                                                Încasează tot ({unpaidGroups.length > 1 ? `${unpaidGroups.length} grupuri` : unpaidGroups[0]?.name})
                                                            </button>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </>
                                    ) : (
                                        <>
                                            {selectedOrder.items.map(item => (
                                                <div key={item.id} className="card-item-row">
                                                    <div>
                                                        <span style={{ fontWeight: '600' }}>{item.quantity}x {item.product.name}</span>
                                                        {item.notes && (
                                                            <div className="item-notes" style={{ display: 'block', marginTop: 4 }}>
                                                                {item.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="status-pill" style={{ background: getStatusColor(item.status) }}>
                                                        {getStatusLabel(item.status)}
                                                    </span>
                                                </div>
                                            ))}
                                            <div style={{ fontWeight: '800', marginTop: 24, fontSize: 20, textAlign: 'right', color: '#0f172a' }}>
                                                Total: {selectedOrder.items
                                                    .filter(i => i.status !== 'rejected')
                                                    .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                                    .toFixed(2)} lei
                                            </div>
                                            <button className="btn-primary" style={{ width: '100%', marginTop: 16, fontSize: 16 }} onClick={() => openPayment(selectedOrder, null)}>
                                                Încasează
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {payingOrder && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{ fontSize: 24, fontWeight: '800', marginBottom: 8, color: '#0f172a' }}>Notă de plată</h2>
                        <div style={{ color: '#4f46e5', fontWeight: '700', marginBottom: 24, fontSize: 16 }}>
                            Masa {payingOrder.table_number}
                            {payingGroup && ` — ${payingGroup.name}`}
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 16, paddingRight: 8 }}>
                            {getPaymentItems().map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, borderBottom: '1px solid #f1f5f9' }}>
                                    <span style={{ fontWeight: '500' }}>{item.quantity}x {item.product.name}</span>
                                    <span style={{ fontWeight: '600' }}>{(item.quantity * parseFloat(item.unit_price)).toFixed(2)} lei</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ borderTop: '2px solid #e2e8f0', margin: '16px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: 16, marginBottom: 16 }}>
                            <span>Total consumație:</span>
                            <span>{getPaymentTotal().toFixed(2)} lei</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <span style={{ fontWeight: '600' }}>Bacșiș:</span>
                            <input
                                type="number"
                                min="0"
                                style={{ width: 80, padding: '8px 12px', borderRadius: 10, border: '2px solid #cbd5e1', fontSize: 16, outline: 'none' }}
                                value={tip}
                                onChange={e => setTip(e.target.value)}
                                placeholder="0"
                            />
                            <span style={{ fontWeight: '600' }}>lei</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: 20, marginBottom: 24, color: '#0f172a' }}>
                            <span>Total de plată:</span>
                            <span style={{ color: '#10b981' }}>{(getPaymentTotal() + (parseFloat(tip) || 0)).toFixed(2)} lei</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                            {['cash', 'card', 'ticket'].map(m => (
                                <button
                                    key={m}
                                    style={{
                                        flex: 1, padding: '12px 0', borderRadius: 12,
                                        border: paymentMethod === m ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                                        background: paymentMethod === m ? '#e0e7ff' : '#f8fafc',
                                        color: paymentMethod === m ? '#4f46e5' : '#475569',
                                        fontWeight: '700', cursor: 'pointer', fontSize: 14,
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setPaymentMethod(m)}
                                >
                                    {m === 'cash' ? '💵 Numerar' : m === 'card' ? '💳 Card' : '🎟️ Tichet'}
                                </button>
                            ))}
                        </div>
                        <button className="btn-primary" style={{ width: '100%', marginBottom: 12, fontSize: 16, padding: '14px 0' }} onClick={processPayment}>
                            Confirmă plata
                        </button>
                        <button
                            className="logout-btn"
                            style={{ width: '100%', fontSize: 16, padding: '14px 0' }}
                            onClick={() => { setPayingOrder(null); setPayingGroup(null) }}
                        >
                            Anulează
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}