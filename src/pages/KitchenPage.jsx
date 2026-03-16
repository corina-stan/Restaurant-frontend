import { useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'

export default function KitchenPage() {
    const [orders, setOrders] = useState({})
    const [loggedIn, setLoggedIn] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [token, setToken] = useState(null)
    const seenIds = useRef(new Set())

    const login = async () => {
        try {
            const res = await api.post('/token/', credentials)
            setToken(res.data.access)
            setLoggedIn(true)

            const ordersRes = await api.get('/orders/', {
                headers: { Authorization: `Bearer ${res.data.access}` }
            })

            const kitchenOrders = {}
            ordersRes.data.forEach(order => {
                order.items.forEach(item => {
                    if (
                        item.product.category.department === 'kitchen' &&
                        ['pending', 'in_progress'].includes(item.status)
                    ) {
                        if (!seenIds.current.has(item.id)) {
                            seenIds.current.add(item.id)
                            if (!kitchenOrders[order.id]) {
                                kitchenOrders[order.id] = {
                                    order_id: order.id,
                                    table_number: order.table_number,
                                    timestamp: order.created_at,
                                    items: []
                                }
                            }
                            kitchenOrders[order.id].items.push({
                                item_id: item.id,
                                product_name: item.product.name,
                                quantity: item.quantity,
                                notes: item.notes || ''
                            })
                        }
                    }
                })
            })
            setOrders(kitchenOrders)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
    }

    useWebSocket(
        'ws://localhost:5173/ws/kitchen/',
        (data) => {
            if (data.type === 'new_order_item') {
                if (seenIds.current.has(data.item_id)) return
                seenIds.current.add(data.item_id)
                setOrders(prev => {
                    const updated = { ...prev }
                    if (!updated[data.order_id]) {
                        updated[data.order_id] = {
                            order_id: data.order_id,
                            table_number: data.table_number,
                            timestamp: data.timestamp,
                            items: []
                        }
                    }
                    updated[data.order_id] = {
                        ...updated[data.order_id],
                        items: [...updated[data.order_id].items, {
                            item_id: data.item_id,
                            product_name: data.product_name,
                            quantity: data.quantity,
                            notes: data.notes || ''
                        }]
                    }
                    return updated
                })
            }
            if (data.type === 'item_status_update') {
                setOrders(prev => {
                    const updated = { ...prev }
                    Object.keys(updated).forEach(orderId => {
                        updated[orderId] = {
                            ...updated[orderId],
                            items: updated[orderId].items.filter(i => i.item_id !== data.item_id)
                        }
                        if (updated[orderId].items.length === 0) {
                            delete updated[orderId]
                        }
                    })
                    return updated
                })
            }
        }
    )

    const markReady = async (itemId, orderId) => {
        try {
            await api.patch(
                `/orders/items/${itemId}/status/`,
                { status: 'ready' },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setOrders(prev => {
                const updated = { ...prev }
                if (updated[orderId]) {
                    updated[orderId] = {
                        ...updated[orderId],
                        items: updated[orderId].items.filter(i => i.item_id !== itemId)
                    }
                    if (updated[orderId].items.length === 0) {
                        delete updated[orderId]
                    }
                }
                return updated
            })
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    if (!loggedIn) {
        return (
            <div style={styles.loginContainer}>
                <h1 style={styles.title}>Bucătărie</h1>
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

    const orderList = Object.values(orders)

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Bucătărie</h1>
            {orderList.length === 0 ? (
                <div style={styles.empty}>Nicio comandă în așteptare</div>
            ) : (
                orderList.map(order => (
                    <div key={order.order_id} style={styles.card}>
                        <div style={styles.cardHeader}>
                            <span style={styles.table}>Masa {order.table_number}</span>
                            <span style={styles.time}>
                                {new Date(order.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        {order.items.map(item => (
                            <div key={item.item_id} style={styles.itemRow}>
                                <div style={{ flex: 1 }}>
                                    <span style={styles.itemName}>
                                        {item.quantity}x {item.product_name}
                                    </span>
                                    {item.notes && (
                                        <div style={styles.itemNotes}>Mențiuni: {item.notes}</div>
                                    )}
                                </div>
                                <button
                                    style={styles.readyBtn}
                                    onClick={() => markReady(item.item_id, order.order_id)}
                                >
                                    Gata
                                </button>
                            </div>
                        ))}
                    </div>
                ))
            )}
        </div>
    )
}

const styles = {
    loginContainer: { maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'sans-serif', textAlign: 'center' },
    container: { maxWidth: 600, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#1e293b' },
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 18 },
    card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
    table: { fontWeight: 'bold', color: '#2563eb', fontSize: 16 },
    time: { color: '#94a3b8', fontSize: 14 },
    itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' },
    itemName: { fontSize: 16, fontWeight: '500' },
    itemNotes: { color: '#f59e0b', fontSize: 12, marginTop: 2 },
    readyBtn: { background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '6px 16px', fontSize: 14, cursor: 'pointer', marginLeft: 8 },
    input: { display: 'block', width: '100%', padding: '10px 14px', marginBottom: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, boxSizing: 'border-box' },
    loginBtn: { width: '100%', padding: '12px 0', background: '#1e293b', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }
}