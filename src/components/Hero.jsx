import { handleImageError } from '../utils/imageUtils'

const HERO_FALLBACK_IMAGE = 'https://placehold.co/1024x400/080614/00FFFF?text=VISUAL%20ASSET%20MISSING'

function Hero() {
    return (
        <header id="hero-section" className="relative overflow-hidden rounded-xl shadow-2xl shadow-neon-cyan/20">
            <img 
                src="/cassette.jpeg" 
                onError={(e) => handleImageError(e, HERO_FALLBACK_IMAGE)}
                alt="Neuronoiser hero image: dark, stylized production setup" 
                className="w-full h-full object-cover opacity-70 transition duration-500 hover:opacity-100"
            />
            <div className="absolute inset-0 bg-deep-indigo/60 backdrop-blur-sm flex items-center justify-center p-6">
                <div className="text-center">
                    <h1 className="text-4xl md:text-8xl font-mono font-extrabold tracking-tight text-deep-indigo neon-glow transition duration-500 hover:scale-105">
                        neuronoiser
                    </h1>
                    <p className="mt-4 text-l md:text-2xl font-mono text-gray-300 neon-glow">
                        Smart Noise For Curious Ears 
                    </p>
                    {/* 
                    <p className="mt-4 text-l md:text-6xl text-cyan-600 special-hebrew-font stroke">
                        מעניין באוזניים
                    </p>
                    */}
                </div>
            </div>
        </header>
    )
}

export default Hero
