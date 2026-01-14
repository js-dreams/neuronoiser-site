import { Link } from 'react-router-dom'

const SECTION_HEADING_CLASS = "text-l md:text-4xl font-mono font-semibold text-neon-cyan border-b-2 border-neon-cyan/50 pb-2"

function GameSection() {
    return (
        <section id="game-section" className="space-y-6">
            <Link to="/aliens" className="block space-y-6">
                <h2 className={SECTION_HEADING_CLASS}>
                    / {'{'} Play Aliens 🎮 {'}'}
                </h2>
                <div className="bg-dark-gray rounded-xl shadow-inner shadow-dark-gray/50 border-2 border-transparent transition-all duration-300 ease-in-out hover:translate-y-[-4px] hover:scale-[1.02] hover:shadow-[0_10px_20px_rgba(0,255,255,0.4)] hover:border-neon-cyan">
                    <section className="flex items-center justify-center text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                        <article className="mx-auto w-full text-xl text-neon-cyan rounded-2xl border-slate-200/70 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/60">
                            <p className="mb-4 leading-relaxed">
                                A retro-inspired, space shooter game. Move your ship with arrow keys or touch controls, shoot enemies to score points, and collect powerups to gain special abilities. Will you survive through 10 levels of increasing difficulty?
                            </p>
                            <p className="mb-4 leading-relaxed">
                                This game was created using Cursor AI, making it a product of <span className="font-semibold text-white">Mixed-Intelligence</span> development—just like the music. neuronoiser's music will play along as you advance in the game, creating an immersive audio-visual experience.
                            </p>
                        </article>
                    </section>
                </div>
            </Link>
        </section>
    )
}

export default GameSection
