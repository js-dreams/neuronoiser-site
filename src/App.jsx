import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AliensGame from './components/AliensGame'

function App() {
    // Game state persists during navigation but clears on page refresh
    const [savedGameState, setSavedGameState] = useState(null)

    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route 
                path="/aliens" 
                element={
                    <AliensGame 
                        savedGameState={savedGameState}
                        onSaveGameState={setSavedGameState}
                        onClearGameState={() => setSavedGameState(null)}
                    />
                } 
            />
        </Routes>
    )
}

export default App
