import { useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'

export default function BarPage() {
    const [items, setItems] = useState([])
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

            const barItems = []
            ordersRes.data.forEach(order => {
                order.items.forEach(item => {
                    if (
                        item.product.category.department === 'bar' &&
                        ['pending', 'in_progress'].includes(item.status)
                    ) {
                        if (!seenIds.current.has(item.id)) {
                            seenIds.current.add(item.id)
                            barItems.push({
                                item_id: item.id,
                                product_id: item.product.id,
                                product_name: item.product.name,
                                quantity: item.quantity,
                                table_number: order.table_number,
                                notes: item.notes || '',
                                timestamp: order.created_at
                            })
                        }
                    }
                })
            })
            setItems(barItems)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
    }

    useWebSocket(
        'ws://localhost:5173/ws/bar/',
        (data) => {
            if (data.type === 'new_order_item') {
                if (seenIds.current.has(data.item_id)) return
                seenIds.current.add(data.item_id)
                setItems(prev => [...prev, data])
            }
            if (data.type === 'item_status_update') {
                setItems(prev => prev.filter(i => i.item_id !== data.item_id))
            }
        }
    )

    const markReady = async (item) => {
        try {
            await api.patch(
                `/orders/items/${item.item_id}/status/`,
                { status: 'ready' },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setItems(prev => prev.filter(i => i.item_id !== item.item_id))
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const markUnavailable = async (item) => {
        console.log('item:', item)
        try {
            await api.patch(
                `/menu/products/${item.product_id}/toggle_availability/`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setItems(prev => prev.filter(i => i.item_id !== item.item_id))
            alert(`${item.product_name} marcat ca indisponibil în meniu!`)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    if (!loggedIn) {
        return (
            <div style={styles.loginContainer}>
                <h1 style={styles.title}>Bar</h1>
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
            <h1 style={styles.title}>Bar</h1>
            {items.length === 0 ? (
                <div style={styles.empty}>Nicio băutură în așteptare</div>
            ) : (
                items.map((item, idx) => (
                    <div key={idx} style={styles.card}>
                        <div style={styles.cardHeader}>
                            <span style={styles.table}>Masa {item.table_number}</span>
                            <span style={styles.time}>
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div style={styles.product}>
                            {item.quantity}x {item.product_name}
                        </div>
                        {item.notes && (
                            <div style={styles.notes}>Mențiuni: {item.notes}</div>
                        )}
                        <div style={styles.btnRow}>
                            <button
                                style={styles.readyBtn}
                                onClick={() => markReady(item)}
                            >
                                Gata
                            </button>
                            <button
                                style={styles.unavailableBtn}
                                onClick={() => markUnavailable(item)}
                            >
                                Indisponibil
                            </button>
                        </div>
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
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 },
    table: { fontWeight: 'bold', color: '#7c3aed', fontSize: 16 },
    time: { color: '#94a3b8', fontSize: 14 },
    product: { fontSize: 20, fontWeight: '500', marginBottom: 8 },
    notes: { color: '#f59e0b', fontSize: 14, marginBottom: 8 },
    btnRow: { display: 'flex', gap: 8 },
    readyBtn: { flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 15, cursor: 'pointer' },
    unavailableBtn: { flex: 1, background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 15, cursor: 'pointer' },
    input: { display: 'block', width: '100%', padding: '10px 14px', marginBottom: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, boxSizing: 'border-box' },
    loginBtn: { width: '100%', padding: '12px 0', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }
}