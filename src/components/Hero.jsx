import { handleImageError } from '../utils/imageUtils'

const HERO_FALLBACK_IMAGE = 'https://placehold.co/1024x400/080614/00FFFF?text=VISUAL%20ASSET%20MISSING'

function Hero() {
    return (
        // Two layouts, one markup. Mobile keeps the original full-bleed cassette
        // with the title laid over it; from `md` up the overlay stops being an
        // overlay (md:static) and the header becomes a row: a quarter-width
        // cassette on the left, the text beside it, left-aligned.
        <header
            id="hero-section"
            className="relative overflow-hidden rounded-xl shadow-2xl shadow-neon-cyan/20 md:flex md:items-center md:gap-8 md:bg-deep-indigo/60 md:p-8"
        >
            <img
                src="/cassette.jpeg"
                onError={(e) => handleImageError(e, HERO_FALLBACK_IMAGE)}
                alt="Neuronoiser hero image: dark, stylized production setup"
                className="w-full h-full object-cover opacity-70 transition duration-500 hover:opacity-100 md:w-1/4 md:h-auto md:shrink-0 md:rounded-lg"
            />
            <div className="absolute inset-0 bg-deep-indigo/60 backdrop-blur-sm flex items-center justify-center p-6 md:static md:inset-auto md:min-w-0 md:flex-1 md:justify-start md:bg-transparent md:p-0 md:backdrop-blur-none">
                <div className="text-center md:text-left">
                    <h1 className="text-4xl md:text-7xl font-mono font-extrabold tracking-tight text-deep-indigo neon-glow transition duration-500 hover:scale-105 md:origin-left">
                        neuronoiser
                    </h1>
                    <p className="mt-4 text-l md:text-xl font-mono text-gray-300 neon-glow">
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
