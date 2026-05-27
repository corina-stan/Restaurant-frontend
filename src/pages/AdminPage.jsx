import { useState, useEffect } from 'react'
import api from '../api/axios'
import '../DesktopLayout.css'

export default function AdminPage() {
    const [loggedIn, setLoggedIn] = useState(false)
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const [token, setToken] = useState(null)
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [users, setUsers] = useState([])
    const [ingredients, setIngredients] = useState([])
    const [invoices, setInvoices] = useState([])
    const [loading, setLoading] = useState(false)
    
    const [activeTab, setActiveTab] = useState('menu')

    // Editing & Creation state
    const [editingProduct, setEditingProduct] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', price: '', requires_recipe: true })
    const [productSearch, setProductSearch] = useState('')
    
    const [showNewProductForm, setShowNewProductForm] = useState(false)
    const [newProductForm, setNewProductForm] = useState({ name: '', price: '', category: '', is_available: true, requires_recipe: true })
    
    const [showNewUserForm, setShowNewUserForm] = useState(false)
    const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'waiter', first_name: '', last_name: '' })

    // Inventory state
    const [showNewIngredientForm, setShowNewIngredientForm] = useState(false)
    const [newIngredient, setNewIngredient] = useState({ name: '', unit: 'kg' })
    const [inventorySearchQuery, setInventorySearchQuery] = useState('')
    const [showIngredientsDropdown, setShowIngredientsDropdown] = useState(false)
    const [expandedInvoices, setExpandedInvoices] = useState({})

    const normalizeString = (str) => {
        if (!str) return ''
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
    }

    const toggleInvoiceExpand = (invId) => {
        setExpandedInvoices(prev => ({
            ...prev,
            [invId]: !prev[invId]
        }))
    }
    
    // Purchase Invoices (NIR) state
    const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false)
    const [newInvoice, setNewInvoice] = useState({ invoice_number: '', supplier_name: '', supplier_id: null, date: new Date().toISOString().split('T')[0] })
    const [newInvoiceItems, setNewInvoiceItems] = useState([])
    const [invoiceLine, setInvoiceLine] = useState({ ingredientName: '', quantity: '', unit_price_without_vat: '', vat_rate: 11 })

    // Suppliers State
    const [suppliers, setSuppliers] = useState([])
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('')
    const [showSuppliersDropdown, setShowSuppliersDropdown] = useState(false)
    const [showNewSupplierForm, setShowNewSupplierForm] = useState(false)
    const [newSupplierData, setNewSupplierData] = useState({ name: '', fiscal_code: '', trade_registry_number: '', address: '' })

    const handleSelectSupplier = (sup) => {
        setNewInvoice(prev => ({
            ...prev,
            supplier_id: sup.id,
            supplier_name: sup.name
        }))
        setSupplierSearchQuery(sup.name)
        setShowSuppliersDropdown(false)
        setShowNewSupplierForm(false)
    }

    const handleSupplierSearchChange = (val) => {
        setSupplierSearchQuery(val)
        setNewInvoice(prev => ({
            ...prev,
            supplier_id: null,
            supplier_name: val
        }))
        setShowSuppliersDropdown(true)
    }

    const handleCreateSupplier = async () => {
        if (!supplierSearchQuery.trim()) {
            alert('Te rog să introduci numele furnizorului!')
            return
        }
        try {
            const payload = {
                name: supplierSearchQuery.trim(),
                fiscal_code: newSupplierData.fiscal_code.trim(),
                trade_registry_number: newSupplierData.trade_registry_number.trim(),
                address: newSupplierData.address.trim()
            }
            const res = await api.post('/menu/suppliers/', payload, { headers: { Authorization: `Bearer ${token}` } })
            
            // Add to suppliers list
            setSuppliers(prev => [...prev, res.data])
            
            // Select it automatically
            setNewInvoice(prev => ({
                ...prev,
                supplier_id: res.data.id,
                supplier_name: res.data.name
            }))
            
            // Reset states
            setShowNewSupplierForm(false)
            setShowSuppliersDropdown(false)
            setNewSupplierData({ name: '', fiscal_code: '', trade_registry_number: '', address: '' })
            alert(`Furnizorul "${res.data.name}" a fost creat și selectat cu succes!`)
        } catch (err) {
            alert('Eroare la crearea furnizorului. Posibil ca acest nume să fie deja utilizat.')
        }
    }

    // Recipe state
    const [recipeViewProduct, setRecipeViewProduct] = useState(null)
    const [productRecipes, setProductRecipes] = useState([])
    const [newRecipeItem, setNewRecipeItem] = useState({ ingredient: '', quantity: '' })

    // Reports State
    const [reportData, setReportData] = useState({ labels: [], datasets: [] })
    const [reportPeriod, setReportPeriod] = useState('day') // day, week, month
    const [reportBreakdown, setReportBreakdown] = useState('total') // total, category, product
    const [reportChartType, setReportChartType] = useState('line') // line, bar
    const [reportPreset, setReportPreset] = useState('30d') // 7d, 30d, 90d, custom
    const [reportCustomDates, setReportCustomDates] = useState({ start: '', end: '' })

    // Logs State
    const [logs, setLogs] = useState([])
    const [logSearch, setLogSearch] = useState('')
    const [logRoleFilter, setLogRoleFilter] = useState('all')
    const [logTypeFilter, setLogTypeFilter] = useState('all')

    const loadData = async (accessToken) => {
        try {
            setLoading(true)
            const [prodRes, catRes, userRes, ingRes, invRes, supRes] = await Promise.all([
                api.get('/menu/products/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/categories/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/accounts/users/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/ingredients/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/purchase_invoices/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/suppliers/', { headers: { Authorization: `Bearer ${accessToken}` } })
            ])
            setProducts(prodRes.data)
            setCategories(catRes.data)
            setUsers(userRes.data)
            setIngredients(ingRes.data)
            setInvoices(invRes.data)
            setSuppliers(supRes.data)
        } catch (err) {
            console.error(err)
            if (err.response?.status === 401) {
                logout()
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const savedToken = sessionStorage.getItem('admin_token')
        if (savedToken) {
            setToken(savedToken)
            setLoggedIn(true)
            loadData(savedToken)
        }
    }, [])

    const login = async () => {
        try {
            const res = await api.post('/token/', credentials)
            const payload = JSON.parse(atob(res.data.access.split('.')[1]))

            if (payload.role !== 'admin' && !payload.is_superuser) {
                alert('Nu ai permisiunea de a accesa panoul de administrare!')
                return
            }

            sessionStorage.setItem('admin_token', res.data.access)
            setToken(res.data.access)
            setLoggedIn(true)
            await loadData(res.data.access)
        } catch (err) {
            alert('Username sau parolă greșite!')
        }
    }

    const logout = () => {
        sessionStorage.removeItem('admin_token')
        setToken(null)
        setLoggedIn(false)
        setProducts([])
        setUsers([])
        setIngredients([])
        setSuppliers([])
        setInvoices([])
    }


    const loadReportData = async () => {
        if (!token) return
        try {
            setLoading(true)
            let start = ''
            let end = ''
            if (reportPreset !== 'custom') {
                const now = new Date()
                let daysAgo = 30
                if (reportPreset === '7d') daysAgo = 7
                else if (reportPreset === '90d') daysAgo = 90
                else if (reportPreset === 'today') daysAgo = 0
                
                const pastDate = new Date()
                pastDate.setDate(now.getDate() - daysAgo)
                
                start = pastDate.toISOString().split('T')[0]
                end = now.toISOString().split('T')[0]
            } else {
                start = reportCustomDates.start
                end = reportCustomDates.end
            }

            const res = await api.get('/orders/reports/', {
                params: {
                    period: reportPeriod,
                    breakdown: reportBreakdown,
                    start_date: start,
                    end_date: end
                },
                headers: { Authorization: `Bearer ${token}` }
            })
            setReportData(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const loadLogsData = async () => {
        if (!token) return
        try {
            setLoading(true)
            const res = await api.get('/orders/operation-logs/', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setLogs(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'reports') {
            loadReportData()
        } else if (activeTab === 'logs') {
            loadLogsData()
        }
    }, [activeTab, reportPeriod, reportBreakdown, reportPreset, reportCustomDates, token])

    // --- Product Management ---
    const toggleAvailability = async (productId) => {
        try {
            const res = await api.patch(
                `/menu/products/${productId}/toggle_availability/`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_available: res.data.is_available } : p))
        } catch (err) {
            alert('A apărut o eroare!')
        }
    }

    const startEditing = (product) => {
        setEditingProduct(product.id)
        setEditForm({ name: product.name, price: product.price, requires_recipe: product.requires_recipe })
    }

    const cancelEditing = () => {
        setEditingProduct(null)
        setEditForm({ name: '', price: '', requires_recipe: true })
    }

    const saveProduct = async (productId) => {
        try {
            const res = await api.patch(
                `/menu/products/${productId}/`,
                { name: editForm.name, price: editForm.price, requires_recipe: editForm.requires_recipe },
                { headers: { Authorization: `Bearer ${token}` } }
            )
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, name: res.data.name, price: res.data.price, requires_recipe: res.data.requires_recipe } : p))
            cancelEditing()
        } catch (err) {
            alert('Nu s-a putut salva produsul.')
        }
    }

    const createProduct = async () => {
        if (!newProductForm.name || !newProductForm.price || !newProductForm.category) {
            alert('Completează toate câmpurile obligatorii!')
            return
        }
        try {
            const res = await api.post('/menu/products/', newProductForm, { headers: { Authorization: `Bearer ${token}` } })
            setProducts([...products, res.data])
            setShowNewProductForm(false)
            setNewProductForm({ name: '', price: '', category: '', is_available: true, requires_recipe: true })
        } catch (err) {
            alert('Eroare la crearea produsului.')
        }
    }

    // --- Recipe Management ---
    const openRecipe = async (product) => {
        setRecipeViewProduct(product)
        try {
            const res = await api.get(`/menu/recipes/?product=${product.id}`, { headers: { Authorization: `Bearer ${token}` } })
            setProductRecipes(res.data)
        } catch (err) {
            alert('Eroare la încărcarea rețetei.')
        }
    }

    const closeRecipe = () => {
        setRecipeViewProduct(null)
        setProductRecipes([])
        setNewRecipeItem({ ingredient: '', quantity: '' })
    }

    const addRecipeItem = async () => {
        if (!newRecipeItem.ingredient || !newRecipeItem.quantity) return
        try {
            const payload = { product: recipeViewProduct.id, ingredient: newRecipeItem.ingredient, quantity: newRecipeItem.quantity }
            const res = await api.post('/menu/recipes/', payload, { headers: { Authorization: `Bearer ${token}` } })
            setProductRecipes([...productRecipes, res.data])
            setNewRecipeItem({ ingredient: '', quantity: '' })
        } catch (err) {
            alert('Eroare. Ingredientul este deja pe rețetă sau date invalide.')
        }
    }

    const deleteRecipeItem = async (id) => {
        if (!window.confirm('Elimini acest ingredient de pe rețetă?')) return
        try {
            await api.delete(`/menu/recipes/${id}/`, { headers: { Authorization: `Bearer ${token}` } })
            setProductRecipes(productRecipes.filter(r => r.id !== id))
        } catch (err) {
            alert('Eroare la ștergere.')
        }
    }

    // --- User Management ---
    const createUser = async () => {
        if (!newUserForm.username || !newUserForm.password) {
            alert('Username și parolă sunt obligatorii!')
            return
        }
        try {
            const res = await api.post('/accounts/users/', newUserForm, { headers: { Authorization: `Bearer ${token}` } })
            setUsers([...users, res.data])
            setShowNewUserForm(false)
            setNewUserForm({ username: '', password: '', role: 'waiter', first_name: '', last_name: '' })
        } catch (err) {
            alert('Eroare la crearea utilizatorului (posibil username deja existent).')
        }
    }

    const deleteUser = async (id) => {
        if (!window.confirm('Sigur ștergi acest angajat?')) return
        try {
            await api.delete(`/accounts/users/${id}/`, { headers: { Authorization: `Bearer ${token}` } })
            setUsers(users.filter(u => u.id !== id))
        } catch (err) {
            alert('Eroare la ștergere.')
        }
    }

    // --- Inventory Management ---
    const createIngredient = async () => {
        if (!newIngredient.name) return
        try {
            const res = await api.post('/menu/ingredients/', newIngredient, { headers: { Authorization: `Bearer ${token}` } })
            setIngredients([...ingredients, res.data])
            setShowNewIngredientForm(false)
            setNewIngredient({ name: '', unit: 'kg' })
        } catch (err) {
            alert('Eroare la creare.')
        }
    }

    const addInvoiceLine = async () => {
        if (!invoiceLine.ingredientName || !invoiceLine.quantity || invoiceLine.quantity <= 0) {
            alert('Completează ingredientul și o cantitate validă!')
            return
        }

        let finalIngredientId = null
        let finalIngredientName = invoiceLine.ingredientName.trim()
        let finalIngredientUnit = 'kg'

        const existingIng = ingredients.find(i => i.name.toLowerCase() === finalIngredientName.toLowerCase())
        
        if (existingIng) {
            finalIngredientId = existingIng.id
            finalIngredientName = existingIng.name
            finalIngredientUnit = existingIng.unit
        } else {
            const confirmCreate = window.confirm(`Ingredientul "${finalIngredientName}" nu există în magazie. Doriți să îl creați acum?`)
            if (!confirmCreate) return

            const unit = window.prompt(`Introduceți unitatea de măsură pentru "${finalIngredientName}" (ex: kg, buc, litru, g, ml):`, "buc")
            if (!unit) return

            try {
                const res = await api.post('/menu/ingredients/', { name: finalIngredientName, unit: unit.trim() }, { headers: { Authorization: `Bearer ${token}` } })
                const newIng = res.data
                setIngredients([...ingredients, newIng])
                finalIngredientId = newIng.id
                finalIngredientName = newIng.name
                finalIngredientUnit = newIng.unit
            } catch (err) {
                alert('Eroare la crearea ingredientului.')
                return
            }
        }

        setNewInvoiceItems([...newInvoiceItems, {
            ingredient: finalIngredientId,
            ingredient_name: finalIngredientName,
            ingredient_unit: finalIngredientUnit,
            quantity: invoiceLine.quantity,
            unit_price_without_vat: invoiceLine.unit_price_without_vat || null,
            vat_rate: invoiceLine.vat_rate
        }])

        setInvoiceLine({ ingredientName: '', quantity: '', unit_price_without_vat: '', vat_rate: invoiceLine.vat_rate })
    }

    const submitInvoice = async () => {
        if (!newInvoice.invoice_number || !newInvoice.supplier_name || !newInvoice.date) {
            alert('Completează datele facturii (număr, furnizor, data)!')
            return
        }
        if (newInvoiceItems.length === 0) {
            alert('Factura nu are nicio linie!')
            return
        }

        try {
            const payload = { ...newInvoice, items: newInvoiceItems }
            const res = await api.post('/menu/purchase_invoices/', payload, { headers: { Authorization: `Bearer ${token}` } })
            
            setInvoices([res.data, ...invoices])
            const ingRes = await api.get('/menu/ingredients/', { headers: { Authorization: `Bearer ${token}` } })
            setIngredients(ingRes.data)
            
            setShowNewInvoiceForm(false)
            setNewInvoice({ invoice_number: '', supplier_name: '', supplier_id: null, date: new Date().toISOString().split('T')[0] })
            setSupplierSearchQuery('')
            setNewInvoiceItems([])
        } catch (err) {
            alert('Eroare la salvarea facturii.')
        }
    }

    if (!loggedIn) {
        return (
            <div className="login-screen">
                <div className="login-box">
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <h1 className="page-title" style={{ marginBottom: '8px' }}>Restaurant Admin</h1>
                        <p style={{ color: '#64748b', fontSize: '15px' }}>Autentificare securizată</p>
                    </div>
                    <input
                        className="login-input"
                        placeholder="Username Administrator"
                        value={credentials.username}
                        onChange={e => setCredentials(p => ({ ...p, username: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && login()}
                    />
                    <input
                        className="login-input"
                        type="password"
                        placeholder="Parolă"
                        value={credentials.password}
                        onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && login()}
                    />
                    <button className="login-btn" style={{ background: '#0f172a' }} onClick={login}>Intră în Dashboard</button>
                </div>
            </div>
        )
    }

    // Product filtering and sorting
    let filteredProducts = products.filter(p => normalizeString(p.name).includes(normalizeString(productSearch)))
    
    // Sort all alphabetically
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name))

    const productsByCategory = categories.reduce((acc, cat) => {
        // Only include available products in their normal categories
        acc[cat.name] = filteredProducts.filter(p => p.is_available && (p.category === cat.id || (p.category && p.category.id === cat.id)))
        return acc
    }, {})

    const allCategorizedIds = [].concat(...Object.values(productsByCategory).map(list => list.map(p => p.id)))
    const uncategorized = filteredProducts.filter(p => p.is_available && !allCategorizedIds.includes(p.id))
    if (uncategorized.length > 0) {
        productsByCategory['Altele'] = uncategorized
    }

    // Add unavailable products at the very end as a separate category
    const unavailableProducts = filteredProducts.filter(p => !p.is_available)
    if (unavailableProducts.length > 0) {
        productsByCategory['🔴 Produse Indisponibile'] = unavailableProducts
    }

    const roleMap = { 'admin': 'Admin', 'waiter': 'Ospătar', 'barman': 'Barman', 'kitchen': 'Bucătărie' }

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
            {/* Sidebar */}
            <div style={{ width: '280px', background: '#0f172a', color: '#f8fafc', padding: '32px 24px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ fontSize: '24px', fontWeight: '800', marginBottom: '48px', letterSpacing: '-0.5px' }}>
                    🍽️ Admin Panel
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div onClick={() => setActiveTab('menu')} style={{ padding: '12px 16px', background: activeTab === 'menu' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}>
                        📋 Gestiune Meniu
                    </div>
                    <div onClick={() => setActiveTab('inventory')} style={{ padding: '12px 16px', background: activeTab === 'inventory' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}>
                        📦 Gestiune Stocuri
                    </div>
                    <div onClick={() => setActiveTab('reports')} style={{ padding: '12px 16px', background: activeTab === 'reports' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}>
                        📊 Rapoarte Vânzări
                    </div>
                    <div onClick={() => setActiveTab('logs')} style={{ padding: '12px 16px', background: activeTab === 'logs' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}>
                        📜 Istoric Operări
                    </div>
                    <div onClick={() => setActiveTab('employees')} style={{ padding: '12px 16px', background: activeTab === 'employees' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}>
                        👥 Angajați
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '24px', marginTop: 'auto' }}>
                    <div style={{ marginBottom: '16px', fontSize: '14px', color: '#94a3b8' }}>Logat ca Admin</div>
                    <button onClick={logout} style={{ width: '100%', padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>
                        Deconectare
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, padding: '40px 48px', overflowY: 'auto' }}>
                
                {/* GLOBAL LOW STOCK ALERTS BANNER */}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Se încarcă datele...</div>
                ) : activeTab === 'menu' ? (
                    <>
                        {/* REȚETĂ MODAL INLINE OVERLAY */}
                        {recipeViewProduct && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                                <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Rețetar: {recipeViewProduct.name}</h2>
                                        <button onClick={closeRecipe} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
                                    </div>
                                    
                                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                        <h4 style={{ margin: '0 0 12px 0', color: '#475569' }}>Adaugă Ingredient pe Rețetă</h4>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <select value={newRecipeItem.ingredient} onChange={e => setNewRecipeItem({...newRecipeItem, ingredient: e.target.value})} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                <option value="">Alege materia primă...</option>
                                                {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                            </select>
                                            <input type="number" placeholder="Cantitate" value={newRecipeItem.quantity} onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                            <button onClick={addRecipeItem} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '0 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Adaugă</button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', padding: '0 12px 12px 12px', fontSize: '14px', fontWeight: '600', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                                        <div>Ingredient</div>
                                        <div>Cantitate Necesară</div>
                                        <div>Acțiune</div>
                                    </div>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '12px' }}>
                                        {productRecipes.map(r => (
                                            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', padding: '12px', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ fontWeight: '600', color: '#1e293b' }}>{r.ingredient_name}</div>
                                                <div style={{ color: '#475569' }}>{r.quantity} {r.ingredient_unit}</div>
                                                <button onClick={() => deleteRecipeItem(r.id)} style={{ padding: '6px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Șterge</button>
                                            </div>
                                        ))}
                                        {productRecipes.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Niciun ingredient adăugat.</div>}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Gestiune Meniu</h1>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <input 
                                    type="text" 
                                    placeholder="Caută preparat..." 
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', width: '250px', outline: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                />
                                <div style={{ background: '#ffffff', padding: '12px 24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', fontWeight: '600', color: '#475569' }}>
                                    Total: {filteredProducts.length}
                                </div>
                                <button onClick={() => setShowNewProductForm(!showNewProductForm)} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)' }}>
                                    + Produs Nou
                                </button>
                            </div>
                        </div>

                        {showNewProductForm && (
                            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', marginBottom: '32px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                <button onClick={() => setShowNewProductForm(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', padding: '0' }}>✕</button>
                                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', paddingRight: '24px' }}>Adaugă Produs</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Denumire</label>
                                        <input value={newProductForm.name} onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Preț</label>
                                        <input type="number" value={newProductForm.price} onChange={e => setNewProductForm({...newProductForm, price: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Categorie</label>
                                        <select value={newProductForm.category} onChange={e => setNewProductForm({...newProductForm, category: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                            <option value="">Alege...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px' }}>
                                        <input type="checkbox" checked={newProductForm.requires_recipe} onChange={e => setNewProductForm({...newProductForm, requires_recipe: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Are rețetă / Scade din stoc</label>
                                    </div>
                                    <button onClick={createProduct} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', height: '42px' }}>
                                        Salvează
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {Object.entries(productsByCategory).map(([catName, prods]) => {
                                if (prods.length === 0) return null;
                                return (
                                    <div key={catName} style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #f1f5f9' }}>
                                            {catName}
                                        </h2>
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: '16px', padding: '0 16px 12px 16px', fontSize: '14px', fontWeight: '600', color: '#64748b' }}>
                                                <div>Produs</div>
                                                <div>Preț</div>
                                                <div style={{ textAlign: 'center' }}>Disponibilitate</div>
                                                <div style={{ textAlign: 'right' }}>Acțiuni</div>
                                            </div>

                                            {prods.map(product => (
                                                <div key={product.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: '16px', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                    <div>
                                                        {editingProduct === product.id ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                                                                    <input type="checkbox" checked={editForm.requires_recipe} onChange={e => setEditForm({...editForm, requires_recipe: e.target.checked})} /> Are rețetă / Scade din stoc
                                                                </label>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontWeight: '600', color: '#0f172a' }}>{product.name}</span>
                                                                {!product.has_recipe && product.requires_recipe && (
                                                                    <span title="Acest produs necesită o rețetă dar nu ai adăugat nicio materie primă!" style={{ background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', border: '1px solid #fca5a5' }}>
                                                                        ⚠️ Fără Rețetă
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        {editingProduct === product.id ? (
                                                            <input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} style={{ width: '100px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                                                        ) : (
                                                            <div style={{ color: '#475569', fontWeight: '500' }}>{product.price} lei</div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <button onClick={() => toggleAvailability(product.id)} style={{ width: '56px', height: '32px', borderRadius: '30px', border: 'none', cursor: 'pointer', background: product.is_available ? '#22c55e' : '#ef4444', position: 'relative', transition: 'background 0.3s' }}>
                                                            <div style={{ width: '24px', height: '24px', background: '#ffffff', borderRadius: '50%', position: 'absolute', top: '4px', left: product.is_available ? '28px' : '4px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        <button onClick={() => openRecipe(product)} style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Rețetă</button>
                                                        {editingProduct === product.id ? (
                                                            <>
                                                                <button onClick={() => saveProduct(product.id)} style={{ padding: '6px 12px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>✓</button>
                                                                <button onClick={cancelEditing} style={{ padding: '6px 12px', background: '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>✕</button>
                                                            </>
                                                        ) : (
                                                            <button onClick={() => startEditing(product)} style={{ padding: '6px 16px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>Editează</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                ) : activeTab === 'inventory' ? (
                    <>
                        {/* INVENTORY TAB */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Gestiune Stocuri</h1>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setShowNewInvoiceForm(!showNewInvoiceForm)} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.3)' }}>
                                    📥 Recepție Marfă (NIR Nou)
                                </button>
                                <button onClick={() => setShowNewIngredientForm(!showNewIngredientForm)} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)' }}>
                                    + Materie Primă Nouă
                                </button>
                            </div>
                        </div>

                        {/* Prominent Low Stock Notifications Alert Widget */}
                        {ingredients.filter(i => i.is_low_stock).length > 0 && (
                            <div style={{ 
                                background: '#fff7ed', 
                                border: '1px solid #ffedd5', 
                                borderRadius: '16px', 
                                padding: '20px', 
                                marginBottom: '32px', 
                                boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.05)',
                                borderLeft: '5px solid #ea580c'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '20px' }}>⚠️</span>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#ea580c' }}>
                                        Atenție: Produse cu Stoc Scăzut ({ingredients.filter(i => i.is_low_stock).length})
                                    </h3>
                                </div>
                                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#c2410c', fontWeight: '500' }}>
                                    Următoarele materii prime au coborât sub pragul de alertă stabilit. Se recomandă reaprovizionarea!
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {ingredients.filter(i => i.is_low_stock).map(ing => (
                                        <div key={ing.id} style={{ background: '#ffffff', border: '1px solid #ffedd5', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                            <span style={{ fontWeight: '700', color: '#1e293b' }}>{ing.name}</span>
                                            <span style={{ color: '#ea580c', fontWeight: '800' }}>{ing.current_stock} {ing.unit}</span>
                                            <span style={{ background: '#ffedd5', color: '#ea580c', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                                                sub {ing.alert_threshold_percentage}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showNewIngredientForm && (
                            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', marginBottom: '32px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                <button onClick={() => setShowNewIngredientForm(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', padding: '0' }}>✕</button>
                                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', paddingRight: '24px' }}>Adaugă Materie Primă (Ingredient)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Denumire (ex: Făină Albă)</label>
                                        <input value={newIngredient.name} onChange={e => setNewIngredient({...newIngredient, name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>UM (Unitate Măsură)</label>
                                        <select value={newIngredient.unit} onChange={e => setNewIngredient({...newIngredient, unit: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                            <option value="kg">Kg</option>
                                            <option value="g">Grame (g)</option>
                                            <option value="l">Litri (L)</option>
                                            <option value="ml">Mililitri (ml)</option>
                                            <option value="buc">Bucăți</option>
                                        </select>
                                    </div>
                                    <button onClick={createIngredient} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', height: '42px' }}>
                                        Adaugă Ingredient
                                    </button>
                                </div>
                            </div>
                        )}

                        {showNewInvoiceForm && (
                            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', marginBottom: '32px', border: '1px solid #e2e8f0', borderLeft: '4px solid #22c55e', position: 'relative' }}>
                                <button onClick={() => setShowNewInvoiceForm(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', padding: '0' }}>✕</button>
                                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', paddingRight: '24px' }}>Recepție Marfă (Adaugă Factură / NIR)</h3>
                                
                                {/* Invoice Header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Furnizor</label>
                                        <input 
                                            value={supplierSearchQuery} 
                                            onChange={e => handleSupplierSearchChange(e.target.value)} 
                                            onFocus={() => setShowSuppliersDropdown(true)}
                                            onBlur={() => {
                                                // Short delay to allow click event to register
                                                setTimeout(() => setShowSuppliersDropdown(false), 200)
                                            }}
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                                            placeholder="Caută sau scrie furnizor..." 
                                        />
                                        
                                        {/* Dropdown list of suppliers */}
                                        {showSuppliersDropdown && (
                                            <div style={{ 
                                                position: 'absolute', 
                                                top: '100%', 
                                                left: 0, 
                                                right: 0, 
                                                background: '#ffffff', 
                                                border: '1px solid #cbd5e1', 
                                                borderRadius: '8px', 
                                                maxHeight: '220px', 
                                                overflowY: 'auto', 
                                                zIndex: 1100, 
                                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' 
                                            }}>
                                                {suppliers
                                                    .filter(s => normalizeString(s.name).includes(normalizeString(supplierSearchQuery)))
                                                    .map(s => (
                                                        <div 
                                                            key={s.id} 
                                                            onMouseDown={() => handleSelectSupplier(s)}
                                                            style={{ 
                                                                padding: '10px 14px', 
                                                                cursor: 'pointer', 
                                                                borderBottom: '1px solid #f1f5f9',
                                                                fontSize: '13px',
                                                                color: '#1e293b'
                                                            }}
                                                            onMouseEnter={e => e.target.style.background = '#f8fafc'}
                                                            onMouseLeave={e => e.target.style.background = 'transparent'}
                                                        >
                                                            <div style={{ fontWeight: '600' }}>{s.name}</div>
                                                            {s.fiscal_code && (
                                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                                    CUI: {s.fiscal_code} | Reg.Com: {s.trade_registry_number}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                }
                                                {/* Button to trigger the inline creation form */}
                                                <div 
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        setShowNewSupplierForm(true)
                                                        setShowSuppliersDropdown(false)
                                                    }}
                                                    style={{ 
                                                        padding: '12px 14px', 
                                                        background: '#f0fdf4', 
                                                        color: '#16a34a', 
                                                        fontWeight: '700', 
                                                        fontSize: '13px', 
                                                        cursor: 'pointer', 
                                                        textAlign: 'center',
                                                        borderTop: '1px solid #e2e8f0'
                                                    }}
                                                    onMouseEnter={e => e.target.style.background = '#dcfce7'}
                                                    onMouseLeave={e => e.target.style.background = '#f0fdf4'}
                                                >
                                                    ➕ Creează furnizor nou: "{supplierSearchQuery || '...'}"
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Număr Factură (NIR)</label>
                                        <input value={newInvoice.invoice_number} onChange={e => setNewInvoice({...newInvoice, invoice_number: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="Ex: FCT-12345" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Data</label>
                                        <input type="date" value={newInvoice.date} onChange={e => setNewInvoice({...newInvoice, date: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                    </div>
                                </div>

                                {/* Active supplier card or dynamic supplier creation sub-form */}
                                {newInvoice.supplier_id && (
                                    (() => {
                                        const sup = suppliers.find(s => s.id === newInvoice.supplier_id)
                                        if (!sup) return null
                                        return (
                                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <strong style={{ fontSize: '14px', color: '#14532d' }}>🏢 Furnizor Selectat: {sup.name}</strong>
                                                    <div style={{ marginTop: '4px', color: '#166534' }}>
                                                        CUI: <strong>{sup.fiscal_code || '-'}</strong> | Reg. Com: <strong>{sup.trade_registry_number || '-'}</strong>
                                                    </div>
                                                    {sup.address && <div style={{ marginTop: '2px' }}>Adresă: {sup.address}</div>}
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setNewInvoice({ ...newInvoice, supplier_id: null, supplier_name: '' })
                                                        setSupplierSearchQuery('')
                                                    }}
                                                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '11px' }}
                                                >
                                                    Schimbă
                                                </button>
                                            </div>
                                        )
                                    })()
                                )}

                                {showNewSupplierForm && (
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '24px', position: 'relative' }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#1e293b' }}>
                                            🆕 Detalii Furnizor Nou: <span style={{ color: '#4f46e5', fontWeight: '800' }}>{supplierSearchQuery}</span>
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#475569' }}>Cod Fiscal (CUI / CIF)</label>
                                                <input 
                                                    value={newSupplierData.fiscal_code} 
                                                    onChange={e => setNewSupplierData({ ...newSupplierData, fiscal_code: e.target.value })}
                                                    placeholder="Ex: RO12345678"
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#475569' }}>Reg. Comerțului</label>
                                                <input 
                                                    value={newSupplierData.trade_registry_number} 
                                                    onChange={e => setNewSupplierData({ ...newSupplierData, trade_registry_number: e.target.value })}
                                                    placeholder="Ex: J40/123/2020"
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '20px' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#475569' }}>Adresă Completă</label>
                                            <textarea 
                                                rows="2"
                                                value={newSupplierData.address} 
                                                onChange={e => setNewSupplierData({ ...newSupplierData, address: e.target.value })}
                                                placeholder="Ex: Str. Principală, Nr. 10, Cluj-Napoca"
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                            <button 
                                                onClick={() => {
                                                    setShowNewSupplierForm(false)
                                                    setNewSupplierData({ name: '', fiscal_code: '', trade_registry_number: '', address: '' })
                                                }}
                                                style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                Anulează
                                            </button>
                                            <button 
                                                onClick={handleCreateSupplier}
                                                style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                Salvează Furnizor
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Add Line Item */}
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <h4 style={{ margin: '0 0 16px 0', color: '#475569' }}>Adaugă Produs pe Factură</h4>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                        <div style={{ position: 'relative' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Caută/Scrie Ingredient</label>
                                            <input 
                                                value={invoiceLine.ingredientName} 
                                                onChange={e => {
                                                    setInvoiceLine({...invoiceLine, ingredientName: e.target.value})
                                                    setShowIngredientsDropdown(true)
                                                }} 
                                                onFocus={() => setShowIngredientsDropdown(true)}
                                                onBlur={() => {
                                                    // Short delay to allow click event to register
                                                    setTimeout(() => setShowIngredientsDropdown(false), 200)
                                                }}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                                                placeholder="ex: Roșii, Ursus..." 
                                            />
                                            {showIngredientsDropdown && (
                                                <div style={{ 
                                                    position: 'absolute', 
                                                    top: '100%', 
                                                    left: 0, 
                                                    right: 0, 
                                                    background: '#ffffff', 
                                                    border: '1px solid #cbd5e1', 
                                                    borderRadius: '8px', 
                                                    maxHeight: '180px', 
                                                    overflowY: 'auto', 
                                                    zIndex: 1000, 
                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)' 
                                                }}>
                                                    {ingredients
                                                        .filter(i => normalizeString(i.name).includes(normalizeString(invoiceLine.ingredientName)))
                                                        .map(i => (
                                                            <div 
                                                                key={i.id} 
                                                                onMouseDown={() => {
                                                                    setInvoiceLine({...invoiceLine, ingredientName: i.name})
                                                                    setShowIngredientsDropdown(false)
                                                                }}
                                                                style={{ 
                                                                    padding: '10px 12px', 
                                                                    cursor: 'pointer', 
                                                                    borderBottom: '1px solid #f1f5f9',
                                                                    fontSize: '13px',
                                                                    color: '#1e293b'
                                                                }}
                                                                onMouseEnter={e => e.target.style.background = '#f8fafc'}
                                                                onMouseLeave={e => e.target.style.background = 'transparent'}
                                                            >
                                                                    {i.name}
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Cantitate</label>
                                            <input type="number" value={invoiceLine.quantity} onChange={e => setInvoiceLine({...invoiceLine, quantity: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="ex: 10" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Preț / UM (Fără TVA)</label>
                                            <input type="number" step="0.01" value={invoiceLine.unit_price_without_vat} onChange={e => setInvoiceLine({...invoiceLine, unit_price_without_vat: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="ex: 5.50" />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Cota TVA (%)</label>
                                            <select value={invoiceLine.vat_rate} onChange={e => setInvoiceLine({...invoiceLine, vat_rate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                <option value="11">11% (Alimente)</option>
                                                <option value="21">21% (Nonalimentare)</option>
                                                <option value="9">9% (Vechi Alimente)</option>
                                                <option value="19">19% (Vechi Standard)</option>
                                                <option value="0">0% (Scutit)</option>
                                                <option value="5">5%</option>
                                            </select>
                                        </div>
                                        <button onClick={addInvoiceLine} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', height: '40px' }}>
                                            Adaugă
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '24px', marginTop: '16px', fontSize: '13px', color: '#475569', background: '#e2e8f0', padding: '10px 16px', borderRadius: '8px' }}>
                                        <div>Valoare Fără TVA: <strong style={{ color: '#0f172a' }}>{((parseFloat(invoiceLine.quantity) || 0) * (parseFloat(invoiceLine.unit_price_without_vat) || 0)).toFixed(2)} lei</strong></div>
                                        <div>Valoare Cu TVA: <strong style={{ color: '#0f172a' }}>{(((parseFloat(invoiceLine.quantity) || 0) * (parseFloat(invoiceLine.unit_price_without_vat) || 0)) * (1 + (parseFloat(invoiceLine.vat_rate) || 0) / 100)).toFixed(2)} lei</strong></div>
                                    </div>
                                </div>

                                {/* Line Items Table */}
                                {newInvoiceItems.length > 0 && (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Linii Factură ({newInvoiceItems.length})</h4>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            {newInvoiceItems.map((item, idx) => {
                                                const valNoVat = (parseFloat(item.quantity) * parseFloat(item.unit_price_without_vat || 0)).toFixed(2);
                                                const valWithVat = (valNoVat * (1 + parseFloat(item.vat_rate) / 100)).toFixed(2);
                                                return (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '16px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', alignItems: 'center', fontSize: '14px' }}>
                                                    <div style={{ fontWeight: '600' }}>{item.ingredient_name}</div>
                                                    <div>{item.quantity} {item.ingredient_unit}</div>
                                                    <div>{item.unit_price_without_vat ? `${item.unit_price_without_vat} lei/UM` : '-'}</div>
                                                    <div>
                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>Fără TVA: {valNoVat}</div>
                                                        <div style={{ fontWeight: '600' }}>Cu TVA ({item.vat_rate}%): {valWithVat}</div>
                                                    </div>
                                                    <button onClick={() => removeInvoiceLine(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>Șterge</button>
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                )}

                                <div style={{ textAlign: 'right', borderTop: '2px solid #f1f5f9', paddingTop: '20px' }}>
                                    <button onClick={submitInvoice} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '14px 32px', borderRadius: '12px', fontWeight: '700', fontSize: '16px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.4)' }}>
                                        Finalizează și Salvează Factura
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            {/* Stoc Curent Column */}
                            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginTop: 0, marginBottom: '16px' }}>Stoc Curent (Magazie)</h2>
                                
                                <div style={{ position: 'relative', marginBottom: '20px' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Caută în stoc (fără diacritice)..." 
                                        value={inventorySearchQuery} 
                                        onChange={e => setInventorySearchQuery(e.target.value)} 
                                        style={{ 
                                            width: '100%', 
                                            padding: '10px 12px 10px 36px', 
                                            borderRadius: '10px', 
                                            border: '1px solid #cbd5e1', 
                                            fontSize: '14px', 
                                            outline: 'none', 
                                            boxSizing: 'border-box' 
                                        }} 
                                    />
                                    <svg 
                                        width="16" 
                                        height="16" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="#64748b" 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                                    >
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', padding: '0 16px 12px 16px', fontSize: '14px', fontWeight: '600', color: '#64748b', borderBottom: '2px solid #f1f5f9', marginBottom: '16px' }}>
                                    <div>Ingredient</div>
                                    <div style={{ textAlign: 'right' }}>Cantitate</div>
                                </div>
                                
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {ingredients
                                        .filter(ing => normalizeString(ing.name).includes(normalizeString(inventorySearchQuery)))
                                        .map(ing => (
                                        <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '600', color: '#0f172a' }}>{ing.name}</span>
                                                {ing.is_low_stock && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '11px', padding: '2px 6px', marginTop: '4px', fontWeight: '700', width: 'fit-content' }}>
                                                        ⚠️ Stoc Scăzut (sub {ing.alert_threshold_percentage}%)
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '11px', color: '#64748b' }}>Alerte la:</span>
                                                    <select 
                                                        value={ing.alert_threshold_percentage || 25}
                                                        onChange={async (e) => {
                                                            const val = parseInt(e.target.value)
                                                            try {
                                                                await api.patch(`/menu/ingredients/${ing.id}/`, 
                                                                    { alert_threshold_percentage: val },
                                                                    { headers: { Authorization: `Bearer ${token}` } }
                                                                )
                                                                // Recalculate is_low_stock based on new threshold
                                                                const lastQty = ing.last_purchased_quantity || 0
                                                                const isLow = lastQty > 0 && parseFloat(ing.current_stock) < (lastQty * val / 100)
                                                                setIngredients(prev => prev.map(i => i.id === ing.id ? { ...i, alert_threshold_percentage: val, is_low_stock: isLow } : i))
                                                            } catch (err) {
                                                                alert('Eroare la actualizarea pragului de alertă!')
                                                            }
                                                        }}
                                                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff', cursor: 'pointer', outline: 'none' }}
                                                    >
                                                        <option value="25">25% (un sfert)</option>
                                                        <option value="10">10%</option>
                                                        <option value="5">5%</option>
                                                        <option value="0">Fără alerte</option>
                                                    </select>
                                                </div>

                                                <div style={{ fontSize: '15px', fontWeight: '700', color: parseFloat(ing.current_stock) < 0 || ing.is_low_stock ? '#ef4444' : '#1e293b', textAlign: 'right' }}>
                                                    {ing.current_stock} <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>{ing.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {ingredients.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Magazia este goală.</div>}
                                    {ingredients.length > 0 && ingredients.filter(ing => normalizeString(ing.name).includes(normalizeString(inventorySearchQuery))).length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Nu s-au găsit ingrediente care să corespundă căutării.</div>
                                    )}
                                </div>
                            </div>

                            {/* Istoric Facturi Column */}
                            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginTop: 0, marginBottom: '24px' }}>Istoric Facturi (NIR-uri)</h2>
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {invoices.map(inv => {
                                        const invoiceTotalWithVat = inv.items.reduce((sum, item) => {
                                            const valNoVat = parseFloat(item.quantity) * parseFloat(item.unit_price_without_vat || 0);
                                            const valWithVat = valNoVat * (1 + parseFloat(item.vat_rate || 0) / 100);
                                            return sum + valWithVat;
                                        }, 0).toFixed(2);

                                        const isExpanded = !!expandedInvoices[inv.id];

                                        return (
                                            <div key={inv.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                <div 
                                                    onClick={() => toggleInvoiceExpand(inv.id)} 
                                                    style={{ 
                                                        background: '#f8fafc', 
                                                        padding: '16px', 
                                                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none', 
                                                        display: 'flex', 
                                                        justifyContent: 'space-between', 
                                                        alignItems: 'center', 
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s',
                                                        userSelect: 'none'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>Factura: {inv.invoice_number}</div>
                                                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Furnizor: {inv.supplier_name}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Total Cu TVA</div>
                                                            <div style={{ fontSize: '15px', fontWeight: '800', color: '#16a34a' }}>{invoiceTotalWithVat} lei</div>
                                                        </div>
                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', background: '#e2e8f0', padding: '4px 10px', borderRadius: '20px' }}>
                                                            {inv.date}
                                                        </div>
                                                        <div style={{ 
                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                                            transition: 'transform 0.2s', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            color: '#64748b' 
                                                        }}>
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="6 9 12 15 18 9"></polyline>
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div style={{ padding: '16px', background: '#ffffff' }}>
                                                        {inv.supplier && (
                                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#475569' }}>
                                                                <div style={{ fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>🏢 Detalii Furnizor: {inv.supplier.name}</div>
                                                                {inv.supplier.fiscal_code && <span style={{ marginRight: '16px' }}>CUI: <strong>{inv.supplier.fiscal_code}</strong></span>}
                                                                {inv.supplier.trade_registry_number && <span>Reg. Com: <strong>{inv.supplier.trade_registry_number}</strong></span>}
                                                                {inv.supplier.address && <div style={{ marginTop: '4px', color: '#64748b' }}>Adresă: {inv.supplier.address}</div>}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Linii recepționate ({inv.items.length})</div>
                                                        <div style={{ display: 'grid', gap: '8px' }}>
                                                            {inv.items.map(item => {
                                                                const valNoVat = (parseFloat(item.quantity) * parseFloat(item.unit_price_without_vat || 0)).toFixed(2);
                                                                const valWithVat = (valNoVat * (1 + parseFloat(item.vat_rate || 0) / 100)).toFixed(2);
                                                                return (
                                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', paddingTop: '4px' }}>
                                                                        <div>
                                                                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.ingredient_name}</span>
                                                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{item.quantity} {item.ingredient_unit} x {item.unit_price_without_vat || 0} lei (fără TVA)</div>
                                                                        </div>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Fără TVA: {valNoVat} lei</div>
                                                                            <div style={{ fontWeight: '600', fontSize: '13px', color: '#16a34a' }}>Total: {valWithVat} lei (TVA {item.vat_rate}%)</div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {invoices.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Nu există nicio factură înregistrată.</div>}
                                </div>
                            </div>
                        </div>

                    </>
                ) : activeTab === 'employees' ? (
                    <>
                        {/* Employees Tab */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Gestiune Angajați</h1>
                            <button onClick={() => setShowNewUserForm(!showNewUserForm)} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)' }}>
                                + Angajat Nou
                            </button>
                        </div>

                        {showNewUserForm && (
                            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', marginBottom: '32px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                <button onClick={() => setShowNewUserForm(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', padding: '0' }}>✕</button>
                                <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', paddingRight: '24px' }}>Adaugă Angajat</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Username</label>
                                        <input value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Parolă</label>
                                        <input type="password" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Rol</label>
                                        <select value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                            <option value="waiter">Ospătar</option>
                                            <option value="barman">Barman</option>
                                            <option value="kitchen">Bucătar</option>
                                            <option value="admin">Administrator</option>
                                        </select>
                                    </div>
                                    <button onClick={createUser} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', height: '42px' }}>
                                        Salvează
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', padding: '0 16px 12px 16px', fontSize: '14px', fontWeight: '600', color: '#64748b', borderBottom: '2px solid #f1f5f9', marginBottom: '16px' }}>
                                <div>Username</div>
                                <div>Rol</div>
                                <div>Nume Complet</div>
                                <div style={{ textAlign: 'right' }}>Acțiuni</div>
                            </div>
                            
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {users.map(user => (
                                    <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{user.username}</div>
                                        <div>
                                            <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                                                {roleMap[user.role] || user.role || 'Fără rol'}
                                            </span>
                                        </div>
                                        <div style={{ color: '#475569' }}>{user.first_name} {user.last_name}</div>
                                        <div style={{ textAlign: 'right' }}>
                                            <button onClick={() => deleteUser(user.id)} style={{ padding: '6px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                                                Șterge
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : activeTab === 'reports' ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: 0 }}>📊 Rapoarte Vânzări</h1>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button 
                                    onClick={() => setReportChartType('line')} 
                                    style={{ padding: '8px 16px', background: reportChartType === 'line' ? '#4f46e5' : '#ffffff', color: reportChartType === 'line' ? '#ffffff' : '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    📈 Linie
                                </button>
                                <button 
                                    onClick={() => setReportChartType('bar')} 
                                    style={{ padding: '8px 16px', background: reportChartType === 'bar' ? '#4f46e5' : '#ffffff', color: reportChartType === 'bar' ? '#ffffff' : '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    📊 Bare
                                </button>
                            </div>
                        </div>

                        {/* Controls Panel */}
                        <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr', gap: '20px', marginBottom: '32px', alignItems: 'end' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Grupare Timp</label>
                                <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>
                                    <option value="day">Zilnic</option>
                                    <option value="week">Săptămânal</option>
                                    <option value="month">Lunar</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Vizualizare Per</label>
                                <select value={reportBreakdown} onChange={e => setReportBreakdown(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>
                                    <option value="total">Total Restaurant</option>
                                    <option value="category">Categorie Produs</option>
                                    <option value="product">Produs Individual</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Interval Predefinit</label>
                                <select value={reportPreset} onChange={e => setReportPreset(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: '14px', fontWeight: '600' }}>
                                    <option value="today">Azi</option>
                                    <option value="7d">Ultimele 7 zile</option>
                                    <option value="30d">Ultimele 30 zile</option>
                                    <option value="90d">Ultimele 90 zile</option>
                                    <option value="custom">Personalizat (Custom)</option>
                                </select>
                            </div>

                            {reportPreset === 'custom' && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>De la</label>
                                        <input type="date" value={reportCustomDates.start} onChange={e => setReportCustomDates({...reportCustomDates, start: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Până la</label>
                                        <input type="date" value={reportCustomDates.end} onChange={e => setReportCustomDates({...reportCustomDates, end: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chart Render */}
                        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                                    Grafic Evoluție Vânzări ({reportPeriod === 'day' ? 'Zilnic' : reportPeriod === 'week' ? 'Săptămânal' : 'Lunar'})
                                </h3>
                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>
                                    Total Vânzări Interval: <strong style={{ color: '#10b981' }}>{reportData.datasets?.reduce((acc, d) => acc + d.data.reduce((a, b) => a + b, 0), 0).toFixed(2)} lei</strong>
                                </div>
                            </div>
                            <InteractiveSVGChart data={reportData} type={reportChartType} />
                        </div>
                    </>
                ) : activeTab === 'logs' ? (
                    <>
                        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', marginBottom: '32px' }}>📜 Istoric Operațiuni</h1>

                        {/* Search and Filters */}
                        <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Caută Comandă</label>
                                <input 
                                    placeholder="Caută după nr. comandă sau operator..." 
                                    value={logSearch} 
                                    onChange={e => setLogSearch(e.target.value)} 
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Filtru Rol</label>
                                <select value={logRoleFilter} onChange={e => setLogRoleFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontWeight: '600' }}>
                                    <option value="all">Toate Rolurile</option>
                                    <option value="admin">Administrator</option>
                                    <option value="waiter">Ospătar</option>
                                    <option value="barman">Barman</option>
                                    <option value="kitchen">Bucătar</option>
                                    <option value="client">Client/Sistem</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Filtru Acțiune</label>
                                <select value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontWeight: '600' }}>
                                    <option value="all">Toate Acțiunile</option>
                                    <option value="Creare Comandă">Creare Comandă</option>
                                    <option value="Actualizare Comandă">Actualizare Comandă</option>
                                    <option value="Schimbare Status Preparat">Status Preparate</option>
                                    <option value="Plată și Închidere">Plată & Închidere</option>
                                    <option value="Recepție Marfă (NIR)">Recepție NIR</option>
                                </select>
                            </div>
                        </div>

                        {/* Logs Table */}
                        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 3fr', gap: '16px', padding: '0 16px 12px 16px', fontSize: '14px', fontWeight: '700', color: '#64748b', borderBottom: '2px solid #f1f5f9', marginBottom: '16px' }}>
                                <div>Dată & Oră</div>
                                <div>Tip Acțiune</div>
                                <div>Comandă #</div>
                                <div>Operator (Rol)</div>
                                <div>Descriere Detaliată</div>
                            </div>

                            <div style={{ display: 'grid', gap: '12px', maxHeight: '550px', overflowY: 'auto' }}>
                                {logs
                                    .filter(log => {
                                        const matchesSearch = 
                                            log.order_number?.includes(logSearch) || 
                                            log.user_name?.toLowerCase().includes(logSearch.toLowerCase()) ||
                                            log.description?.toLowerCase().includes(logSearch.toLowerCase());
                                        const matchesRole = logRoleFilter === 'all' || log.user_role === logRoleFilter;
                                        const matchesType = logTypeFilter === 'all' || log.operation_type === logTypeFilter;
                                        return matchesSearch && matchesRole && matchesType;
                                    })
                                    .map(log => {
                                        const date = new Date(log.created_at);
                                        const formattedDate = `${date.toLocaleDateString('ro-RO')} ${date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
                                        
                                        const roleColors = {
                                            admin: { bg: '#fee2e2', text: '#ef4444' },
                                            waiter: { bg: '#e0e7ff', text: '#4f46e5' },
                                            barman: { bg: '#ecfdf5', text: '#10b981' },
                                            kitchen: { bg: '#fff7ed', text: '#f97316' },
                                            client: { bg: '#f1f5f9', text: '#64748b' }
                                        };
                                        const colors = roleColors[log.user_role] || roleColors.client;

                                        return (
                                            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 3fr', gap: '16px', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', transition: 'all 0.2s' }}>
                                                <div style={{ fontWeight: '600', color: '#475569' }}>{formattedDate}</div>
                                                <div>
                                                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{log.operation_type}</span>
                                                </div>
                                                <div style={{ fontWeight: '700', color: '#4f46e5' }}>
                                                    {log.order_number ? `#${log.order_number}` : '-'}
                                                </div>
                                                <div>
                                                    <span style={{ fontWeight: '600', color: '#0f172a', marginRight: '6px' }}>{log.user_name}</span>
                                                    <span style={{ background: colors.bg, color: colors.text, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                                                        {roleMap[log.user_role] || log.user_role}
                                                    </span>
                                                </div>
                                                <div style={{ color: '#334155', lineHeight: '1.4' }}>{log.description}</div>
                                            </div>
                                        );
                                    })}
                                {logs.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nicio operațiune înregistrată în istoric.</div>}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    )
}

function InteractiveSVGChart({ data, type }) {
    const [hoverInfo, setHoverInfo] = useState(null)
    if (!data || !data.labels || data.labels.length === 0) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                Nicio dată de vânzări înregistrată pentru acest interval.
            </div>
        )
    }

    const labels = data.labels
    const datasets = data.datasets

    // Dimensions
    const width = 750
    const height = 350
    const padding = { top: 30, right: 150, bottom: 40, left: 60 }

    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    // Find max value across all datasets
    let maxVal = 0
    datasets.forEach(d => {
        d.data.forEach(val => {
            if (val > maxVal) maxVal = val
        })
    })
    if (maxVal === 0) maxVal = 100 // default range if no sales
    
    // Round maxVal to a nice number
    const roundToNiceNumber = (num) => {
        if (num <= 10) return 10
        if (num <= 50) return 50
        if (num <= 100) return 100
        if (num <= 500) return 500
        if (num <= 1000) return 1000
        if (num <= 5000) return 5000
        if (num <= 10000) return 10000
        const magnitude = Math.pow(10, Math.floor(Math.log10(num)))
        const normalized = num / magnitude
        let rounded
        if (normalized <= 1.5) rounded = 1.5
        else if (normalized <= 2) rounded = 2
        else if (normalized <= 5) rounded = 5
        else rounded = 10
        return rounded * magnitude
    }
    maxVal = roundToNiceNumber(maxVal * 1.1)

    // Palette of vibrant colors
    const colors = [
        { stroke: '#4f46e5', fill: 'rgba(79, 70, 229, 0.08)' }, // Indigo
        { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.08)' }, // Cyan
        { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.08)' }, // Emerald
        { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.08)' }, // Amber
        { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.08)' }, // Pink
        { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.08)' }, // Violet
    ]

    // X coordinates
    const numPoints = labels.length
    const getX = (index) => {
        if (numPoints <= 1) return padding.left + chartWidth / 2
        return padding.left + (index / (numPoints - 1)) * chartWidth
    }

    // Y coordinates
    const getY = (val) => {
        return padding.top + chartHeight - (val / maxVal) * chartHeight
    }

    // Grid lines Y
    const gridTicks = 5
    const yGridLines = Array.from({ length: gridTicks + 1 }).map((_, idx) => {
        const val = (idx / gridTicks) * maxVal
        return { val, y: getY(val) }
    })

    return (
        <div style={{ position: 'relative', background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                {/* Y-Axis Grid Lines */}
                {yGridLines.map((tick, idx) => (
                    <g key={idx}>
                        <line 
                            x1={padding.left} 
                            y1={tick.y} 
                            x2={padding.left + chartWidth} 
                            y2={tick.y} 
                            stroke="#f1f5f9" 
                            strokeWidth="1.5"
                        />
                        <text 
                            x={padding.left - 10} 
                            y={tick.y + 4} 
                            textAnchor="end" 
                            fill="#94a3b8" 
                            style={{ fontSize: '11px', fontWeight: '500', fontFamily: 'sans-serif' }}
                        >
                            {Math.round(tick.val)} lei
                        </text>
                    </g>
                ))}

                {/* X-Axis labels */}
                {labels.map((lbl, idx) => {
                    const showLabel = numPoints < 15 || idx % Math.ceil(numPoints / 10) === 0 || idx === numPoints - 1
                    if (!showLabel) return null
                    return (
                        <text 
                            key={idx}
                            x={getX(idx)} 
                            y={height - padding.bottom + 20} 
                            textAnchor="middle" 
                            fill="#94a3b8" 
                            style={{ fontSize: '11px', fontWeight: '500', fontFamily: 'sans-serif' }}
                        >
                            {lbl}
                        </text>
                    )
                })}

                {/* Render Datasets */}
                {type === 'line' ? (
                    datasets.map((dataset, dIdx) => {
                        const color = colors[dIdx % colors.length]
                        
                        let pathD = ""
                        dataset.data.forEach((val, pIdx) => {
                            const x = getX(pIdx)
                            const y = getY(val)
                            if (pIdx === 0) {
                                pathD = `M ${x} ${y}`
                            } else {
                                pathD += ` L ${x} ${y}`
                            }
                        })

                        let areaD = ""
                        if (dataset.data.length > 0) {
                            const firstX = getX(0)
                            const lastX = getX(dataset.data.length - 1)
                            const baselineY = padding.top + chartHeight
                            areaD = `${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`
                        }

                        return (
                            <g key={dIdx}>
                                <path 
                                    d={areaD} 
                                    fill={color.fill}
                                    style={{ transition: 'all 0.3s' }}
                                />
                                <path 
                                    d={pathD} 
                                    fill="none" 
                                    stroke={color.stroke} 
                                    strokeWidth="3" 
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ transition: 'all 0.3s' }}
                                />
                                {dataset.data.map((val, pIdx) => {
                                    const x = getX(pIdx)
                                    const y = getY(val)
                                    return (
                                        <circle 
                                            key={pIdx}
                                            cx={x} 
                                            cy={y} 
                                            r="5" 
                                            fill="#ffffff" 
                                            stroke={color.stroke} 
                                            strokeWidth="3"
                                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                            onMouseEnter={() => {
                                                setHoverInfo({
                                                    x: x,
                                                    y: y,
                                                    label: labels[pIdx],
                                                    val: val,
                                                    datasetLabel: dataset.label
                                                })
                                            }}
                                            onMouseLeave={() => {
                                                setHoverInfo(null)
                                            }}
                                        />
                                    )
                                })}
                            </g>
                        )
                    })
                ) : (
                    // Bar Chart
                    datasets.map((dataset, dIdx) => {
                        const color = colors[dIdx % colors.length]
                        const numDatasets = datasets.length
                        const calculatedBarWidth = (chartWidth / numPoints) / (numDatasets + 1)
                        const barWidth = Math.min(40, Math.max(4, calculatedBarWidth))

                        return (
                            <g key={dIdx}>
                                {dataset.data.map((val, pIdx) => {
                                    const groupX = getX(pIdx)
                                    const offset = (dIdx - (numDatasets - 1) / 2) * barWidth
                                    const x = groupX + offset - barWidth / 2
                                    const y = getY(val)
                                    const barHeight = (val / maxVal) * chartHeight

                                    return (
                                        <rect 
                                            key={pIdx}
                                            x={x}
                                            y={y}
                                            width={barWidth - 2}
                                            height={Math.max(0, barHeight)}
                                            fill={color.stroke}
                                            rx="3"
                                            style={{ cursor: 'pointer', transition: 'all 0.2s', opacity: 0.95 }}
                                            onMouseEnter={() => {
                                                setHoverInfo({
                                                    x: x + barWidth / 2,
                                                    y: y,
                                                    label: labels[pIdx],
                                                    val: val,
                                                    datasetLabel: dataset.label
                                                })
                                            }}
                                            onMouseLeave={() => {
                                                setHoverInfo(null)
                                            }}
                                        />
                                    )
                                })}
                            </g>
                        )
                    })
                )}

                {/* Legend */}
                <g transform={`translate(${width - padding.right + 20}, ${padding.top})`}>
                    {datasets.map((dataset, dIdx) => {
                        const color = colors[dIdx % colors.length]
                        const y = dIdx * 24
                        return (
                            <g key={dIdx} transform={`translate(0, ${y})`}>
                                <rect width="14" height="14" rx="4" fill={color.stroke} />
                                <text 
                                    x="22" 
                                    y="11" 
                                    fill="#475569" 
                                    style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'sans-serif' }}
                                >
                                    {dataset.label.length > 15 ? dataset.label.substring(0, 15) + '...' : dataset.label}
                                </text>
                            </g>
                        )
                    })}
                </g>
            </svg>

            {hoverInfo && (
                <div 
                    style={{
                        position: 'absolute',
                        left: `${(hoverInfo.x / width) * 100}%`,
                        top: `${(hoverInfo.y / height) * 100 - 15}%`,
                        transform: 'translate(-50%, -100%)',
                        background: '#0f172a',
                        color: '#f8fafc',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                        pointerEvents: 'none',
                        zIndex: 10,
                        fontSize: '12px',
                        fontFamily: 'sans-serif',
                        whiteSpace: 'nowrap',
                        border: '1px solid #1e293b'
                    }}
                >
                    <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>{hoverInfo.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '700' }}>{hoverInfo.datasetLabel}:</span>
                        <span style={{ color: '#38bdf8', fontWeight: '800' }}>{hoverInfo.val.toFixed(2)} lei</span>
                    </div>
                </div>
            )}
        </div>
    )
}
