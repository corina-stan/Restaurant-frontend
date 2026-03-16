import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'

export default function ClientPage() {
    const { tableNumber } = useParams()
    const [sessionToken, setSessionToken] = useState(null)
    const [menu, setMenu] = useState([])
    const [cart, setCart] = useState([])
    const [order, setOrder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        const initSession = async () => {
            try {
                const res = await api.post(`/tables/scan/${tableNumber}/`)
                const token = res.data.session_token
                setSessionToken(token)

                const menuRes = await api.get('/menu/products/?available_only=true')
                setMenu(menuRes.data)

                try {
                    const ordersRes = await api.get(`/orders/table/${tableNumber}/`)
                    if (ordersRes.data.length > 0) {
                        setOrder(ordersRes.data[ordersRes.data.length - 1])
                    }
                } catch (err) {
                    console.log('Nicio comandă activă')
                }

            } catch (err) {
                console.error('Eroare inițializare:', err)
            } finally {
                setLoading(false)
            }
        }
        initSession()
    }, [tableNumber])


    useWebSocket(
        `ws://localhost:5173/ws/table/${tableNumber}/`,
        (data) => {
            console.log('WebSocket mesaj tip:', data.type, data)
            if (data.type === 'order_update') {
                setOrder(prev => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        items: prev.items.map(item =>
                            item.id === data.item_id
                                ? { ...item, status: data.status }
                                : item
                        )
                    }
                })
            }
            if (data.type === 'product_availability') {
                setMenu(prev => prev.map(p =>
                    p.id === data.product_id
                        ? { ...p, is_available: data.is_available }
                        : p
                ))
            }
        }
    )

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(i => i.product.id === product.id)
            if (existing) {
                return prev.map(i =>
                    i.product.id === product.id
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            }
            return [...prev, { product, quantity: 1 }]
        })
    }

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(i => i.product.id !== productId))
    }

    const placeOrder = async () => {
        if (!sessionToken || cart.length === 0) return
        try {
            const res = await api.post('/orders/create/', {
                session_token: sessionToken,
                notes,
                items: cart.map(i => ({
                    product_id: i.product.id,
                    quantity: i.quantity
                }))
            })
            setOrder(res.data)
            setCart([])
            setNotes('')
        } catch (err) {
            console.error('Eroare comandă:', err)
        }
    }

    const getStatusLabel = (status) => {
        const labels = {
            pending: '⏳ În așteptare',
            in_progress: '👨‍🍳 În preparare',
            ready: '✅ Gata',
            served: '🍽️ Servit',
            rejected: '❌ Indisponibil'
        }
        return labels[status] || status
    }

    if (loading) return <div style={styles.center}>Se încarcă...</div>

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Masa {tableNumber}</h1>

            {!order ? (
                <>
                    <h2 style={styles.subtitle}>Meniu</h2>
                    {['kitchen', 'bar'].map(dept => (
                        <div key={dept}>
                            <h3 style={styles.deptTitle}>
                                {dept === 'kitchen' ? '🍳 Bucătărie' : '🍹 Bar'}
                            </h3>
                            {menu
                                .filter(p => p.category.department === dept && p.is_available)
                                .map(product => (
                                    <div key={product.id} style={styles.productCard}>
                                        <div>
                                            <div style={styles.productName}>{product.name}</div>
                                            <div style={styles.productPrice}>{product.price} lei</div>
                                        </div>
                                        <button
                                            style={styles.addBtn}
                                            onClick={() => addToCart(product)}
                                        >
                                            + Adaugă
                                        </button>
                                    </div>
                                ))}
                        </div>
                    ))}

                    {cart.length > 0 && (
                        <div style={styles.cart}>
                            <h2 style={styles.subtitle}>Coș</h2>
                            {cart.map(item => (
                                <div key={item.product.id} style={styles.cartItem}>
                                    <span>{item.quantity}x {item.product.name}</span>
                                    <span>{(item.quantity * item.product.price).toFixed(2)} lei</span>
                                    <button
                                        style={styles.removeBtn}
                                        onClick={() => removeFromCart(item.product.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            <div style={styles.cartTotal}>
                                Total: {cart.reduce((s, i) => s + i.quantity * i.product.price, 0).toFixed(2)} lei
                            </div>
                            <textarea
                                style={styles.notes}
                                placeholder="Mențiuni (ex: fără sare, alergie...)"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                            <button style={styles.orderBtn} onClick={placeOrder}>
                                Trimite comanda
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div style={styles.orderStatus}>
                    <h2 style={styles.subtitle}>Comanda #{order.id}</h2>
                    {order.items.map(item => (
                        <div key={item.id} style={styles.orderItem}>
                            <span>{item.quantity}x {item.product.name}</span>
                            <span style={styles.statusBadge}>
                                {getStatusLabel(item.status)}
                            </span>
                        </div>
                    ))}
                    <div style={styles.cartTotal}>
                        Total: {order.total} lei
                    </div>
                    <button
                        style={styles.orderBtn}
                        onClick={() => { setOrder(null) }}
                    >
                        + Adaugă mai multe
                    </button>
                </div>
            )}
        </div>
    )
}

const styles = {
    container: { maxWidth: 480, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' },
    center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    deptTitle: { fontSize: 16, color: '#666', marginTop: 12 },
    productCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' },
    productName: { fontWeight: '500' },
    productPrice: { color: '#888', fontSize: 14 },
    addBtn: { background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' },
    removeBtn: { background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' },
    cart: { marginTop: 24, background: '#f9fafb', borderRadius: 12, padding: 16 },
    cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
    cartTotal: { fontWeight: 'bold', marginTop: 8, fontSize: 18 },
    notes: { width: '100%', marginTop: 12, padding: 8, borderRadius: 8, border: '1px solid #ddd', resize: 'vertical', minHeight: 60 },
    orderBtn: { width: '100%', marginTop: 12, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 16, cursor: 'pointer' },
    orderStatus: { marginTop: 16 },
    orderItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' },
    statusBadge: { fontSize: 14, color: '#555' }
}