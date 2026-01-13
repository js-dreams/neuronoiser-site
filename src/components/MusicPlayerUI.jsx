import { useMusicPlayerContext } from '../contexts/MusicPlayerContext'
import AnimatedSection from './AnimatedSection'

const VISUALIZER_DELAYS = ['0s', '0.15s', '0.3s', '0.45s']

function MusicPlayerUI() {
    const {
        isPlaying,
        trackStatus,
        hasError,
        tracks,
        isLoading,
        buttonText,
        handlePlayPause,
        handleNextTrack,
        handlePreviousTrack
    } = useMusicPlayerContext()

    return (
        <section id="music-player" className="bg-dark-gray p-2 rounded-xl shadow-lg border border-neon-cyan/30 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-8 overflow-hidden">
            <div className="flex items-center space-x-4 flex-1 min-w-0 overflow-hidden">
                <div 
                    id="statusIcon" 
                    className={`status-indicator flex-shrink-0 ${hasError ? 'bg-red-600' : (isPlaying ? 'animate-pulse-neon playing' : '')}`}
                ></div>
                <div className="text-xs md:text-lg font-mono tracking-wider flex-1 min-w-0">
                    <span id="trackStatus" className="break-words">
                        {trackStatus}
                    </span>
                </div>
                {isPlaying && (
                    <div id="visualizer" className="flex h-6 space-x-0.5 items-end ml-4">
                        {VISUALIZER_DELAYS.map((delay, index) => (
                            <div 
                                key={index}
                                className="visualizer-bar w-1 h-full bg-neon-cyan/80 rounded-full" 
                                style={{animationDelay: delay}}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2">
                {tracks.length > 1 && (
                    <>
                        <AnimatedSection delay={300} animationType="animate-slide-in-left">
                            <button
                                onClick={handlePreviousTrack}
                                disabled={hasError || isLoading}
                                className="h-7 w-7 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm leading-none"
                                aria-label="Previous track"
                                title="Previous track"
                            >
                                ◀
                            </button>
                        </AnimatedSection>
                        <AnimatedSection delay={350} animationType="animate-slide-in-right">
                            <button
                                onClick={handleNextTrack}
                                disabled={hasError || isLoading}
                                className="h-7 w-7 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm leading-none"
                                aria-label="Next track"
                                title="Next track"
                            >
                                ▶
                            </button>
                        </AnimatedSection>
                    </>
                )}
                <AnimatedSection delay={400} animationType="animate-slide-in-top">
                    <button 
                        id="playPauseButton"
                        onClick={handlePlayPause}
                        disabled={hasError || isLoading}
                        className="h-6 text-sm w-full md:w-auto px-6 py-0 rounded-full font-bold transition duration-300 shadow-md shadow-neon-cyan/30 bg-neon-cyan text-deep-indigo hover:bg-white hover:shadow-neon-cyan/70 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {buttonText}
                    </button>
                </AnimatedSection>
            </div>
        </section>
    )
}

export default MusicPlayerUI