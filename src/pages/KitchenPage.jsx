import { useState, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'

export default function KitchenPage() {
    const [items, setItems] = useState([])
    const seenIds = useRef(new Set())

    useWebSocket(
        'ws://localhost:5173/ws/kitchen/',
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
            const tokenRes = await api.post('/token/', {
                username: 'admin',
                password: 'admin1234'
            })
            await api.patch(
                `/orders/items/${item.item_id}/status/`,
                { status: 'ready' },
                { headers: { Authorization: `Bearer ${tokenRes.data.access}` } }
            )
            setItems(prev => prev.filter(i => i.item_id !== item.item_id))
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Bucătărie</h1>
            {items.length === 0 ? (
                <div style={styles.empty}>Nicio comandă în așteptare</div>
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
                        <button
                            style={styles.readyBtn}
                            onClick={() => markReady(item)}
                        >
                            Marchează gata
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

const styles = {
    container: { maxWidth: 600, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#1e293b' },
    empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 18 },
    card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 },
    table: { fontWeight: 'bold', color: '#2563eb', fontSize: 16 },
    time: { color: '#94a3b8', fontSize: 14 },
    product: { fontSize: 20, fontWeight: '500', marginBottom: 8 },
    notes: { color: '#f59e0b', fontSize: 14, marginBottom: 8 },
    readyBtn: { width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 16, cursor: 'pointer' }
}