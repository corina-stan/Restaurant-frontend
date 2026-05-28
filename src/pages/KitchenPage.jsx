import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'
import '../DesktopLayout.css'

export default function KitchenPage() {
    const [orders, setOrders] = useState({})
    const [loggedIn, setLoggedIn] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [token, setToken] = useState(null)
    const seenIds = useRef(new Set())

    const loadKitchenOrders = async (accessToken) => {
        try {
            const ordersRes = await api.get('/orders/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            const kitchenOrders = {}
            const newSeenIds = new Set()
            ordersRes.data.forEach(order => {
                order.items.forEach(item => {
                    if (
                        item.product.category.department === 'kitchen' &&
                        ['pending', 'in_progress'].includes(item.status)
                    ) {
                        newSeenIds.add(item.id)
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
                })
            })
            seenIds.current = newSeenIds
            setOrders(kitchenOrders)
        } catch (err) {
            sessionStorage.removeItem('kitchen_token')
            setLoggedIn(false)
        }
    }

    useEffect(() => {
        const savedToken = sessionStorage.getItem('kitchen_token')
        if (savedToken) {
            setToken(savedToken)
            setLoggedIn(true)
            loadKitchenOrders(savedToken)
        }
    }, [])

    const login = async () => {
        try {
            const res = await api.post('/token/', credentials)
            const payload = JSON.parse(atob(res.data.access.split('.')[1]))

            if (payload.role !== 'kitchen' && !payload.is_superuser) {
                alert('Nu ai permisiunea de a accesa bucătăria!')
                return
            }

            sessionStorage.setItem('kitchen_token', res.data.access)
            setToken(res.data.access)
            setLoggedIn(true)
            await loadKitchenOrders(res.data.access)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
    }

    const logout = () => {
        sessionStorage.removeItem('kitchen_token')
        setToken(null)
        setLoggedIn(false)
        setOrders({})
        seenIds.current = new Set()
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;

    useWebSocket(
        `${wsProtocol}//${wsHost}/ws/kitchen/`,
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
            <div className="login-screen">
                <div className="login-box">
                    <h1 className="page-title" style={{ marginBottom: '24px' }}>Bucătărie</h1>
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

    const orderList = Object.values(orders)

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Bucătărie</h1>
                <button className="logout-btn" onClick={logout}>Logout</button>
            </div>
            {orderList.length === 0 ? (
                <div className="empty-state">Nicio comandă în așteptare</div>
            ) : (
                <div className="kanban-board">
                    {orderList.map(order => (
                        <div key={order.order_id} className="order-card">
                            <div className="card-header">
                                <span className="card-table-badge">Masa {order.table_number}</span>
                                <span className="card-time">
                                    {new Date(order.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            {order.items.map(item => (
                                <div key={item.item_id} className="card-item-row">
                                    <div style={{ flex: 1 }}>
                                        <div className="item-name">
                                            {item.quantity}x {item.product_name}
                                        </div>
                                        {item.notes && (
                                            <div className="item-notes">Mențiuni: {item.notes}</div>
                                        )}
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ marginLeft: '12px' }}
                                        onClick={() => markReady(item.item_id, order.order_id)}
                                    >
                                        Gata
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}