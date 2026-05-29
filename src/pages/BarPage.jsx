import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'
import '../DesktopLayout.css'

export default function BarPage() {
    const [items, setItems] = useState([])
    const [loggedIn, setLoggedIn] = useState(false)
    const [token, setToken] = useState(null)
    const seenIds = useRef(new Set())

    const loadBarOrders = async (accessToken) => {
        try {
            const ordersRes = await api.get('/orders/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            const barItems = []
            const newSeenIds = new Set()
            ordersRes.data.forEach(order => {
                order.items.forEach(item => {
                    if (
                        item.product.category.department === 'bar' &&
                        ['pending', 'in_progress'].includes(item.status)
                    ) {
                        newSeenIds.add(item.id)
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
                })
            })
            seenIds.current = newSeenIds
            setItems(barItems)
        } catch (err) {
            sessionStorage.removeItem('bar_token')
            setLoggedIn(false)
        }
    }

    useEffect(() => {
        const savedToken = sessionStorage.getItem('bar_token')
        if (!savedToken) {
            window.location.href = '/login'
        } else {
            setToken(savedToken)
            setLoggedIn(true)
            loadBarOrders(savedToken)
        }
    }, [])

    const logout = () => {
        sessionStorage.removeItem('bar_token')
        window.location.href = '/login'
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;

    useWebSocket(
        `${wsProtocol}//${wsHost}/ws/bar/`,
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
            <div className="login-screen" style={{ background: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#ffffff' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="premium-login-spinner" style={{ margin: '0 auto 16px auto' }}></div>
                    <p style={{ color: '#94a3b8' }}>Se redirecționează...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Bar</h1>
                <button className="logout-btn" onClick={logout}>Logout</button>
            </div>
            {items.length === 0 ? (
                <div className="empty-state">Nicio băutură în așteptare</div>
            ) : (
                <div className="kanban-board">
                    {items.map((item, idx) => (
                        <div key={idx} className="order-card">
                            <div className="card-header">
                                <span className="card-table-badge">Masa {item.table_number}</span>
                                <span className="card-time">
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="card-item-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                                <div>
                                    <div className="item-name">{item.quantity}x {item.product_name}</div>
                                    {item.notes && (
                                        <div className="item-notes">Mențiuni: {item.notes}</div>
                                    )}
                                </div>
                            </div>
                            <div className="btn-row">
                                <button className="btn-primary" onClick={() => markReady(item)}>
                                    Gata
                                </button>
                                <button className="btn-danger" onClick={() => markUnavailable(item)}>
                                    Indisponibil
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}