import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ClientPage from './pages/ClientPage'
import KitchenPage from './pages/KitchenPage'
import WaiterPage from './pages/WaiterPage'
import BarPage from './pages/BarPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:tableNumber" element={<ClientPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/waiter" element={<WaiterPage />} />
        <Route path="/bar" element={<BarPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/login" element={<Navigate to="/waiter" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
