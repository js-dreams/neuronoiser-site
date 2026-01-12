const SECTION_HEADING_CLASS = "text-l md:text-4xl font-mono font-semibold text-neon-cyan border-b-2 border-neon-cyan/50 pb-2"

function Bio() {
    return (
        <section id="bio-section" className="space-y-6">
            <h2 className={SECTION_HEADING_CLASS}>
                / {'{'} About The Artist {'}'}
            </h2>
            <div className="bg-dark-gray rounded-xl shadow-inner shadow-dark-gray/50">
                <section className="flex items-center justify-center text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                    <article className="mx-auto w-full text-xl text-neon-cyan rounded-2xl border-slate-200/70 p-6 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/60">
                        <p className="mb-4 leading-relaxed">
                            neuronoiser (a.k.a Danny Reiser) creates <span className="font-semibold text-white">Mixed-Intelligence</span> music. That is, human incepted music, enhanced by AI tools, while maintaining the creative steering wheel at the hands of the human creator in every step.
                        </p>
                        <p className="mb-4 leading-relaxed">
                            Each piece begins with an audio file he created himself, without the aid of AI, in fact, some of those musical ideas came into his head, and was recorded, many years before generative AI even existed (some goes back to 2001!). 
                            Though, he will admit - his music without AI's help, wasn't really ready for release.
                        </p>
                        <p className="mb-4 leading-relaxed">
                            Today, through creative, and iterative dialogue with intelligent tools, he can finally bring those musical ideas out of his head and share them with the world. 
                            He uses AI to help him arrange, orchestrate, and produce his music. He uses AI to help him find sounds, and to help him re-mix his tracks.
                            But he can surely say, the music is still essentially his. 
                        </p>
                        <p className="mb-4 leading-relaxed">
                            He is the composer of the initial musical idea, he also makes most of the crucial artistic decisions that needs to be made during the iterative process of MI music creation.
                            AI is "just" an amazing, really amazing, tool for the execution of ideas. It is the great enabler for his creative mind. for everyone's creative minds. yours included!
                        </p>
                    </article>
                </section>
            </div>
        </section>
    )
}

export default Bio
