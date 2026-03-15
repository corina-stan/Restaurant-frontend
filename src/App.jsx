import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientPage from './pages/ClientPage'
import KitchenPage from './pages/KitchenPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:tableNumber" element={<ClientPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
