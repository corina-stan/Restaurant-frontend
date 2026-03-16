import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'

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

    const login = async () => {
        try {
            const res = await api.post('/token/', credentials)
            setToken(res.data.access)
            setLoggedIn(true)
            await loadData(res.data.access)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
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
            loadOrders(token)
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
            setPayingOrder(null)
            setPayingGroup(null)
            setTip(0)
            setPaymentMethod('cash')
            loadOrders(token)
            alert(`Plată înregistrată! Total: ${(getPaymentTotal() + (parseFloat(tip) || 0)).toFixed(2)} lei`)
            if (payingGroup) {
                setPaidGroups(prev => new Set([...prev, payingGroup.id]))
            }
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
                <button style={styles.loginBtn} onClick={login}>Intră</button>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Ospătar</h1>

            {notifications.length > 0 && (
                <div style={styles.notifSection}>
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
                                    <button style={styles.servedBtn} onClick={() => markServed(n.item_id)}>
                                        Servit
                                    </button>
                                )}
                                <button style={styles.dismissBtn} onClick={() => dismissNotification(idx)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <h2 style={styles.subtitle}>Mese</h2>
            <div style={styles.tableGrid}>
                {tables.map(table => {
                    const status = getTableStatus(table.number)
                    const order = getTableOrder(table.number)
                    return (
                        <div
                            key={table.id}
                            style={{
                                ...styles.tableCard,
                                background: getTableStatusColor(status),
                                border: selectedTable?.id === table.id ? '2px solid #2563eb' : '1px solid #e2e8f0'
                            }}
                            onClick={() => setSelectedTable(selectedTable?.id === table.id ? null : table)}
                        >
                            <div style={styles.tableNumber}>Masa {table.number}</div>
                            <div style={styles.tableStatusLabel}>
                                {getTableStatusLabel(table.number)}
                            </div>
                        </div>
                    )
                })}
            </div>

            {selectedTable && (
                <div style={styles.detailPanel}>
                    <div style={styles.detailHeader}>
                        <span style={styles.detailTitle}>Masa {selectedTable.number}</span>
                        <button style={styles.closeBtn} onClick={() => setSelectedTable(null)}>✕</button>
                    </div>

                    {!selectedOrder ? (
                        <div style={styles.freeLabel}>Masă liberă — nicio comandă activă</div>
                    ) : (
                        <>
                            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
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
                                            <div key={group.id} style={{ ...styles.groupSection, opacity: isPaid ? 0.6 : 1 }}>
                                                <div style={styles.groupHeader}>
                                                    <span style={styles.groupName}>
                                                        {group.name}
                                                        {isPaid && <span style={styles.paidBadge}> ✓ Plătit</span>}
                                                    </span>
                                                    <span style={styles.groupTotal}>{groupTotal.toFixed(2)} lei</span>
                                                </div>
                                                {group.items.map(item => (
                                                    <div key={item.id} style={styles.itemRow}>
                                                        <div>
                                                            <span>{item.quantity}x {item.product.name}</span>
                                                            {item.notes && (
                                                                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                                                                    {item.notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span style={{ ...styles.statusPill, background: getStatusColor(item.status) }}>
                                                            {getStatusLabel(item.status)}
                                                        </span>
                                                    </div>
                                                ))}
                                                {!isPaid && (
                                                    <button
                                                        style={styles.groupPayBtn}
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
                                                <div style={styles.orderTotal}>
                                                    {allPaid
                                                        ? 'Toate grupurile au plătit ✓'
                                                        : `Total rămas: ${unpaidTotal.toFixed(2)} lei`
                                                    }
                                                </div>
                                                {!allPaid && (
                                                    <button style={styles.payBtn} onClick={() => openPayment(selectedOrder, null)}>
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
                                        <div key={item.id} style={styles.itemRow}>
                                            <div>
                                                <span>{item.quantity}x {item.product.name}</span>
                                                {item.notes && (
                                                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                                                        {item.notes}
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{ ...styles.statusPill, background: getStatusColor(item.status) }}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                        </div>
                                    ))}
                                    <div style={styles.orderTotal}>
                                        Total: {selectedOrder.items
                                            .filter(i => i.status !== 'rejected')
                                            .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                            .toFixed(2)} lei
                                    </div>
                                    <button style={styles.payBtn} onClick={() => openPayment(selectedOrder, null)}>
                                        Încasează
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {payingOrder && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h2 style={styles.modalTitle}>Notă de plată</h2>
                        <div style={styles.modalTable}>
                            Masa {payingOrder.table_number}
                            {payingGroup && ` — ${payingGroup.name}`}
                        </div>
                        {getPaymentItems().map(item => (
                            <div key={item.id} style={styles.modalItem}>
                                <span>{item.quantity}x {item.product.name}</span>
                                <span>{(item.quantity * parseFloat(item.unit_price)).toFixed(2)} lei</span>
                            </div>
                        ))}
                        <div style={styles.modalDivider} />
                        <div style={styles.modalTotal}>
                            <span>Total consumație:</span>
                            <span>{getPaymentTotal().toFixed(2)} lei</span>
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
                            <span>{(getPaymentTotal() + (parseFloat(tip) || 0)).toFixed(2)} lei</span>
                        </div>
                        <div style={styles.methodRow}>
                            {['cash', 'card', 'ticket'].map(m => (
                                <button
                                    key={m}
                                    style={{ ...styles.methodBtn, ...(paymentMethod === m ? styles.methodBtnActive : {}) }}
                                    onClick={() => setPaymentMethod(m)}
                                >
                                    {m === 'cash' ? '💵 Numerar' : m === 'card' ? '💳 Card' : '🎟️ Tichet'}
                                </button>
                            ))}
                        </div>
                        <button style={styles.confirmBtn} onClick={processPayment}>
                            Confirmă plata
                        </button>
                        <button
                            style={styles.cancelBtn}
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

const styles = {
    loginContainer: { maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' },
    container: { width: '100%', padding: '16px 24px', fontFamily: 'sans-serif', boxSizing: 'border-box' }, title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#1e293b' },
    subtitle: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#334155' },
    input: { display: 'block', width: '100%', padding: '10px 14px', marginBottom: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, boxSizing: 'border-box' },
    loginBtn: { width: '100%', padding: '12px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' },
    notifSection: { marginBottom: 16 },
    notifCard: { background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    notifText: { fontSize: 14, color: '#713f12' },
    notifActions: { display: 'flex', gap: 6 },
    servedBtn: { background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 },
    dismissBtn: { background: '#94a3b8', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 },
    tableGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        justifyContent: 'center'
    },
    tableCard: {
        borderRadius: 10,
        padding: '14px 8px',
        cursor: 'pointer',
        transition: 'all .15s',
        textAlign: 'center',
        minHeight: 70,
        width: 140,
        flexShrink: 0
    }, tableNumber: { fontWeight: 'bold', fontSize: 18, color: '#1e293b', marginBottom: 6 },
    tableStatusLabel: { fontSize: 13, color: '#475569' }, detailPanel: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 8 },
    detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    detailTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' },
    freeLabel: { textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 14 },
    groupSection: { marginBottom: 12, padding: '8px 0', borderBottom: '1px solid #e2e8f0' },
    groupHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
    groupName: { fontWeight: '600', color: '#7c3aed', fontSize: 14 },
    groupTotal: { fontWeight: '600', color: '#1e293b', fontSize: 14 },
    itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f1f5f9' },
    statusPill: { color: 'white', fontSize: 12, padding: '3px 10px', borderRadius: 12, whiteSpace: 'nowrap' },
    orderTotal: { fontWeight: 'bold', marginTop: 10, fontSize: 16, textAlign: 'right' },
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 16 },
    payBtn: { width: '100%', marginTop: 8, padding: '10px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
    groupPayBtn: { width: '100%', marginTop: 6, padding: '7px 0', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
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
    paidBadge: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
}