import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientPage from './pages/ClientPage'
import KitchenPage from './pages/KitchenPage'
import WaiterPage from './pages/WaiterPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:tableNumber" element={<ClientPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/waiter" element={<WaiterPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
