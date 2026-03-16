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
    const [groupName, setGroupName] = useState(null)
    const [groupInput, setGroupInput] = useState('')
    const [groupId, setGroupId] = useState(null)
    const [showAddMenu, setShowAddMenu] = useState(false)
    const [existingGroups, setExistingGroups] = useState([])

    const updateOrder = (newOrder) => {
        setOrder(newOrder)
    }

    useEffect(() => {
        const loadExistingGroups = async () => {
            try {
                const ordersRes = await api.get(`/orders/table/${tableNumber}/`)
                if (ordersRes.data.length > 0) {
                    const activeOrder = ordersRes.data[ordersRes.data.length - 1]
                    setExistingGroups(activeOrder.groups || [])
                }
            } catch (err) {
                console.log('Nicio comandă activă')
            }
        }
        loadExistingGroups()
    }, [tableNumber])

    useEffect(() => {
        if (!groupName) return
        const initSession = async () => {
            try {
                const res = await api.post(`/tables/scan/${tableNumber}/`)
                setSessionToken(res.data.session_token)

                const menuRes = await api.get('/menu/products/?available_only=true')
                setMenu(menuRes.data)

                try {
                    const ordersRes = await api.get(`/orders/table/${tableNumber}/`)
                    if (ordersRes.data.length > 0) {
                        const activeOrder = ordersRes.data[ordersRes.data.length - 1]
                        updateOrder(activeOrder)
                        const existingGroup = activeOrder.groups?.find(g => g.name === groupName)
                        if (existingGroup) {
                            setGroupId(existingGroup.id)
                        }
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
    }, [tableNumber, groupName])



    useWebSocket(
        `ws://localhost:5173/ws/table/${tableNumber}/`,
        (data) => {
            if (data.type === 'order_update') {
                setOrder(prev => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        items: prev.items.map(item =>
                            item.id === data.item_id
                                ? { ...item, status: data.status }
                                : item
                        ),
                        groups: prev.groups?.map(group => ({
                            ...group,
                            items: group.items.map(item =>
                                item.id === data.item_id
                                    ? { ...item, status: data.status }
                                    : item
                            )
                        }))
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
            const existing = prev.find(i => i.product.id === product.id && i.notes === '')
            if (existing) {
                return prev.map(i =>
                    i.cartId === existing.cartId
                        ? { ...i, quantity: i.quantity + 1 }
                        : i
                )
            }
            return [...prev, { product, quantity: 1, notes: '', cartId: Date.now() }]
        })
    }

    const removeFromCart = (cartId) => {
        setCart(prev => prev.filter(i => i.cartId !== cartId))
    }

    const placeOrder = async () => {
        if (!sessionToken || cart.length === 0) return
        try {
            let currentOrderId = order?.id
            let currentGroupId = groupId

            if (!currentOrderId) {
                const initRes = await api.post('/orders/init/', {
                    session_token: sessionToken
                })
                currentOrderId = initRes.data.id
            }

            if (!currentGroupId) {
                const groupRes = await api.post('/orders/groups/', {
                    order_id: currentOrderId,
                    name: groupName
                })
                currentGroupId = groupRes.data.id
                setGroupId(currentGroupId)
            }

            const res = await api.post('/orders/create/', {
                session_token: sessionToken,
                order_id: currentOrderId,
                notes,
                items: cart.map(i => ({
                    product_id: i.product.id,
                    quantity: i.quantity,
                    notes: i.notes || '',
                    group_id: currentGroupId
                }))
            })

            updateOrder(res.data)
            setCart([])
            setNotes('')
            setShowAddMenu(false)
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

    const updateNotes = (cartId, newNotes) => {
        setCart(prev => {
            const currentItem = prev.find(i => i.cartId === cartId)
            if (!currentItem) return prev
            const duplicate = prev.find(i =>
                i.cartId !== cartId &&
                i.product.id === currentItem.product.id &&
                i.notes === newNotes
            )
            if (duplicate) {
                return prev
                    .filter(i => i.cartId !== cartId)
                    .map(i => i.cartId === duplicate.cartId
                        ? { ...i, quantity: i.quantity + currentItem.quantity }
                        : i
                    )
            }
            return prev.map(i => i.cartId === cartId ? { ...i, notes: newNotes } : i)
        })
    }

    const myGroup = order?.groups?.find(g => g.id === groupId)
    const myItems = myGroup ? myGroup.items : []

    if (!groupName) {
        return (
            <div style={styles.container}>
                <h1 style={styles.title}>Masa {tableNumber}</h1>
                <div style={styles.groupCard}>
                    <h2 style={styles.subtitle}>Cum vă numiți?</h2>
                    <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
                        Introduceți un nume nou sau alăturați-vă unui grup existent.
                    </p>

                    {existingGroups.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: '500' }}>
                                Grupuri existente la această masă:
                            </div>
                            {existingGroups.map(group => (
                                <button
                                    key={group.id}
                                    style={styles.existingGroupBtn}
                                    onClick={() => {
                                        setGroupName(group.name)
                                        setGroupId(group.id)
                                    }}
                                >
                                    {group.name}
                                </button>
                            ))}
                            <div style={{ fontSize: 12, color: '#94a3b8', margin: '12px 0 8px' }}>
                                — sau creați un grup nou —
                            </div>
                        </div>
                    )}

                    <input
                        style={styles.groupInput}
                        placeholder="Numele grupului nou..."
                        value={groupInput}
                        onChange={e => setGroupInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && groupInput.trim() && setGroupName(groupInput.trim())}
                    />
                    <button
                        style={{ ...styles.orderBtn, marginTop: 12 }}
                        onClick={() => groupInput.trim() && setGroupName(groupInput.trim())}
                    >
                        Continuă
                    </button>
                </div>
            </div>
        )
    }
    if (loading) return <div style={styles.center}>Se încarcă...</div>

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Masa {tableNumber}</h1>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <span style={styles.groupBadge}>Grupul: {groupName}</span>
            </div>

            {!order && !showAddMenu && (
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
                                        <button style={styles.addBtn} onClick={() => addToCart(product)}>
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
                                <div key={item.cartId} style={styles.cartItem}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span>{item.quantity}x {item.product.name}</span>
                                            <span>{(item.quantity * item.product.price).toFixed(2)} lei</span>
                                            <button style={styles.removeBtn} onClick={() => removeFromCart(item.cartId)}>✕</button>
                                        </div>
                                        <input
                                            style={styles.itemNotes}
                                            placeholder="Mențiuni..."
                                            value={item.notes || ''}
                                            onChange={e => updateNotes(item.cartId, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div style={styles.cartTotal}>
                                Total: {cart.reduce((s, i) => s + i.quantity * i.product.price, 0).toFixed(2)} lei
                            </div>
                            <button style={styles.orderBtn} onClick={placeOrder}>
                                Trimite comanda
                            </button>
                        </div>
                    )}
                </>
            )}

            {showAddMenu && (
                <>
                    <h2 style={styles.subtitle}>Adaugă la comandă</h2>
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
                                        <button style={styles.addBtn} onClick={() => addToCart(product)}>
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
                                <div key={item.cartId} style={styles.cartItem}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span>{item.quantity}x {item.product.name}</span>
                                            <span>{(item.quantity * item.product.price).toFixed(2)} lei</span>
                                            <button style={styles.removeBtn} onClick={() => removeFromCart(item.cartId)}>✕</button>
                                        </div>
                                        <input
                                            style={styles.itemNotes}
                                            placeholder="Mențiuni..."
                                            value={item.notes || ''}
                                            onChange={e => updateNotes(item.cartId, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <button style={styles.orderBtn} onClick={placeOrder}>
                                Adaugă la comanda #{order?.id}
                            </button>
                        </div>
                    )}
                    <button
                        style={{ ...styles.orderBtn, background: '#94a3b8', marginTop: 8 }}
                        onClick={() => { setShowAddMenu(false); setCart([]) }}
                    >
                        Anulează
                    </button>
                </>
            )}

            {order && !showAddMenu && (
                <div style={styles.orderStatus}>
                    <h2 style={styles.subtitle}>Comanda ta — {groupName}</h2>
                    {myItems.length === 0 ? (
                        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
                            Nicio comandă plasată încă
                        </div>
                    ) : (
                        myItems.map(item => (
                            <div key={item.id} style={styles.orderItem}>
                                <div>
                                    <span>{item.quantity}x {item.product.name}</span>
                                    {item.notes && (
                                        <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                                <span style={styles.statusBadge}>
                                    {getStatusLabel(item.status)}
                                </span>
                            </div>
                        ))
                    )}
                    <div style={styles.cartTotal}>
                        Total grup: {myItems
                            .filter(i => i.status !== 'rejected')
                            .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price || 0), 0)
                            .toFixed(2)} lei
                    </div>
                    <button
                        style={styles.orderBtn}
                        onClick={() => setShowAddMenu(true)}
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
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    deptTitle: { fontSize: 16, color: '#666', marginTop: 12 },
    productCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' },
    productName: { fontWeight: '500' },
    productPrice: { color: '#888', fontSize: 14 },
    addBtn: { background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' },
    removeBtn: { background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer' },
    cart: { marginTop: 24, background: '#f9fafb', borderRadius: 12, padding: 16 },
    cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0' },
    cartTotal: { fontWeight: 'bold', marginTop: 8, fontSize: 18 },
    orderBtn: { width: '100%', marginTop: 12, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 16, cursor: 'pointer' },
    orderStatus: { marginTop: 16 },
    orderItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' },
    statusBadge: { fontSize: 14, color: '#555' },
    itemNotes: { width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box' },
    groupCard: { background: '#f9fafb', borderRadius: 12, padding: 24, marginTop: 24 },
    groupInput: { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, boxSizing: 'border-box' },
    groupBadge: { background: '#ede9fe', color: '#7c3aed', padding: '4px 12px', borderRadius: 20, fontSize: 13, display: 'inline-block', marginBottom: 8 },
    existingGroupBtn: { display: 'block', width: '100%', padding: '10px 14px', marginBottom: 8, borderRadius: 8, border: '2px solid #7c3aed', background: '#ede9fe', color: '#7c3aed', fontSize: 15, fontWeight: '500', cursor: 'pointer', textAlign: 'left' },
}