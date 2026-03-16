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
    const [payingOrder, setPayingOrder] = useState(null)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [tip, setTip] = useState(0)

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
                if (token) loadOrders(token)
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

    const processPayment = async (order) => {
        const unservedItems = order.items.filter(
            i => !['served', 'rejected'].includes(i.status)
        )

        if (unservedItems.length > 0) {
            const names = unservedItems.map(i => i.product.name).join(', ')
            const confirm = window.confirm(
                `Atenție! Următoarele produse nu sunt încă servite:\n${names}\n\nDorești să continui cu încasarea?`
            )
            if (!confirm) return
        }

        try {
            await api.post(
                '/payments/create/',
                {
                    order_id: order.id,
                    method: paymentMethod,
                    tip: parseFloat(tip) || 0
                },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setPayingOrder(null)
            setTip(0)
            setPaymentMethod('cash')
            loadOrders(token)
            alert(`Plată înregistrată! Total: ${(parseFloat(order.total) + (parseFloat(tip) || 0)).toFixed(2)} lei`)
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
                                <div>
                                    <span>{item.quantity}x {item.product.name}</span>
                                    {item.notes && (
                                        <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                                <span style={{
                                    ...styles.statusPill,
                                    background: getStatusColor(item.status)
                                }}>
                                    {getStatusLabel(item.status)}
                                </span>
                            </div>
                        ))}
                        <div style={styles.orderTotal}>
                            Total: {order.items
                                .filter(i => i.status !== 'rejected')
                                .reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
                                .toFixed(2)} lei
                        </div>
                        <button
                            style={styles.payBtn}
                            onClick={() => {
                                setPayingOrder(order)
                                setTip(0)
                                setPaymentMethod('cash')
                            }}
                        >
                            Încasează
                        </button>
                    </div>
                ))
            )}

            {payingOrder && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h2 style={styles.modalTitle}>Notă de plată</h2>
                        <div style={styles.modalTable}>Masa {payingOrder.table_number}</div>

                        {payingOrder.items
                            .filter(i => i.status !== 'rejected')
                            .map(item => (
                                <div key={item.id} style={styles.modalItem}>
                                    <span>{item.quantity}x {item.product.name}</span>
                                    <span>{(item.quantity * item.unit_price).toFixed(2)} lei</span>
                                </div>
                            ))
                        }

                        <div style={styles.modalDivider} />

                        <div style={styles.modalTotal}>
                            <span>Total consumație:</span>
                            <span>{payingOrder.total} lei</span>
                        </div>

                        <div style={styles.modalRow}>
                            <span>Bacșiș:</span>
                            <input
                                type="number"
                                min="0"
                                style={styles.tipInput}
                                value={tip}
                                onChange={e => setTip(e.target.value)}
                                placeholder="0"
                            />
                            <span>lei</span>
                        </div>

                        <div style={styles.modalTotal}>
                            <span>Total de plată:</span>
                            <span>{(parseFloat(payingOrder.total) + (parseFloat(tip) || 0)).toFixed(2)} lei</span>
                        </div>

                        <div style={styles.methodRow}>
                            {['cash', 'card', 'ticket'].map(m => (
                                <button
                                    key={m}
                                    style={{
                                        ...styles.methodBtn,
                                        ...(paymentMethod === m ? styles.methodBtnActive : {})
                                    }}
                                    onClick={() => setPaymentMethod(m)}
                                >
                                    {m === 'cash' ? '💵 Numerar' : m === 'card' ? '💳 Card' : '🎟️ Tichet'}
                                </button>
                            ))}
                        </div>

                        <button
                            style={styles.confirmBtn}
                            onClick={() => processPayment(payingOrder)}
                        >
                            Confirmă plata
                        </button>
                        <button
                            style={styles.cancelBtn}
                            onClick={() => setPayingOrder(null)}
                        >
                            Anulează
                        </button>
                    </div>
                </div>
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
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 16 },
    payBtn: { width: '100%', marginTop: 8, padding: '10px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#1e293b' },
    modalTable: { color: '#2563eb', fontWeight: '600', marginBottom: 16 },
    modalItem: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 },
    modalDivider: { borderTop: '1px solid #e2e8f0', margin: '12px 0' },
    modalTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 16, marginBottom: 12 },
    modalRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
    tipInput: { width: 70, padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16 },
    methodRow: { display: 'flex', gap: 8, marginBottom: 16 },
    methodBtn: { flex: 1, padding: '8px 0', borderRadius: 8, border: '2px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13 },
    methodBtnActive: { border: '2px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontWeight: '600' },
    confirmBtn: { width: '100%', padding: '12px 0', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 16, cursor: 'pointer', marginBottom: 8 },
    cancelBtn: { width: '100%', padding: '10px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 10, fontSize: 15, cursor: 'pointer' },
}