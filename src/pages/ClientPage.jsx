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

    // Waiter calling & Bill requests
    const [waiterCalled, setWaiterCalled] = useState(false)
    const [billRequested, setBillRequested] = useState(false)
    const [showBillModal, setShowBillModal] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [tipPercent, setTipPercent] = useState(10)
    const [tipAmount, setTipAmount] = useState('0')



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

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;

    useWebSocket(
        `${wsProtocol}//${wsHost}/ws/table/${tableNumber}/`,
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
            if (data.type === 'payment_completed') {
                const loadOrderUpdates = async () => {
                    try {
                        const ordersRes = await api.get(`/orders/table/${tableNumber}/`)
                        if (ordersRes.data.length > 0) {
                            const activeOrder = ordersRes.data[ordersRes.data.length - 1]
                            setOrder(activeOrder)
                        }
                    } catch (err) {
                        console.log('Eroare reîncărcare comandă după plată', err)
                    }
                }
                loadOrderUpdates()
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

    const callWaiter = async () => {
        try {
            await api.post(`/tables/${tableNumber}/call_waiter/`)
            setWaiterCalled(true)
            alert('Ospătarul a fost solicitat la masa ta!')
            setTimeout(() => setWaiterCalled(false), 30000)
        } catch (err) {
            alert('Eroare la solicitarea ospătarului!')
        }
    }

    const requestBill = async (finalTip) => {
        try {
            await api.post(`/tables/${tableNumber}/request_bill/`, {
                payment_method: paymentMethod,
                tip: parseFloat(finalTip || tipAmount || 0),
                group_name: groupName,
                group_id: groupId
            })
            setShowBillModal(false)
            setBillRequested(true)
            alert('Solicitarea pentru nota de plată a fost trimisă!')
        } catch (err) {
            alert('Eroare la solicitarea notei de plată!')
        }
    }

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

    const updateCartQuantity = (cartId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                const newQty = item.quantity + delta
                return { ...item, quantity: Math.max(1, newQty) }
            }
            return item
        }))
    }

    const setCartQuantity = (cartId, val) => {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                return { ...item, quantity: Math.max(1, val) }
            }
            return item
        }))
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
    const myTotal = myItems
        .filter(i => i.status !== 'rejected')
        .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price || 0), 0)

    const isGroupPaid = order?.payments?.some(p => p.group === groupId && p.status === 'completed')

    useEffect(() => {
        if (tipPercent !== 'custom') {
            const pct = parseFloat(tipPercent) || 0
            const calculated = pct === 0 ? 0 : (myTotal * pct / 100).toFixed(2)
            setTipAmount(calculated.toString())
        }
    }, [tipPercent, myTotal, showBillModal])

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
            <style>{`
                .client-action-btn-row {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    margin-bottom: 24px;
                }
                .client-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--surface);
                    border: 1.5px solid var(--border);
                    color: var(--text);
                    padding: 10px 18px;
                    border-radius: 9999px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
                }
                .client-action-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
                    border-color: var(--primary);
                }
                .client-action-btn-accent {
                    background: var(--primary);
                    border-color: var(--primary);
                    color: white;
                }
                .client-action-btn-accent:hover {
                    background: var(--primary-hover, #ef4444);
                    border-color: var(--primary-hover, #ef4444);
                }
                .client-modal-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 16px;
                    animation: clientFadeIn 0.3s ease-out;
                }
                .client-modal-content {
                    background: white;
                    border-radius: 24px;
                    width: 100%;
                    max-width: 440px;
                    padding: 24px;
                    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
                    color: #0f172a;
                    animation: clientScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .client-modal-title {
                    font-size: 20px;
                    font-weight: 800;
                    margin: 0 0 8px 0;
                    color: #0f172a;
                    text-align: center;
                }
                .client-modal-label {
                    font-size: 12px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748b;
                    letter-spacing: 0.5px;
                }
                .client-select-btn {
                    background: #f1f5f9;
                    border: 2px solid transparent;
                    border-radius: 12px;
                    padding: 10px;
                    font-weight: 700;
                    font-size: 13px;
                    color: #334155;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .client-select-btn:hover {
                    background: #e2e8f0;
                }
                .client-select-btn.active {
                    background: #fef2f2;
                    border-color: #ef4444;
                    color: #ef4444;
                }
                .client-modal-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #cbd5e1;
                    border-radius: 12px;
                    font-size: 15px;
                    color: #0f172a;
                    font-weight: 600;
                    box-sizing: border-box;
                    transition: all 0.2s ease;
                }
                .client-modal-input:focus {
                    outline: none;
                    border-color: #ef4444;
                    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
                }
                @keyframes clientFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes clientScaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>

            <h1 className="client-title">Masa {tableNumber}</h1>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span className="client-group-badge">Grupul: {groupName}</span>
            </div>

            <div className="client-action-btn-row">
                <button onClick={callWaiter} disabled={waiterCalled || isGroupPaid} className="client-action-btn">
                    {waiterCalled ? '⏳ Solicitare trimisă...' : '🔔 Cheamă Ospătar'}
                </button>
                {order && myItems.length > 0 && !isGroupPaid && (
                    <button onClick={() => setShowBillModal(true)} disabled={billRequested} className="client-action-btn client-action-btn-accent">
                        {billRequested ? '⏳ Notă solicitată...' : '💳 Cere Nota'}
                    </button>
                )}
            </div>

            {showBillModal && (
                <div className="client-modal-backdrop">
                    <div className="client-modal-content">
                        <h3 className="client-modal-title">Solicitare Nota de Plată</h3>
                        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
                            {/* Method selection */}
                            <div>
                                <label className="client-modal-label">Metoda de Plată</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '6px' }}>
                                    {['cash', 'card', 'ticket'].map(m => (
                                        <button
                                            key={m}
                                            onClick={() => setPaymentMethod(m)}
                                            className={`client-select-btn ${paymentMethod === m ? 'active' : ''}`}
                                        >
                                            {m === 'cash' ? '💵 Cash' : m === 'card' ? '💳 Card' : '🎟️ Tichet'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tip selection */}
                            <div>
                                <label className="client-modal-label">Bacșiș (Tip)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
                                    {[0, 10, 15].map(pct => {
                                        const calculatedTip = pct === 0 ? 0 : (myTotal * pct / 100).toFixed(2);
                                        return (
                                            <button
                                                key={pct}
                                                onClick={() => {
                                                    setTipPercent(pct)
                                                    setTipAmount(calculatedTip)
                                                }}
                                                className={`client-select-btn ${tipPercent === pct ? 'active' : ''}`}
                                            >
                                                {pct}% ({calculatedTip} L)
                                            </button>
                                        )
                                    })}
                                    <button
                                        onClick={() => {
                                            setTipPercent('custom')
                                            setTipAmount('')
                                        }}
                                        className={`client-select-btn ${tipPercent === 'custom' ? 'active' : ''}`}
                                    >
                                        Custom
                                    </button>
                                </div>
                                {tipPercent === 'custom' && (
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="client-modal-input"
                                        style={{ marginTop: '8px' }}
                                        placeholder="Sumă bacșiș (lei)..."
                                        value={tipAmount}
                                        onChange={e => setTipAmount(e.target.value)}
                                    />
                                )}
                            </div>

                            {/* Summary */}
                            <div className="client-bill-summary" style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                                    <span>Consumație grup:</span>
                                    <span style={{ fontWeight: '600' }}>{myTotal.toFixed(2)} lei</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                                    <span>Bacșiș ({tipPercent !== 'custom' ? `${tipPercent}%` : 'Personalizat'}):</span>
                                    <span style={{ fontWeight: '600' }}>{parseFloat(tipAmount || 0).toFixed(2)} lei</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: 'var(--primary)', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '8px' }}>
                                    <span>Total de Plată:</span>
                                    <span>{(myTotal + parseFloat(tipAmount || 0)).toFixed(2)} lei</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                <button onClick={() => setShowBillModal(false)} className="client-btn-secondary" style={{ margin: 0, padding: '10px' }}>
                                    Anulează
                                </button>
                                <button onClick={() => requestBill()} className="client-btn-primary" style={{ margin: 0, padding: '10px' }}>
                                    Trimite Cerere
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="quantity-selector">
                                                    <button className="quantity-btn" onClick={() => updateCartQuantity(item.cartId, -1)}>-</button>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        className="quantity-input" 
                                                        value={item.quantity} 
                                                        onChange={e => {
                                                            const val = parseInt(e.target.value) || 1
                                                            setCartQuantity(item.cartId, val)
                                                        }} 
                                                    />
                                                    <button className="quantity-btn" onClick={() => updateCartQuantity(item.cartId, 1)}>+</button>
                                                </div>
                                                <span>{item.product.name}</span>
                                            </div>
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="quantity-selector">
                                                    <button className="quantity-btn" onClick={() => updateCartQuantity(item.cartId, -1)}>-</button>
                                                    <input 
                                                        type="number" 
                                                        min="1" 
                                                        className="quantity-input" 
                                                        value={item.quantity} 
                                                        onChange={e => {
                                                            const val = parseInt(e.target.value) || 1
                                                            setCartQuantity(item.cartId, val)
                                                        }} 
                                                    />
                                                    <button className="quantity-btn" onClick={() => updateCartQuantity(item.cartId, 1)}>+</button>
                                                </div>
                                                <span>{item.product.name}</span>
                                            </div>
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
                    {!isGroupPaid ? (
                        <button
                            className="client-btn-secondary"
                            style={{marginTop: '24px', background: 'var(--surface)'}}
                            onClick={() => setShowAddMenu(true)}
                        >
                            + Adaugă mai multe produse
                        </button>
                    ) : (
                        <div style={{
                            marginTop: '24px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1.5px solid #10b981',
                            color: '#065f46',
                            padding: '16px',
                            borderRadius: '16px',
                            textAlign: 'center',
                            fontWeight: '700',
                            fontSize: '15px',
                            animation: 'clientFadeIn 0.3s ease-out'
                        }}>
                            🎉 Grupul tău a fost achitat cu succes! Vă mulțumim și vă mai așteptăm!
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}