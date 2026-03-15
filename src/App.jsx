import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClientPage from './pages/ClientPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:tableNumber" element={<ClientPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
