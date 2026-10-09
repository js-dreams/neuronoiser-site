import { handleImageError } from '../utils/imageUtils'

const HERO_FALLBACK_IMAGE = 'https://placehold.co/1024x400/080614/00FFFF?text=VISUAL%20ASSET%20MISSING'

function Hero() {
    return (
        // Two layouts, one markup — every desktop rule is md:-prefixed, so below
        // 768px this renders exactly as it always has: full-bleed cassette with
        // the title laid over it.
        //
        // From md up: a centred row of cassette + text (md:justify-center, and
        // the text column is NOT flex-1, so the pair is its own width and sits
        // centred rather than stretched across the card). md:items-stretch makes
        // the text column exactly as tall as the cassette, and justify-between
        // inside it pins the title to the cassette's top edge and the tagline to
        // its bottom edge.
        <header
            id="hero-section"
            className="relative overflow-hidden rounded-xl shadow-2xl shadow-neon-cyan/20 md:flex md:items-stretch md:justify-center md:gap-8 md:bg-deep-indigo/60 md:p-8"
        >
            <img
                src="/cassette.jpeg"
                onError={(e) => handleImageError(e, HERO_FALLBACK_IMAGE)}
                alt="Neuronoiser hero image: dark, stylized production setup"
                className="w-full h-full object-cover opacity-70 transition duration-500 hover:opacity-100 md:w-[30%] md:h-auto md:shrink-0 md:self-center md:rounded-lg"
            />
            <div className="absolute inset-0 bg-deep-indigo/60 backdrop-blur-sm flex items-center justify-center p-6 md:static md:inset-auto md:min-w-0 md:items-stretch md:justify-start md:bg-transparent md:p-0 md:backdrop-blur-none">
                <div className="text-center md:flex md:flex-col md:justify-between md:text-left">
                    <h1 className="text-4xl md:text-[3.6rem] md:leading-none font-mono font-extrabold tracking-tight text-deep-indigo neon-glow transition duration-500 hover:scale-105 md:origin-left">
                        neuronoiser
                    </h1>
                    <p className="mt-4 md:mt-1 text-l md:text-xl font-mono text-gray-300 neon-glow">
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
