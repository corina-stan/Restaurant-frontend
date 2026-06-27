import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../api/axios'
import '../DesktopLayout.css'
import DocumentPrintModal from '../components/DocumentPrintModal'

export default function WaiterPage() {
    const [tables, setTables] = useState([])
    const [orders, setOrders] = useState([])
    const [notifications, setNotifications] = useState([])
    const [token, setToken] = useState(null)
    const [loggedIn, setLoggedIn] = useState(false)
    const [selectedTable, setSelectedTable] = useState(null)
    const [payingOrder, setPayingOrder] = useState(null)
    const [payingGroup, setPayingGroup] = useState(null)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [tip, setTip] = useState(0)
    const [paidGroups, setPaidGroups] = useState(new Set())
    const [username, setUsername] = useState(sessionStorage.getItem('waiter_username') || '')
    const dismissedItemIds = useRef(new Set())

    const syncNotificationsFromOrders = (ordersList) => {
        setNotifications(prev => {
            let updated = [...prev]

            ordersList.forEach(order => {
                const tableNum = order.table_number
                if (order.status === 'open') {
                    // 1. Check waiter called (assistance)
                    if (order.waiter_called) {
                        const exists = updated.some(n => n.type === 'assistance_requested' && parseInt(n.table_number) === parseInt(tableNum))
                        if (!exists) {
                            updated.push({
                                type: 'assistance_requested',
                                table_number: tableNum,
                                message: `Masa ${tableNum} cere asistență`
                            })
                        }
                    }

                    // 2. Check bill requested
                    if (order.bill_requested) {
                        const exists = updated.some(n => n.type === 'bill_requested' && parseInt(n.table_number) === parseInt(tableNum))
                        if (!exists) {
                            updated.push({
                                type: 'bill_requested',
                                table_number: tableNum,
                                payment_method: order.bill_payment_method || 'cash',
                                tip: order.bill_tip || 0,
                                group_name: null,
                                group_id: null,
                                message: `💳 Masa ${tableNum} cere NOTA (${order.bill_payment_method === 'cash' ? 'Cash' : order.bill_payment_method === 'card' ? 'Card' : 'Tichet'}) cu bacșiș ${order.bill_tip} lei!`
                            })
                        }
                    }

                    // 3. Check ready items
                    const processItem = (item) => {
                        if (item.status === 'ready' && !dismissedItemIds.current.has(item.id)) {
                            const exists = updated.some(n => n.type === 'item_ready' && n.item_id === item.id)
                            if (!exists) {
                                updated.push({
                                    type: 'item_ready',
                                    item_id: item.id,
                                    product_name: item.product.name,
                                    table_number: tableNum,
                                    order_id: order.id
                                })
                            }
                        }
                    }

                    if (order.groups && order.groups.length > 0) {
                        order.groups.forEach(g => {
                            g.items?.forEach(processItem)
                        })
                    } else if (order.items) {
                        order.items.forEach(processItem)
                    }
                }
            })

            // Clean up notifications that are no longer valid on the backend (e.g. served, rejected, or table paid/dismissed)
            updated = updated.filter(n => {
                if (n.type === 'item_ready') {
                    let stillReady = false
                    ordersList.forEach(order => {
                        if (order.status === 'open') {
                            const checkItem = (item) => {
                                if (item.id === n.item_id && item.status === 'ready') {
                                    stillReady = true
                                }
                            }
                            if (order.groups && order.groups.length > 0) {
                                order.groups.forEach(g => g.items?.forEach(checkItem))
                            } else if (order.items) {
                                order.items.forEach(checkItem)
                            }
                        }
                    })
                    return stillReady && !dismissedItemIds.current.has(n.item_id)
                }

                if (n.type === 'assistance_requested') {
                    const orderForTable = ordersList.find(o => o.table_number === parseInt(n.table_number) && o.status === 'open')
                    return orderForTable ? orderForTable.waiter_called : false
                }

                if (n.type === 'bill_requested') {
                    const orderForTable = ordersList.find(o => o.table_number === parseInt(n.table_number) && o.status === 'open')
                    return orderForTable ? orderForTable.bill_requested : false
                }

                return true
            })

            return updated
        })
    }

    // Printing and history states
    const [printModalOpen, setPrintModalOpen] = useState(false)
    const [docType, setDocType] = useState('receipt_command')
    const [selectedPrintData, setSelectedPrintData] = useState(null)
    const [recentPayments, setRecentPayments] = useState([])
    const [showPaymentsHistory, setShowPaymentsHistory] = useState(false)

    useEffect(() => {
        const savedToken = sessionStorage.getItem('access_token')
        if (!savedToken) {
            window.location.href = '/login'
        } else {
            setToken(savedToken)
            setLoggedIn(true)
            loadData(savedToken)
        }
    }, [])

    const logout = () => {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('refresh_token')
        sessionStorage.removeItem('waiter_username')
        window.location.href = '/login'
    }

    const loadData = async (accessToken) => {
        try {
            const [tablesRes, ordersRes] = await Promise.all([
                api.get('/tables/all/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/orders/', { headers: { Authorization: `Bearer ${accessToken}` } })
            ])
            setTables(tablesRes.data)
            setOrders(ordersRes.data)

            const paidGroupIds = new Set()
            ordersRes.data.forEach(order => {
                order.payments?.forEach(payment => {
                    if (payment.group && payment.status === 'completed') {
                        paidGroupIds.add(payment.group)
                    }
                })
            })
            setPaidGroups(paidGroupIds)
            syncNotificationsFromOrders(ordersRes.data)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const loadOrders = async (accessToken) => {
        try {
            const res = await api.get('/orders/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            setOrders(res.data)
            syncNotificationsFromOrders(res.data)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;

    useWebSocket(
        `${wsProtocol}//${wsHost}/ws/waiters/`,
        (data) => {
            if (data.type === 'item_ready') {
                setNotifications(prev => {
                    const exists = prev.find(n => n.item_id === data.item_id)
                    if (exists) return prev
                    return [data, ...prev]
                })
                if (token) loadOrders(token)
            }
            if (data.type === 'assistance_requested') {
                setNotifications(prev => {
                    const exists = prev.find(n => n.type === 'assistance_requested' && n.table_number === data.table_number)
                    if (exists) return prev
                    return [data, ...prev]
                })
            }
            if (data.type === 'bill_requested') {
                setNotifications(prev => {
                    const exists = prev.find(n => 
                        n.type === 'bill_requested' && 
                        n.table_number === data.table_number && 
                        n.group_id === data.group_id
                    )
                    if (exists) return prev
                    return [data, ...prev]
                })
                if (token) loadOrders(token)
            }
            if (data.type === 'new_order') {
                if (token) loadOrders(token)
            }
            if (data.type === 'product_availability') {
                if (!data.is_available) {
                    setOrders(prev => prev.map(order => ({
                        ...order,
                        items: order.items.map(item =>
                            item.product.id === data.product_id
                                ? { ...item, status: 'rejected', rejection_reason: 'Produs indisponibil' }
                                : item
                        )
                    })))
                }
            }
            if (data.type === 'item_status_update') {
                if (data.status === 'served' || data.status === 'rejected') {
                    setNotifications(prev => prev.filter(n => n.item_id !== data.item_id))
                }
                if (token) loadOrders(token)
            }
            if (data.type === 'payment_completed') {
                const tNum = parseInt(data.table_number)
                const gId = data.group_id ? parseInt(data.group_id) : null
                setNotifications(prev => prev.filter(n => !(
                    n.type === 'bill_requested' && 
                    parseInt(n.table_number) === tNum && 
                    (gId === null || !n.group_id || parseInt(n.group_id) === gId)
                )))
                if (token) loadOrders(token)
            }
        }
    )

    const getTableOrder = (tableNumber) => {
        return orders.find(o => o.table_number === tableNumber && o.status === 'open')
    }

    const getTableStatus = (tableNumber) => {
        const order = getTableOrder(tableNumber)
        if (!order) return 'free'
        const hasReady = order.items.some(i => i.status === 'ready')
        const allServed = order.items.every(i => ['served', 'rejected'].includes(i.status))
        if (hasReady) return 'ready'
        if (allServed) return 'served'
        return 'active'
    }

    const getTableStatusColor = (status) => {
        const colors = {
            free: '#e2e8f0',
            active: '#bfdbfe',
            ready: '#bbf7d0',
            served: '#f1f5f9'
        }
        return colors[status] || '#e2e8f0'
    }

    const getTableStatusLabel = (tableNumber) => {
        const order = getTableOrder(tableNumber)
        if (!order) return 'Liberă'
        const readyCount = order.items.filter(i => i.status === 'ready').length
        if (readyCount > 0) return `⚠ ${readyCount} item${readyCount > 1 ? 'e' : ''} gata`
        const total = order.items
            .filter(i => i.status !== 'rejected')
            .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
        return `${order.items.length} iteme • ${total.toFixed(2)} lei`
    }

    const dismissNotification = async (idx) => {
        const n = notifications[idx]
        if (n) {
            if ((n.type === 'assistance_requested' || n.type === 'bill_requested') && n.table_number) {
                try {
                    await api.post(`/tables/${n.table_number}/dismiss_notification/`, {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                } catch (err) {
                    console.error(err)
                }
            } else if (n.type === 'item_ready' && n.item_id) {
                dismissedItemIds.current.add(n.item_id)
            }
        }
        setNotifications(prev => prev.filter((_, i) => i !== idx))
    }

    const markServed = async (itemId) => {
        try {
            await api.patch(
                `/orders/items/${itemId}/status/`,
                { status: 'served' },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setNotifications(prev => prev.filter(n => n.item_id !== itemId))
            await loadOrders(token)
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const openPayment = (order, group = null, method = null, initialTip = null) => {
        setPayingOrder(order)
        setPayingGroup(group)
        
        const finalMethod = method || order.bill_payment_method || 'cash'
        const finalTip = initialTip !== null ? initialTip : (parseFloat(order.bill_tip) || 0)
        
        setTip(finalTip)
        setPaymentMethod(finalMethod)
    }

    const getPaymentItems = () => {
        if (!payingOrder) return []
        if (payingGroup) return payingGroup.items.filter(i => i.status !== 'rejected')
        return payingOrder.groups
            ? payingOrder.groups
                .filter(g => !paidGroups.has(g.id))
                .flatMap(g => g.items)
                .filter(i => i.status !== 'rejected')
            : payingOrder.items.filter(i => i.status !== 'rejected')
    }

    const getPaymentTotal = () => {
        return getPaymentItems().reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
    }

    const processPayment = async () => {
        const items = getPaymentItems()
        const unserved = items.filter(i => !['served', 'rejected'].includes(i.status))
        if (unserved.length > 0) {
            const ok = window.confirm(
                `Atenție! Produse neservite:\n${unserved.map(i => i.product.name).join(', ')}\n\nContinui?`
            )
            if (!ok) return
        }
        try {
            const payload = {
                order_id: payingOrder.id,
                method: paymentMethod,
                tip: parseFloat(tip) || 0
            }
            if (payingGroup) payload.group_id = payingGroup.id

            const res = await api.post('/payments/create/', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (payingGroup) {
                setPaidGroups(prev => new Set([...prev, payingGroup.id]))
            }

            // Dismiss the notification on the backend
            try {
                await api.post(`/tables/${payingOrder.table_number}/dismiss_notification/`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            } catch (dismissErr) {
                console.error('Eroare la stergerea notificarii pe backend:', dismissErr)
            }

            // Instantly clear the bill request notification for this table and group locally
            const tNum = parseInt(payingOrder.table_number)
            const gId = payingGroup ? payingGroup.id : null
            setNotifications(prev => prev.filter(n => !(
                n.type === 'bill_requested' && 
                parseInt(n.table_number) === tNum && 
                (gId === null || !n.group_id || parseInt(n.group_id) === gId)
            )))

            // Instantly open the print modal for the fiscal receipt!
            setDocType('receipt_fiscal')
            setSelectedPrintData(res.data)
            setPrintModalOpen(true)

            setPayingOrder(null)
            setPayingGroup(null)
            setTip(0)
            setPaymentMethod('cash')
            loadOrders(token)
        } catch (err) {
            console.error('Eroare plată:', err)
            alert('Eroare la înregistrarea plății!')
        }
    }

    const handleShiftClosure = async () => {
        const ok = window.confirm(
            "Ești sigur că dorești să închizi tura și să generezi Raportul Z?\n" +
            "Această acțiune va închide și va deconta toate tranzacțiile tale curente."
        )
        if (!ok) return

        try {
            const res = await api.post('/payments/z-report/create/', {}, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setDocType('receipt_z')
            setSelectedPrintData(res.data)
            setPrintModalOpen(true)
        } catch (err) {
            console.error('Eroare închidere tură:', err)
            const errMsg = err.response?.data?.error || 'Eroare la generarea raportului Z!'
            alert(errMsg)
        }
    }

    const handleXReport = async () => {
        const detailed = window.confirm(
            "Cum dorești să generezi Raportul X?\n\n" +
            "Apasă [OK] pentru raport DETALIAT (cu listă de tranzacții)\n" +
            "Apasă [Cancel] pentru raport PER TOTAL (doar cifre agregate)"
        )

        try {
            const res = await api.get('/payments/shift-report/', {
                params: { detailed: detailed },
                headers: { Authorization: `Bearer ${token}` }
            })
            setDocType('receipt_x')
            setSelectedPrintData({ ...res.data, isDetailed: detailed })
            setPrintModalOpen(true)
        } catch (err) {
            console.error('Eroare raport X:', err)
            const errMsg = err.response?.data?.error || 'Eroare la generarea raportului X!'
            alert(errMsg)
        }
    }

    const getStatusLabel = (status) => {
        const labels = {
            pending: '⏳ Așteptare',
            in_progress: '👨‍🍳 Preparare',
            ready: '✅ Gata',
            served: '🍽️ Servit',
            rejected: '❌ Refuzat'
        }
        return labels[status] || status
    }

    const getStatusColor = (status) => {
        const colors = {
            pending: '#94a3b8',
            in_progress: '#f59e0b',
            ready: '#16a34a',
            served: '#2563eb',
            rejected: '#ef4444'
        }
        return colors[status] || '#94a3b8'
    }

    const selectedOrder = selectedTable ? getTableOrder(selectedTable.number) : null

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
                <h1 className="page-title" style={{ marginBottom: 0 }}>Ospătar</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 15, color: '#475569', fontWeight: '600' }}>👤 {username}</span>
                    <button 
                        onClick={async () => {
                            try {
                                const res = await api.get('/payments/recent/', { headers: { Authorization: `Bearer ${token}` } })
                                setRecentPayments(res.data)
                                setShowPaymentsHistory(true)
                            } catch (err) {
                                alert('Eroare la încărcarea istoricului plăților!')
                            }
                        }}
                        style={{ 
                            padding: '8px 16px', 
                            background: 'linear-gradient(135deg, #4f46e5, #4338ca)', 
                            color: 'white', 
                            fontSize: '13px', 
                            fontWeight: '700',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1.0)'}
                    >
                        📜 Istoric Plăți / Reprint
                    </button>
                    <button 
                        onClick={handleXReport}
                        style={{ 
                            padding: '8px 16px', 
                            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', 
                            color: 'white', 
                            fontSize: '13px', 
                            fontWeight: '700',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 2px 4px rgba(14, 165, 233, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1.0)'}
                    >
                        📊 Raport X
                    </button>
                    <button 
                        onClick={handleShiftClosure}
                        style={{ 
                            padding: '8px 16px', 
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
                            color: 'white', 
                            fontSize: '13px', 
                            fontWeight: '700',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1.0)'}
                    >
                        🔒 Închidere Tură (Raport Z)
                    </button>
                    <button className="logout-btn" onClick={logout}>Logout</button>
                </div>
            </div>

            {notifications.length > 0 && (
                <div className="notif-section">
                    {notifications.map((n, idx) => (
                        <div key={idx} className="notif-card">
                            <div className="notif-text">
                                {n.type === 'item_ready'
                                    ? `✅ ${n.product_name} — Masa ${n.table_number} e gata!`
                                    : n.type === 'bill_requested'
                                    ? `💳 Masa ${n.table_number} (${n.group_name || 'Toată masa'}) cere NOTA (${n.payment_method === 'cash' ? 'Cash' : n.payment_method === 'card' ? 'Card' : 'Tichet'}) cu bacșiș ${n.tip} lei!`
                                    : `🔔 Masa ${n.table_number} cere asistență`
                                }
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {n.type === 'item_ready' && (
                                    <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => markServed(n.item_id)}>
                                        Servit
                                    </button>
                                )}
                                {n.type === 'bill_requested' && (
                                    <button 
                                        className="btn-primary" 
                                        style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }} 
                                        onClick={() => {
                                            const tableOrder = getTableOrder(parseInt(n.table_number));
                                            if (tableOrder) {
                                                const groupObj = n.group_id ? tableOrder.groups?.find(g => g.id === parseInt(n.group_id)) : null;
                                                openPayment(tableOrder, groupObj, n.payment_method, n.tip);
                                            } else {
                                                alert('Această masă a fost deja încasată sau nu are o comandă activă.');
                                                dismissNotification(idx);
                                            }
                                        }}
                                    >
                                        Încasează
                                    </button>
                                )}
                                <button className="logout-btn" style={{ padding: '6px 12px' }} onClick={() => dismissNotification(idx)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="split-view">
                <div className="tables-section">
                    <h2 style={{ fontSize: '24px', color: '#1e293b', marginBottom: '20px', fontWeight: '700' }}>Mese</h2>
                    <div className="table-grid">
                        {tables.map(table => {
                            const status = getTableStatus(table.number)
                            const isSelected = selectedTable?.id === table.id
                            return (
                                <div
                                    key={table.id}
                                    className={`table-card ${isSelected ? 'selected' : ''}`}
                                    style={{ background: getTableStatusColor(status) }}
                                    onClick={() => setSelectedTable(isSelected ? null : table)}
                                >
                                    <div className="number">Masa {table.number}</div>
                                    <div className="status">
                                        {getTableStatusLabel(table.number)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="details-panel" style={{ display: selectedTable ? 'block' : 'none' }}>
                    {selectedTable && (
                        <>
                            <div className="detail-header">
                                <span className="detail-title">Masa {selectedTable.number}</span>
                                <button className="close-btn" onClick={() => setSelectedTable(null)}>✕</button>
                            </div>

                            {!selectedOrder ? (
                                <div className="empty-state" style={{ border: 'none', padding: '40px 0', margin: 0 }}>Masă liberă — nicio comandă activă</div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: '16px' }}>
                                        <div style={{ fontSize: 14, color: '#64748b', fontWeight: '500' }}>
                                            Comandă din {new Date(selectedOrder.created_at).toLocaleTimeString()}
                                        </div>
                                    </div>

                                    {selectedOrder.groups && selectedOrder.groups.length > 0 ? (
                                        <>
                                            {selectedOrder.groups.map(group => {
                                                const isPaid = paidGroups.has(group.id)
                                                const groupTotal = group.items
                                                    .filter(i => i.status !== 'rejected')
                                                    .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                                return (
                                                    <div key={group.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #f1f5f9', opacity: isPaid ? 0.6 : 1 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                            <span style={{ fontWeight: '700', color: '#4f46e5', fontSize: 16 }}>
                                                                {group.name}
                                                                {isPaid && <span style={{ color: '#10b981', marginLeft: 8 }}>✓ Plătit</span>}
                                                            </span>
                                                            <span style={{ fontWeight: '700', color: '#0f172a', fontSize: 16 }}>{groupTotal.toFixed(2)} lei</span>
                                                        </div>
                                                        {group.items.map(item => (
                                                            <div key={item.id} className="card-item-row">
                                                                <div>
                                                                    <span style={{ fontWeight: '600' }}>{item.quantity}x {item.product.name}</span>
                                                                    {item.notes && (
                                                                        <div className="item-notes" style={{ display: 'block', marginTop: 4 }}>
                                                                            {item.notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span className="status-pill" style={{ background: getStatusColor(item.status) }}>
                                                                        {getStatusLabel(item.status)}
                                                                    </span>
                                                                    {item.status === 'ready' && (
                                                                        <button 
                                                                            onClick={() => markServed(item.id)}
                                                                            style={{
                                                                                padding: '6px 12px',
                                                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '8px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '12px',
                                                                                fontWeight: '700',
                                                                                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                                                                                transition: 'all 0.2s'
                                                                            }}
                                                                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1.0)'}
                                                                        >
                                                                            Servit
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {!isPaid && (
                                                            <button
                                                                className="btn-primary"
                                                                style={{ width: '100%', marginTop: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                                                                onClick={() => openPayment(selectedOrder, group)}
                                                            >
                                                                Încasează {group.name}
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {(() => {
                                                const unpaidGroups = selectedOrder.groups.filter(g => !paidGroups.has(g.id))
                                                const unpaidTotal = unpaidGroups
                                                    .flatMap(g => g.items)
                                                    .filter(i => i.status !== 'rejected')
                                                    .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                                const allPaid = unpaidGroups.length === 0
                                                return (
                                                    <>
                                                        <div style={{ fontWeight: '800', marginTop: 24, fontSize: 20, textAlign: 'right', color: '#0f172a' }}>
                                                            {allPaid
                                                                ? 'Toate grupurile au plătit ✓'
                                                                : `Total rămas: ${unpaidTotal.toFixed(2)} lei`
                                                            }
                                                        </div>
                                                        {!allPaid && (
                                                            <button className="btn-primary" style={{ width: '100%', marginTop: 16, fontSize: 16 }} onClick={() => openPayment(selectedOrder, null)}>
                                                                Încasează tot ({unpaidGroups.length > 1 ? `${unpaidGroups.length} grupuri` : unpaidGroups[0]?.name})
                                                            </button>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </>
                                    ) : (
                                        <>
                                            {selectedOrder.items.map(item => (
                                                <div key={item.id} className="card-item-row">
                                                    <div>
                                                        <span style={{ fontWeight: '600' }}>{item.quantity}x {item.product.name}</span>
                                                        {item.notes && (
                                                            <div className="item-notes" style={{ display: 'block', marginTop: 4 }}>
                                                                {item.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className="status-pill" style={{ background: getStatusColor(item.status) }}>
                                                            {getStatusLabel(item.status)}
                                                        </span>
                                                        {item.status === 'ready' && (
                                                            <button 
                                                                onClick={() => markServed(item.id)}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                                                    color: 'white',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px',
                                                                    fontWeight: '700',
                                                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                                                onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1.0)'}
                                                            >
                                                                Servit
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ fontWeight: '800', marginTop: 24, fontSize: 20, textAlign: 'right', color: '#0f172a' }}>
                                                Total: {selectedOrder.items
                                                    .filter(i => i.status !== 'rejected')
                                                    .reduce((s, i) => s + i.quantity * parseFloat(i.unit_price), 0)
                                                    .toFixed(2)} lei
                                            </div>
                                            <button className="btn-primary" style={{ width: '100%', marginTop: 16, fontSize: 16 }} onClick={() => openPayment(selectedOrder, null)}>
                                                Încasează
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {payingOrder && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 style={{ fontSize: 24, fontWeight: '800', marginBottom: 8, color: '#0f172a' }}>Notă de plată</h2>
                        <div style={{ color: '#4f46e5', fontWeight: '700', marginBottom: 24, fontSize: 16 }}>
                            Masa {payingOrder.table_number}
                            {payingGroup && ` — ${payingGroup.name}`}
                        </div>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 16, paddingRight: 8 }}>
                            {getPaymentItems().map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, borderBottom: '1px solid #f1f5f9' }}>
                                    <span style={{ fontWeight: '500' }}>{item.quantity}x {item.product.name}</span>
                                    <span style={{ fontWeight: '600' }}>{(item.quantity * parseFloat(item.unit_price)).toFixed(2)} lei</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ borderTop: '2px solid #e2e8f0', margin: '16px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: 16, marginBottom: 16 }}>
                            <span>Total consumație:</span>
                            <span>{getPaymentTotal().toFixed(2)} lei</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <span style={{ fontWeight: '600' }}>Bacșiș:</span>
                            <input
                                type="number"
                                min="0"
                                style={{ width: 80, padding: '8px 12px', borderRadius: 10, border: '2px solid #cbd5e1', fontSize: 16, outline: 'none' }}
                                value={tip}
                                onChange={e => setTip(e.target.value)}
                                placeholder="0"
                            />
                            <span style={{ fontWeight: '600' }}>lei</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: 20, marginBottom: 24, color: '#0f172a' }}>
                            <span>Total de plată:</span>
                            <span style={{ color: '#10b981' }}>{(getPaymentTotal() + (parseFloat(tip) || 0)).toFixed(2)} lei</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                            {['cash', 'card', 'ticket'].map(m => (
                                <button
                                    key={m}
                                    style={{
                                        flex: 1, padding: '12px 0', borderRadius: 12,
                                        border: paymentMethod === m ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                                        background: paymentMethod === m ? '#e0e7ff' : '#f8fafc',
                                        color: paymentMethod === m ? '#4f46e5' : '#475569',
                                        fontWeight: '700', cursor: 'pointer', fontSize: 14,
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setPaymentMethod(m)}
                                >
                                    {m === 'cash' ? '💵 Numerar' : m === 'card' ? '💳 Card' : '🎟️ Tichet'}
                                </button>
                            ))}
                        </div>
                        <button className="btn-primary" style={{ width: '100%', marginBottom: 12, fontSize: 16, padding: '14px 0' }} onClick={processPayment}>
                            Confirmă plata
                        </button>
                        <button
                            className="logout-btn"
                            style={{ width: '100%', fontSize: 16, padding: '14px 0' }}
                            onClick={() => { setPayingOrder(null); setPayingGroup(null) }}
                        >
                            Anulează
                        </button>
                    </div>
                </div>
            )}
            {showPaymentsHistory && (
                <div className="modal-overlay" style={{ zIndex: 1200 }}>
                    <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: 22, fontWeight: '800', margin: 0, color: '#0f172a' }}>📜 Istoric Plăți Recente</h2>
                            <button 
                                onClick={() => setShowPaymentsHistory(false)} 
                                style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                ✕
                            </button>
                        </div>
                        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>
                            Aici găsești ultimele 50 de plăți înregistrate pe platformă. Poți tipări din nou orice bon fiscal:
                        </p>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'grid', gap: '12px', paddingRight: '4px' }}>
                            {recentPayments.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '14px' }}>Nicio plată înregistrată recent.</div>
                            ) : (
                                recentPayments.map(pay => {
                                    const payDate = new Date(pay.created_at);
                                    const formattedPayDate = `${payDate.toLocaleDateString('ro-RO')} ${payDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
                                    const payMethodLabel = pay.method === 'cash' ? '💵 Numerar' : pay.method === 'card' ? '💳 Card' : '🎟️ Tichet';
                                    
                                    return (
                                        <div key={pay.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ fontSize: '14px' }}>
                                                <div style={{ fontWeight: '700', color: '#0f172a' }}>Bon Fiscal #{pay.id} • Masa {pay.order_details?.table_number || '?'}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                    {formattedPayDate} • {payMethodLabel}
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#4f46e5', marginTop: '6px' }}>
                                                    Consumație: {parseFloat(pay.amount).toFixed(2)} lei {pay.tip > 0 && `(+ ${parseFloat(pay.tip).toFixed(2)} lei bacșiș)`}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setDocType('receipt_fiscal');
                                                    setSelectedPrintData({ ...pay, is_copy: true });
                                                    setPrintModalOpen(true);
                                                }}
                                                style={{
                                                    background: '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '8px 14px',
                                                    borderRadius: '8px',
                                                    fontSize: '13px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                🖨️ Reprint
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}

            <DocumentPrintModal
                isOpen={printModalOpen}
                onClose={() => { setPrintModalOpen(false); setSelectedPrintData(null); }}
                documentType={docType}
                data={selectedPrintData}
            />
        </div>
    )
}