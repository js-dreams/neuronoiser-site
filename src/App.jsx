import MusicPlayer from './components/MusicPlayer'
import Hero from './components/Hero'
import StreamingLinks from './components/StreamingLinks'
import Bio from './components/Bio'
import Footer from './components/Footer'

function App() {
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
            <MusicPlayer />
            <Hero />
            <StreamingLinks />
            <Bio />
            <Footer />
        </div>
    )
}

export default App
