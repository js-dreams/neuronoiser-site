import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AliensGame from './components/AliensGame'

function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/aliens" element={<AliensGame />} />
        </Routes>
    )
}

export default App
