import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'
import '../ClientLayout.css'

const pizzaImg = '/external-images/pizza_img_1777787996916.png'
const pastaImg = '/external-images/pasta_img_1777788014420.png'
const dessertImg = '/external-images/dessert_img_1777788035243.png'
const drinkImg = '/external-images/drink_img_1777788049845.png'
const soupImg = '/external-images/soup_img_1777788115660.png'
const coffeeImg = '/external-images/coffee_img_1777788128533.png'

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

    const getProductImage = (catName) => {
        const lower = catName.toLowerCase();
        if (lower.includes('paste')) return pastaImg;
        if (lower.includes('desert')) return dessertImg;
        if (lower.includes('ciorbe')) return soupImg;
        if (lower.includes('cafea')) return coffeeImg;
        if (lower.includes('cocktails') || lower.includes('racoritoare') || lower.includes('bere')) return drinkImg;
        return pizzaImg;
    }

    const CategoryDropdown = ({ catName, products }) => {
        const [isOpen, setIsOpen] = useState(false)
        const [isHovered, setIsHovered] = useState(false)

        return (
            <div className={`category-wrapper ${isHovered ? 'hovered' : ''}`}>
                <div
                    className="category-header"
                    onClick={() => setIsOpen(!isOpen)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <span style={{ letterSpacing: '-0.3px' }}>{catName}</span>
                    <div style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        color: isOpen ? 'var(--primary)' : 'var(--text-muted)'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>
                {isOpen && (
                    <div className="category-content">
                        {products.map(product => (
                            <div key={product.id} className="product-card">
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1, paddingRight: '16px' }}>
                                    <img 
                                        src={getProductImage(catName)} 
                                        alt={product.name} 
                                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '12px', marginRight: '16px', flexShrink: 0 }}
                                    />
                                    <div className="product-name" style={{ marginBottom: 0 }}>{product.name}</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                    <div className="product-price">{product.price} lei</div>
                                    <button className="add-btn" onClick={() => addToCart(product)}>
                                        + Adaugă
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    const renderMenu = () => {
        const availableProducts = menu.filter(p => p.is_available)
        if (availableProducts.length === 0) return null

        const grouped = {}
        availableProducts.forEach(p => {
            const catName = p.category.name
            if (!grouped[catName]) grouped[catName] = []
            grouped[catName].push(p)
        })

        return (
            <div>
                {Object.entries(grouped).map(([catName, products]) => (
                    <CategoryDropdown key={catName} catName={catName} products={products} />
                ))}
            </div>
        )
    }

    if (!groupName) {
        return (
            <div className="client-container">
                <h1 className="client-title">Masa {tableNumber}</h1>
                <div className="client-group-card">
                    <h2 className="client-subtitle" style={{marginTop: 0}}>Cum vă numiți?</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 24 }}>
                        Introduceți un nume nou sau alăturați-vă unui grup existent.
                    </p>

                    {existingGroups.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12, fontWeight: '600' }}>
                                Grupuri existente la această masă:
                            </div>
                            {existingGroups.map(group => (
                                <button
                                    key={group.id}
                                    className="client-existing-group-btn"
                                    onClick={() => {
                                        setGroupName(group.name)
                                        setGroupId(group.id)
                                    }}
                                >
                                    {group.name}
                                </button>
                            ))}
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '16px 0 12px', textAlign: 'center', fontWeight: '500' }}>
                                — sau creați un grup nou —
                            </div>
                        </div>
                    )}

                    <input
                        className="client-group-input"
                        placeholder="Numele grupului nou..."
                        value={groupInput}
                        onChange={e => setGroupInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && groupInput.trim() && setGroupName(groupInput.trim())}
                    />
                    <button
                        className="client-btn-primary"
                        onClick={() => groupInput.trim() && setGroupName(groupInput.trim())}
                    >
                        Continuă
                    </button>
                </div>
            </div>
        )
    }
    if (loading) return <div className="client-center">Se încarcă...</div>

    return (
        <div className="client-container">
            <h1 className="client-title">Masa {tableNumber}</h1>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span className="client-group-badge">Grupul: {groupName}</span>
            </div>

            {!order && !showAddMenu && (
                <>
                    <h2 className="client-subtitle">Meniu</h2>
                    {renderMenu()}
                    {cart.length > 0 && (
                        <div className="cart-section">
                            <h2 className="client-subtitle" style={{marginTop: 0}}>Coș</h2>
                            {cart.map(item => (
                                <div key={item.cartId} className="cart-item">
                                    <div style={{ flex: 1 }}>
                                        <div className="cart-item-header">
                                            <span>{item.quantity}x {item.product.name}</span>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                                <span style={{color: 'var(--primary)', fontWeight: '800'}}>{(item.quantity * item.product.price).toFixed(2)} lei</span>
                                                <button className="remove-btn" onClick={() => removeFromCart(item.cartId)}>✕</button>
                                            </div>
                                        </div>
                                        <input
                                            className="cart-item-notes"
                                            placeholder="Mențiuni speciale..."
                                            value={item.notes || ''}
                                            onChange={e => updateNotes(item.cartId, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="cart-total">
                                Total: {cart.reduce((s, i) => s + i.quantity * i.product.price, 0).toFixed(2)} lei
                            </div>
                            <button className="client-btn-primary" onClick={placeOrder}>
                                Trimite comanda
                            </button>
                        </div>
                    )}
                </>
            )}

            {showAddMenu && (
                <>
                    <h2 className="client-subtitle">Adaugă la comandă</h2>
                    {renderMenu()}
                    {cart.length > 0 && (
                        <div className="cart-section">
                            <h2 className="client-subtitle" style={{marginTop: 0}}>Coș suplimentar</h2>
                            {cart.map(item => (
                                <div key={item.cartId} className="cart-item">
                                    <div style={{ flex: 1 }}>
                                        <div className="cart-item-header">
                                            <span>{item.quantity}x {item.product.name}</span>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                                <span style={{color: 'var(--primary)', fontWeight: '800'}}>{(item.quantity * item.product.price).toFixed(2)} lei</span>
                                                <button className="remove-btn" onClick={() => removeFromCart(item.cartId)}>✕</button>
                                            </div>
                                        </div>
                                        <input
                                            className="cart-item-notes"
                                            placeholder="Mențiuni speciale..."
                                            value={item.notes || ''}
                                            onChange={e => updateNotes(item.cartId, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                            <button className="client-btn-primary" onClick={placeOrder}>
                                Adaugă la comanda #{order?.id}
                            </button>
                        </div>
                    )}
                    <button
                        className="client-btn-secondary"
                        onClick={() => { setShowAddMenu(false); setCart([]) }}
                    >
                        Anulează adăugarea
                    </button>
                </>
            )}

            {order && !showAddMenu && (
                <div className="order-status-section">
                    <h2 className="client-subtitle">Comanda ta — {groupName}</h2>
                    {myItems.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0', background: 'var(--surface)', borderRadius: 'var(--radius-lg)' }}>
                            Nicio comandă plasată încă
                        </div>
                    ) : (
                        myItems.map(item => (
                            <div key={item.id} className="order-item-row">
                                <div>
                                    <span style={{fontWeight: '600'}}>{item.quantity}x {item.product.name}</span>
                                    {item.notes && (
                                        <div style={{ fontSize: 13, color: 'var(--warning)', marginTop: 4, fontWeight: '500' }}>
                                            {item.notes}
                                        </div>
                                    )}
                                </div>
                                <span className="item-status-badge" style={{
                                    background: item.status === 'ready' ? 'var(--success-bg)' : item.status === 'pending' ? 'var(--surface-hover)' : 'var(--info-bg)',
                                    color: item.status === 'ready' ? 'var(--success)' : item.status === 'pending' ? 'var(--text-muted)' : 'var(--info)'
                                }}>
                                    {getStatusLabel(item.status)}
                                </span>
                            </div>
                        ))
                    )}
                    <div className="cart-total" style={{marginTop: '24px'}}>
                        Total grup: {myItems
                            .filter(i => i.status !== 'rejected')
                            .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price || 0), 0)
                            .toFixed(2)} lei
                    </div>
                    <button
                        className="client-btn-secondary"
                        style={{marginTop: '24px', background: 'var(--surface)'}}
                        onClick={() => setShowAddMenu(true)}
                    >
                        + Adaugă mai multe produse
                    </button>
                </div>
            )}
        </div>
    )
}