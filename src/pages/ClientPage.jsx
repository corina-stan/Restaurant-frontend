import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'
import '../ClientLayout.css'

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

    // Premium UI States
    const [activeCategory, setActiveCategory] = useState('')
    const [isCartOpen, setIsCartOpen] = useState(false)
    const [showScrollTop, setShowScrollTop] = useState(false)
    const tabsContainerRef = useRef(null)

    const updateOrder = (newOrder) => {
        setOrder(newOrder)
    }

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setShowScrollTop(true)
            } else {
                setShowScrollTop(false)
            }
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
            setIsCartOpen(false)
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

    const getCartDestination = () => {
        if (cart.length === 0) return 'în bucătărie'
        
        let hasFood = false
        let hasDrinks = false

        cart.forEach(item => {
            const catName = (item.product.category?.name || '').toLowerCase()
            const isDrink = catName.includes('băutur') || 
                            catName.includes('bautur') || 
                            catName.includes('drink') || 
                            catName.includes('cocktail') || 
                            catName.includes('racoritoare') || 
                            catName.includes('bere') || 
                            catName.includes('cafea') || 
                            catName.includes('vin') ||
                            catName.includes('suc')

            if (isDrink) {
                hasDrinks = true
            } else {
                hasFood = true
            }
        })

        if (hasFood && hasDrinks) return 'la bar & bucătărie'
        if (hasDrinks) return 'la bar'
        return 'în bucătărie'
    }

    // Premium Category & Images mapping
    const getCategoryEmoji = (catName) => {
        const lower = catName.toLowerCase();
        if (lower.includes('pizz')) return '🍕';
        if (lower.includes('past')) return '🍝';
        if (lower.includes('desert') || lower.includes('dulce')) return '🍰';
        if (lower.includes('ciorb') || lower.includes('sup')) return '🍲';
        if (lower.includes('cafea')) return '☕';
        if (lower.includes('băutur') || lower.includes('bautur') || lower.includes('drink') || lower.includes('cocktail') || lower.includes('racoritoare') || lower.includes('bere')) return '🍹';
        return '🍽️';
    }

    const getProductImage = (product) => {
        if (product.image) {
            return product.image; // Use uploaded product-specific image from Django backend
        }
        // Fallback to beautiful local category images
        const catName = product.category?.name || '';
        const lower = catName.toLowerCase();
        if (lower.includes('paste')) return '/external-images/pasta.png';
        if (lower.includes('desert')) return '/external-images/dessert.png';
        if (lower.includes('ciorbe')) return '/external-images/soup.png';
        if (lower.includes('cafea')) return '/external-images/coffee.png';
        if (lower.includes('cocktails') || lower.includes('racoritoare') || lower.includes('bere') || lower.includes('băuturi') || lower.includes('bauturi')) return '/external-images/drinks.png';
        return '/external-images/pizza.png';
    }

    // Scroll to category section smoothly
    const handleCategoryClick = (catName) => {
        setActiveCategory(catName)
        const element = document.getElementById(`category-${catName}`)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' })
        }
    }

    // Auto-highlight active tab on scroll
    useEffect(() => {
        if (menu.length === 0 || !groupName) return

        const sections = document.querySelectorAll('.products-category-section')
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const catId = entry.target.id.replace('category-', '')
                    setActiveCategory(catId)
                    
                    // Auto-scroll the tabs bar to keep active tab visible
                    const activeTabBtn = document.getElementById(`tab-btn-${catId}`)
                    if (activeTabBtn && tabsContainerRef.current) {
                        const container = tabsContainerRef.current
                        const scrollLeft = activeTabBtn.offsetLeft - container.offsetWidth / 2 + activeTabBtn.offsetWidth / 2
                        container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
                    }
                }
            })
        }, {
            root: null,
            rootMargin: '-80px 0px -70% 0px' // triggers when section hits near top
        })

        sections.forEach(section => observer.observe(section))
        return () => observer.disconnect()
    }, [menu, groupName])

    const availableProducts = menu.filter(p => p.is_available)

    // Group products by category
    const groupedProducts = {}
    availableProducts.forEach(p => {
        const catName = p.category.name
        if (!groupedProducts[catName]) groupedProducts[catName] = []
        groupedProducts[catName].push(p)
    })

    const categoriesList = Object.keys(groupedProducts)

    if (!groupName) {
        return (
            <div className="client-container">
                <div className="client-brand-header">
                    <h1 className="client-title">Masa {tableNumber}</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>Bun venit la restaurantul nostru!</p>
                </div>
                
                <div className="client-welcome-card">
                    <div className="client-welcome-icon">👋</div>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', textAlign: 'center', margin: '0 0 12px 0', fontFamily: 'var(--font-heading)' }}>Cum vă numiți?</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', textAlign: 'center', lineHeight: '1.5' }}>
                        Pentru a plasa comenzi, introduceți numele dvs. sau alăturați-vă unui grup deja creat la această masă.
                    </p>

                    {existingGroups.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                                    <span>👥 {group.name}</span>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Alătură-te →</span>
                                </button>
                            ))}
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '16px 0 12px', textAlign: 'center', fontWeight: '600' }}>
                                — sau creați un grup nou —
                            </div>
                        </div>
                    )}

                    <input
                        className="client-group-input"
                        placeholder="Numele grupului nou (ex: Familia Ionescu)..."
                        value={groupInput}
                        onChange={e => setGroupInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && groupInput.trim() && setGroupName(groupInput.trim())}
                    />
                    <button
                        className="client-btn-primary"
                        onClick={() => groupInput.trim() && setGroupName(groupInput.trim())}
                    >
                        Începe Răsfoirea Meniului
                    </button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="client-center">
                <div className="premium-login-spinner"></div>
                <div style={{ marginTop: '16px' }}>Se încarcă meniul digital...</div>
            </div>
        )
    }

    return (
        <div className="client-container">
            <style>{`
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
                    font-family: var(--font-heading);
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
                    border-color: var(--primary);
                    color: var(--primary);
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
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
                }
            `}</style>

            {/* Header Area */}
            <div className="client-brand-header" style={{ paddingBottom: '16px' }}>
                <h1 className="client-title">Masa {tableNumber}</h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                    <span className="client-group-badge">👤 {groupName}</span>
                </div>
            </div>

            {/* Sticky Horizontal Categories Tabs */}
            {categoriesList.length > 0 && (
                <div className="category-tabs-container" ref={tabsContainerRef}>
                    {categoriesList.map(catName => (
                        <button
                            key={catName}
                            id={`tab-btn-${catName}`}
                            className={`category-tab-btn ${activeCategory === catName ? 'active' : ''}`}
                            onClick={() => handleCategoryClick(catName)}
                        >
                            <span>{getCategoryEmoji(catName)}</span>
                            <span>{catName}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* MAIN MENU LISTING */}
            {(!order || showAddMenu) && (
                <div>
                    <h2 className="client-subtitle" style={{ marginBottom: '4px' }}>
                        {showAddMenu ? '➕ Adaugă la Comandă' : '📖 Meniu Complet'}
                    </h2>
                    
                    {categoriesList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            Momentan nu există preparate disponibile.
                        </div>
                    ) : (
                        categoriesList.map(catName => (
                            <div key={catName} id={`category-${catName}`} className="products-category-section">
                                <h3 className="products-category-section-title">
                                    {getCategoryEmoji(catName)} {catName}
                                </h3>
                                <div className="products-grid">
                                    {groupedProducts[catName].map(product => (
                                        <div key={product.id} className="product-card">
                                            <div className="product-image-container">
                                                <img 
                                                    src={getProductImage(product)} 
                                                    alt={product.name} 
                                                    className="product-image"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = '/external-images/pizza.png'; // safe fallback
                                                    }}
                                                />
                                            </div>
                                            <div className="product-info">
                                                <h4 className="product-name">{product.name}</h4>
                                                {product.description && (
                                                    <p className="product-desc">{product.description}</p>
                                                )}
                                                <div className="product-meta-row">
                                                    <span className="product-price">{product.price} lei</span>
                                                    <button className="add-btn" onClick={() => addToCart(product)}>
                                                        + Adaugă
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Billing Modal overlay */}
            {showBillModal && (
                <div className="client-modal-backdrop">
                    <div className="client-modal-content">
                        <h3 className="client-modal-title">Solicitare Notă de Plată</h3>
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
                                    <span style={{ fontWeight: '700' }}>{myTotal.toFixed(2)} lei</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                                    <span>Bacșiș ({tipPercent !== 'custom' ? `${tipPercent}%` : 'Personalizat'}):</span>
                                    <span style={{ fontWeight: '700' }}>{parseFloat(tipAmount || 0).toFixed(2)} lei</span>
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

            {/* STICKY FLOATING BOTTOM ACTION DECK */}
            <div className="client-float-bottom-deck">
                <div className="client-glass-pill">
                    <button 
                        onClick={callWaiter} 
                        disabled={waiterCalled || isGroupPaid} 
                        className="client-deck-btn"
                    >
                        {waiterCalled ? '⏳ Apel trimis...' : '🔔 Cheamă Ospătar'}
                    </button>

                    {order && myItems.length > 0 && !isGroupPaid && (
                        <button 
                            onClick={() => setShowBillModal(true)} 
                            disabled={billRequested} 
                            className="client-deck-btn client-deck-btn-accent"
                        >
                            {billRequested ? '⏳ Cerut...' : '💳 Cere Nota'}
                        </button>
                    )}

                    {cart.length > 0 && (
                        <div 
                            className="client-cart-deck-pill"
                            onClick={() => setIsCartOpen(true)}
                        >
                            <span>🛒 Coș</span>
                            <span className="client-cart-badge">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                            <span style={{ fontSize: '11px', opacity: 0.9 }}>
                                ({cart.reduce((s, i) => s + i.quantity * i.product.price, 0).toFixed(2)} L)
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* SLIDE-UP CHECKOUT DRAWER */}
            {isCartOpen && (
                <>
                    <div className="client-drawer-backdrop" onClick={() => setIsCartOpen(false)} />
                    <div className="client-drawer">
                        <div className="client-drawer-header">
                            <h3 className="client-drawer-title">🛒 Coșul tău</h3>
                            <button className="client-drawer-close" onClick={() => setIsCartOpen(false)}>✕</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {cart.map(item => (
                                <div key={item.cartId} className="cart-item">
                                    <div className="cart-item-header">
                                        <div className="cart-item-title-col">
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
                                            <span className="cart-item-title">{item.product.name}</span>
                                        </div>
                                        
                                        <div className="cart-item-price-col">
                                            <span className="cart-item-price">{(item.quantity * item.product.price).toFixed(2)} lei</span>
                                            <button className="remove-btn" onClick={() => removeFromCart(item.cartId)}>✕</button>
                                        </div>
                                    </div>
                                    <input
                                        className="cart-item-notes"
                                        placeholder="Mențiuni speciale (fără sare, sos separat etc.)..."
                                        value={item.notes || ''}
                                        onChange={e => updateNotes(item.cartId, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="cart-total-row">
                            <span className="cart-total-label">Total de plată:</span>
                            <span className="cart-total-price">
                                {cart.reduce((s, i) => s + i.quantity * i.product.price, 0).toFixed(2)} lei
                            </span>
                        </div>

                        <button className="client-btn-primary" onClick={placeOrder}>
                            🚀 {showAddMenu ? `Adaugă la Comanda #${order?.id}` : 'Trimite comanda'}
                        </button>
                        
                        {showAddMenu && (
                            <button
                                className="client-btn-secondary"
                                onClick={() => { setShowAddMenu(false); setCart([]); setIsCartOpen(false) }}
                            >
                                Anulează adăugarea
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* ACTIVE ORDER STATUS SECTION */}
            {order && !showAddMenu && (
                <div className="order-status-card">
                    <h2 className="client-subtitle" style={{ margin: '0 0 16px 0', padding: 0 }}>
                        📋 Comanda ta — {groupName}
                    </h2>
                    
                    {myItems.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', background: 'var(--surface-hover)', borderRadius: 'var(--radius-lg)', fontWeight: '600' }}>
                            Nicio comandă plasată încă. Alege produse de mai sus!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {myItems.map(item => (
                                <div key={item.id} className="order-item-row">
                                    <div>
                                        <span style={{ fontWeight: '700', fontSize: '15px' }}>{item.quantity}x {item.product.name}</span>
                                        {item.notes && (
                                            <div style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '2px', fontWeight: '600' }}>
                                                📝 {item.notes}
                                            </div>
                                        )}
                                    </div>
                                    <span className="item-status-badge" style={{
                                        background: item.status === 'ready' ? 'var(--success-bg)' : item.status === 'pending' ? 'var(--surface-hover)' : 'var(--info-bg)',
                                        color: item.status === 'ready' ? 'var(--success)' : item.status === 'pending' ? 'var(--text-muted)' : 'var(--info)',
                                        border: item.status === 'ready' ? '1px solid #a7f3d0' : '1px solid var(--border-color)'
                                    }}>
                                        {getStatusLabel(item.status)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {myItems.length > 0 && (
                        <div className="cart-total-row" style={{ borderTopStyle: 'dashed', margin: '20px 0 0 0', paddingTop: '16px' }}>
                            <span className="cart-total-label">Total consumat:</span>
                            <span className="cart-total-price">
                                {myTotal.toFixed(2)} lei
                            </span>
                        </div>
                    )}

                    {!isGroupPaid ? (
                        <button
                            className="client-btn-secondary"
                            onClick={() => { setShowAddMenu(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        >
                            ➕ Adaugă mai multe produse
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
                            fontWeight: '800',
                            fontSize: '15px',
                            animation: 'clientFadeIn 0.3s ease-out'
                        }}>
                            🎉 Grupul tău a achitat nota cu succes! Vă mulțumim și vă mai așteptăm!
                        </div>
                    )}
                </div>
            )}

            {showScrollTop && (
                <button 
                    className="back-to-top-btn" 
                    onClick={scrollToTop}
                    title="Înapoi sus"
                >
                    ▲
                </button>
            )}
        </div>
    )
}