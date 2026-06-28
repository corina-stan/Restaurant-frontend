import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ClientPage from './pages/ClientPage'
import KitchenPage from './pages/KitchenPage'
import WaiterPage from './pages/WaiterPage'
import BarPage from './pages/BarPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:tableNumber" element={<ClientPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/waiter" element={<WaiterPage />} />
        <Route path="/bar" element={<BarPage />} />
        <Route path="/dashboard" element={<AdminPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
