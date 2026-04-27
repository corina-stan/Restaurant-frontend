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
    
    // Purchase Invoices (NIR) state
    const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false)
    const [newInvoice, setNewInvoice] = useState({ invoice_number: '', supplier_name: '', date: new Date().toISOString().split('T')[0] })
    const [newInvoiceItems, setNewInvoiceItems] = useState([])
    const [invoiceLine, setInvoiceLine] = useState({ ingredientName: '', quantity: '', unit_price_without_vat: '', vat_rate: 9 })

    // Recipe state
    const [recipeViewProduct, setRecipeViewProduct] = useState(null)
    const [productRecipes, setProductRecipes] = useState([])
    const [newRecipeItem, setNewRecipeItem] = useState({ ingredient: '', quantity: '' })

    const loadData = async (accessToken) => {
        try {
            setLoading(true)
            const [prodRes, catRes, userRes, ingRes, invRes] = await Promise.all([
                api.get('/menu/products/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/categories/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/accounts/users/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/ingredients/', { headers: { Authorization: `Bearer ${accessToken}` } }),
                api.get('/menu/purchase_invoices/', { headers: { Authorization: `Bearer ${accessToken}` } })
            ])
            setProducts(prodRes.data)
            setCategories(catRes.data)
            setUsers(userRes.data)
            setIngredients(ingRes.data)
            setInvoices(invRes.data)
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
    }

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
            setNewInvoice({ invoice_number: '', supplier_name: '', date: new Date().toISOString().split('T')[0] })
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
    let filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    
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
                    <div onClick={() => setActiveTab('menu')} style={{ padding: '12px 16px', background: activeTab === 'menu' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>
                        📋 Gestiune Meniu
                    </div>
                    <div onClick={() => setActiveTab('inventory')} style={{ padding: '12px 16px', background: activeTab === 'inventory' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>
                        📦 Gestiune Stocuri
                    </div>
                    <div onClick={() => setActiveTab('employees')} style={{ padding: '12px 16px', background: activeTab === 'employees' ? '#1e293b' : 'transparent', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>
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
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Furnizor</label>
                                        <input value={newInvoice.supplier_name} onChange={e => setNewInvoice({...newInvoice, supplier_name: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="Ex: Selgros, Metro" />
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

                                {/* Add Line Item */}
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <h4 style={{ margin: '0 0 16px 0', color: '#475569' }}>Adaugă Produs pe Factură</h4>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Caută/Scrie Ingredient</label>
                                            <input 
                                                list="ingredients-list"
                                                value={invoiceLine.ingredientName} 
                                                onChange={e => setInvoiceLine({...invoiceLine, ingredientName: e.target.value})} 
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                                                placeholder="ex: Roșii, Ursus..." 
                                            />
                                            <datalist id="ingredients-list">
                                                {ingredients.map(i => <option key={i.id} value={i.name} />)}
                                            </datalist>
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
                                                <option value="9">9% (Alimente)</option>
                                                <option value="19">19% (Standard)</option>
                                                <option value="0">0% (Scutit)</option>
                                                <option value="5">5%</option>
                                                <option value="11">11%</option>
                                                <option value="21">21%</option>
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
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginTop: 0, marginBottom: '24px' }}>Stoc Curent (Magazie)</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', padding: '0 16px 12px 16px', fontSize: '14px', fontWeight: '600', color: '#64748b', borderBottom: '2px solid #f1f5f9', marginBottom: '16px' }}>
                                    <div>Ingredient</div>
                                    <div style={{ textAlign: 'right' }}>Cantitate</div>
                                </div>
                                
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {ingredients.map(ing => (
                                        <div key={ing.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{ing.name}</div>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: parseFloat(ing.current_stock) < 0 ? '#ef4444' : '#1e293b' }}>
                                                {ing.current_stock} <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>{ing.unit}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {ingredients.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Magazia este goală.</div>}
                                </div>
                            </div>

                            {/* Istoric Facturi Column */}
                            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginTop: 0, marginBottom: '24px' }}>Istoric Facturi (NIR-uri)</h2>
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {invoices.map(inv => (
                                        <div key={inv.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                            <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>Factura: {inv.invoice_number}</div>
                                                    <div style={{ fontSize: '13px', color: '#64748b' }}>Furnizor: {inv.supplier_name}</div>
                                                </div>
                                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', background: '#e2e8f0', padding: '4px 10px', borderRadius: '20px' }}>
                                                    {inv.date}
                                                </div>
                                            </div>
                                            <div style={{ padding: '12px 16px', background: '#ffffff' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Linii recepționate</div>
                                                <div style={{ display: 'grid', gap: '6px' }}>
                                                    {inv.items.map(item => {
                                                        const valNoVat = (parseFloat(item.quantity) * parseFloat(item.unit_price_without_vat || 0)).toFixed(2);
                                                        const valWithVat = (valNoVat * (1 + parseFloat(item.vat_rate || 0) / 100)).toFixed(2);
                                                        return (
                                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                                            <div>
                                                                <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.ingredient_name}</span>
                                                                <div style={{ fontSize: '12px', color: '#64748b' }}>{item.quantity} {item.ingredient_unit} x {item.unit_price_without_vat || 0} lei</div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontSize: '12px', color: '#64748b' }}>Fără TVA: {valNoVat} lei</div>
                                                                <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>Total: {valWithVat} lei (TVA {item.vat_rate}%)</div>
                                                            </div>
                                                        </div>
                                                    )})}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {invoices.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>Nu există nicio factură înregistrată.</div>}
                                </div>
                            </div>
                        </div>

                    </>
                ) : (
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
                )}
            </div>
        </div>
    )
}
