import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMusicPlayerContext } from '../contexts/MusicPlayerContext'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const HOMING_MISSILE_SPEED = 6
const ENEMY_BULLET_SPEED = 3.75 // 75% of original speed (5 * 0.75)
const ENEMY_SPEED = 2
const ENEMY_SPAWN_RATE = 60 // frames
const STAR_COUNT = 100
const LEVEL_DURATION_FRAMES = 3600 // 60 seconds at 60fps
const LIFE_POWERUP_SPEED = 2
const LIFE_POWERUP_SIZE = 25
const BOSS_SPEED = 1.5
const BOSS_FIRE_RATE = 30 // frames between shots (rapid fire)
const POWERUP_DURATION_SECONDS = 20 // Duration for 3X and Magic Defence

// Sound system - 80's computer style sounds
let audioContext = null

const getAudioContext = () => {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)()
        } catch (e) {
            return null
        }
    }
    // Resume context if it's suspended (required after user interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {})
    }
    return audioContext
}

const createSound = (frequency, duration, type = 'square', volume = 0.1) => {
    const ctx = getAudioContext()
    if (!ctx) return
    
    try {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = type
        oscillator.frequency.value = frequency
        gainNode.gain.setValueAtTime(volume, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
        
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
        // Silently fail if audio context is not available
    }
}

const createShootSound = () => {
    const ctx = getAudioContext()
    if (!ctx) return
    
    try {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.type = 'sawtooth'
        // Quick frequency sweep from high to low (laser/gunshot effect)
        oscillator.frequency.setValueAtTime(1200, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08)
        
        gainNode.gain.setValueAtTime(0.040, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
        
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.08)
    } catch (e) {
        // Silently fail if audio context is not available
    }
}

function AliensGame({ savedGameState, onSaveGameState, onClearGameState }) {
    const canvasRef = useRef(null)
    const animationFrameRef = useRef(null)
    const navigate = useNavigate()
    
    const [gameState, setGameState] = useState('menu') // 'menu', 'playing', 'gameover'
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [isLandscapeMobile, setIsLandscapeMobile] = useState(false)
    const [level, setLevel] = useState(1)
    const [lives, setLives] = useState(3)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [countdown, setCountdown] = useState(0) // 0 = no countdown, 3-1 = countdown in progress
    const [deathCountdown, setDeathCountdown] = useState(0) // 0 = no death countdown, 3-1 = death countdown in progress
    const [gameOverWait, setGameOverWait] = useState(false) // true = waiting 3 seconds after final death before allowing restart
    const [isCelebrating, setIsCelebrating] = useState(false)
    const [celebrationStartTime, setCelebrationStartTime] = useState(null)
    const [isVictory, setIsVictory] = useState(false) // true = player won by defeating boss
    const [bossExplosionStartTime, setBossExplosionStartTime] = useState(null) // null = no explosion, timestamp = explosion in progress
    const [showHelpDialog, setShowHelpDialog] = useState(false)
    const [scoreMultiplier, setScoreMultiplier] = useState(1) // 1 or 3
    const [scoreMultiplierEndTime, setScoreMultiplierEndTime] = useState(null)
    const [magicDefenceActive, setMagicDefenceActive] = useState(false)
    const [magicDefenceEndTime, setMagicDefenceEndTime] = useState(null)
    const [superWeaponActive, setSuperWeaponActive] = useState(false)
    const [superWeaponEndTime, setSuperWeaponEndTime] = useState(null)
    
    const gameStateRef = useRef({ gameState, score, level, lives })
    const soundEnabledRef = useRef(soundEnabled)
    const showHelpDialogRef = useRef(false)
    const playerRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 })
    const bulletsRef = useRef([])
    const enemiesRef = useRef([])
    const enemyBulletsRef = useRef([])
    const lifePowerupsRef = useRef([])
    const scoreBonusPowerupsRef = useRef([])
    const magicDefencePowerupsRef = useRef([])
    const superWeaponPowerupsRef = useRef([])
    const clockExtenderPowerupsRef = useRef([])
    const homingMissilesRef = useRef([])
    const keysRef = useRef({})
    const starsRef = useRef([])
    const frameCountRef = useRef(0)
    const lastFrameTimeRef = useRef(null) // Track last frame time for delta time calculation (mobile fix)
    const lastPlayerShotTimeRef = useRef(null) // Track last player shot time for fire rate control (mobile fix)
    const touchRef = useRef({ x: null, y: null, isTouching: false, shootPressed: false })
    const levelStartTimeRef = useRef(null)
    const levelAnnouncementStartTimeRef = useRef(null)
    const helpDialogPauseStartTimeRef = useRef(null) // Track when help dialog opens to pause level timer
    const nextPowerupSpawnFrameRef = useRef(null)
    const nextScoreBonusSpawnFrameRef = useRef(null)
    const nextMagicDefenceSpawnFrameRef = useRef(null)
    const nextSuperWeaponSpawnFrameRef = useRef(null)
    const fireworksRef = useRef([])
    const bossExplosionRef = useRef([]) // Boss explosion particles
    const enemyExplosionsRef = useRef([]) // Array of enemy explosion particle arrays: [{ particles: [...], startTime: number }, ...]
    const powerupExplosionsRef = useRef([]) // Array of powerup explosion particle arrays: [{ particles: [...], startTime: number }, ...]
    const previousHighScoreRef = useRef(0)
    const hasCelebratedThisGameRef = useRef(false)
    const clockExtenderSpawnedForScoreMultiplierRef = useRef(false)
    const clockExtenderSpawnedForMagicDefenceRef = useRef(false)
    const clockExtenderSpawnedForSuperWeaponRef = useRef(false)
    const clockExtenderDisabledForScoreMultiplierRef = useRef(false)
    const clockExtenderDisabledForMagicDefenceRef = useRef(false)
    const clockExtenderDisabledForSuperWeaponRef = useRef(false)
    const bonusTextsRef = useRef([]) // Array of {x, y, text, startTime}
    const bossRef = useRef(null) // Boss enemy: {x, y, width, height, health, vx, vy, lastShotFrame}
    const bossShieldHitsRef = useRef(0) // Track boss hits on shield (destroy shield after 4 hits)
    const nextBossPowerupSpawnFrameRef = useRef(null) // Track next boss powerup spawn frame

    // Refs for help dialog icon canvases
    const regularEnemyIconRef = useRef(null)
    const skullEnemyIconRef = useRef(null)
    const lifePowerupIconRef = useRef(null)
    const scorePowerupIconRef = useRef(null)
    const magicDefencePowerupIconRef = useRef(null)
    const superWeaponPowerupIconRef = useRef(null)
    const clockExtenderPowerupIconRef = useRef(null)

    // Initialize stars
    useEffect(() => {
        starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
            x: Math.random() * CANVAS_WIDTH,
            y: Math.random() * CANVAS_HEIGHT,
            speed: 0.5 + Math.random() * 1.5,
            size: Math.random() * 2 + 1
        }))
    }, [])

    // Calculate difficulty based on level (1-10)
    // Rescaled so that level 10 equals old level 8 difficulty (more gradual progression)
    // Map current level (1-10) to old level scale (1-8): oldLevel = 1 + (currentLevel - 1) * 7/9
    const getEnemySpeed = useCallback((currentLevel) => {
        const oldLevel = 1 + (currentLevel - 1) * (7 / 9)
        // Old formula: Level 1: 2, Level 8: ~4.333 (what was level 8, now level 10)
        return 2 + (oldLevel - 1) * (3 / 9)
    }, [])

    const getEnemySpawnRate = useCallback((currentLevel) => {
        const oldLevel = 1 + (currentLevel - 1) * (7 / 9)
        // Old formula: Level 1: 60 frames, Level 8: ~28.89 frames (what was level 8, now level 10)
        let baseSpawnRate = Math.max(20, 60 - (oldLevel - 1) * (40 / 9))
        // At maximum level (oldLevel >= 8), reduce spawn rate to 90% (increase frames by ~11%)
        if (oldLevel >= 8) {
            return Math.round(baseSpawnRate / 0.9)
        }
        return baseSpawnRate
    }, [])

    const getEnemyHorizontalSpeed = useCallback((currentLevel) => {
        const oldLevel = 1 + (currentLevel - 1) * (7 / 9)
        // Old formula: Level 1: ~0.1, Level 8: ~2.36 (what was level 8, now level 10)
        return 0.1 + (oldLevel - 1) * (2.9 / 9)
    }, [])

    const getMegaEnemySpawnChance = useCallback((currentLevel) => {
        const oldLevel = 1 + (currentLevel - 1) * (7 / 9)
        // Old formula: Level 1: 1% chance, Level 8: ~62.4% chance (what was level 8, now level 10)
        return 0.01 + (oldLevel - 1) * (0.79 / 9)
    }, [])

    const getMegaEnemyFireRate = useCallback((currentLevel) => {
        const oldLevel = 1 + (currentLevel - 1) * (7 / 9)
        // Old formula with piecewise function
        if (oldLevel <= 3) {
            // Level 1-3: Slow fire rate
            // Level 1: 8% faster (700 * 0.92 = 644 frames)
            const baseRate = 700 - (oldLevel - 1) * 100
            if (oldLevel === 1) {
                return Math.round(baseRate * 0.92) // 8% more rapid (fewer frames = faster)
            }
            return baseRate
        } else if (oldLevel <= 6) {
            // Level 4-6: Medium fire rate
            return 150 - (oldLevel - 4) * 10
        } else {
            // Level 7-8: Rapid fire (old level 8, now level 10)
            const baseFireRate = 75 - (oldLevel - 7) * 15
            if (oldLevel >= 8) {
                // At maximum level: current rate after /0.9 is ~66.67 frames
                // 86% of current rate means 66.67 / 0.86 = ~77.5 frames (slower = more frames)
                const currentMaxRate = baseFireRate / 0.9
                return Math.round(currentMaxRate / 0.86)
            }
            return baseFireRate
        }
    }, [])

    // Save game state to parent App component (clears on page refresh, persists during navigation)
    const saveGameState = useCallback(() => {
        if (gameStateRef.current.gameState === 'playing') {
            const savedState = {
                gameState: gameStateRef.current.gameState,
                score: gameStateRef.current.score,
                level: gameStateRef.current.level,
                lives: gameStateRef.current.lives,
                player: { ...playerRef.current },
                enemies: [...enemiesRef.current],
                bullets: [...bulletsRef.current],
                enemyBullets: [...enemyBulletsRef.current],
                lifePowerups: [...lifePowerupsRef.current],
                frameCount: frameCountRef.current,
                levelStartTime: levelStartTimeRef.current,
                nextPowerupSpawnFrame: nextPowerupSpawnFrameRef.current,
                hasCelebratedThisGame: hasCelebratedThisGameRef.current,
                previousHighScore: previousHighScoreRef.current,
                savedAt: Date.now()
            }
            onSaveGameState(savedState)
        }
    }, [onSaveGameState])

    // Restore game state from parent App component (clears on page refresh, persists during navigation)
    const restoreGameState = useCallback(() => {
        if (savedGameState) {
            try {
                setGameState(savedGameState.gameState)
                setScore(savedGameState.score)
                setLevel(savedGameState.level)
                setLives(savedGameState.lives)
                playerRef.current = savedGameState.player
                enemiesRef.current = savedGameState.enemies
                bulletsRef.current = savedGameState.bullets
                enemyBulletsRef.current = savedGameState.enemyBullets || []
                lifePowerupsRef.current = savedGameState.lifePowerups
                frameCountRef.current = savedGameState.frameCount
                
                // Adjust timing for pause duration
                const pauseDuration = Date.now() - savedGameState.savedAt
                levelStartTimeRef.current = savedGameState.levelStartTime + pauseDuration
                nextPowerupSpawnFrameRef.current = savedGameState.nextPowerupSpawnFrame
                
                // Restore celebration flags to prevent duplicate celebrations
                if (savedGameState.hasCelebratedThisGame !== undefined) {
                    hasCelebratedThisGameRef.current = savedGameState.hasCelebratedThisGame
                }
                if (savedGameState.previousHighScore !== undefined) {
                    previousHighScoreRef.current = savedGameState.previousHighScore
                }
                
                // Clear saved state from parent
                onClearGameState()
                
                // Start countdown
                setCountdown(3)
                return true
            } catch (e) {
                console.error('Failed to restore game state:', e)
                onClearGameState()
            }
        }
        return false
    }, [savedGameState, onClearGameState])

    // Create firework particles
    const createFireworks = useCallback((centerX, centerY) => {
        const colors = ['#FF00FF', '#00FFFF', '#FFFF00', '#FF4444', '#00FF00', '#FF8800']
        const particles = []
        for (let i = 0; i < 50; i++) {
            const angle = (Math.PI * 2 * i) / 50
            const speed = 2 + Math.random() * 4
            const color = colors[Math.floor(Math.random() * colors.length)]
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.01 + Math.random() * 0.02,
                color: color,
                size: 2 + Math.random() * 3
            })
        }
        return particles
    }, [])

    // Create boss explosion particles
    const createBossExplosion = useCallback((centerX, centerY) => {
        const colors = ['#FF4400', '#FF8800', '#FFAA00', '#FF0000', '#FF6600', '#FFFF00'] // Fire/explosion colors
        const particles = []
        for (let i = 0; i < 200; i++) { // Many particles for big explosion
            const angle = (Math.PI * 2 * i) / 200
            const speed = 3 + Math.random() * 8 // Faster than fireworks
            const color = colors[Math.floor(Math.random() * colors.length)]
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.008 + Math.random() * 0.015, // Slower decay for longer effect
                color: color,
                size: 3 + Math.random() * 6 // Larger particles
            })
        }
        return particles
    }, [])

    // Create small enemy explosion particles
    const createEnemyExplosion = useCallback((centerX, centerY) => {
        const colors = ['#FF4400', '#FF8800', '#FFAA00', '#FF0000', '#FFFF00'] // Fire/explosion colors
        const particles = []
        const particleCount = 15 // Small explosion, fewer particles
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.5 - 0.25) // Slight random variation
            const speed = 2 + Math.random() * 4 // Slower than boss explosion
            const color = colors[Math.floor(Math.random() * colors.length)]
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.04, // Faster decay for shorter effect
                color: color,
                size: 2 + Math.random() * 3 // Smaller particles
            })
        }
        return particles
    }, [])

    // Create fancy skull ship (mega enemy) explosion particles
    const createMegaEnemyExplosion = useCallback((centerX, centerY) => {
        const colors = ['#FF0000', '#FF4400', '#FF8800', '#FFAA00', '#FFFF00', '#FF6600'] // Fire/explosion colors with emphasis on red
        const particles = []
        const particleCount = 30 // More particles for a fancier explosion
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.6 - 0.3) // More variation
            const speed = 2.5 + Math.random() * 5.5 // Slightly faster than regular enemies
            const color = colors[Math.floor(Math.random() * colors.length)]
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.025 + Math.random() * 0.035, // Slightly longer lasting
                color: color,
                size: 2.5 + Math.random() * 4 // Slightly larger particles
            })
        }
        return particles
    }, [])

    // Create powerup explosion particles (dark/purple colors for disappointment)
    const createPowerupExplosion = useCallback((centerX, centerY) => {
        const colors = ['#8B008B', '#4B0082', '#800080', '#9932CC', '#A020F0', '#6A5ACD'] // Dark purple/violet colors
        const particles = []
        const particleCount = 12 // Small disappointment explosion
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.5 - 0.25) // Slight random variation
            const speed = 1.5 + Math.random() * 3 // Slower, more subdued
            const color = colors[Math.floor(Math.random() * colors.length)]
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.04 + Math.random() * 0.05, // Faster decay for shorter effect
                color: color,
                size: 2 + Math.random() * 3 // Smaller particles
            })
        }
        return particles
    }, [])

    const startGame = useCallback(() => {
        // Clear any saved game state
        onClearGameState()
        setCountdown(0)
        setDeathCountdown(0)
        setGameOverWait(false)
        setIsCelebrating(false)
        setCelebrationStartTime(null)
        setIsVictory(false)
        setBossExplosionStartTime(null)
        fireworksRef.current = []
        bossExplosionRef.current = []
        enemyExplosionsRef.current = []
        powerupExplosionsRef.current = []
        hasCelebratedThisGameRef.current = false
        clockExtenderSpawnedForScoreMultiplierRef.current = false
        clockExtenderSpawnedForMagicDefenceRef.current = false
        clockExtenderSpawnedForSuperWeaponRef.current = false
        setScoreMultiplier(1)
        setScoreMultiplierEndTime(null)
        setMagicDefenceActive(false)
        setMagicDefenceEndTime(null)
        setSuperWeaponActive(false)
        setSuperWeaponEndTime(null)
        setGameState('playing')
        setScore(0)
        setLevel(1)
        setLives(3)
        playerRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 }
        bulletsRef.current = []
        enemiesRef.current = []
        enemyBulletsRef.current = []
        lifePowerupsRef.current = []
        scoreBonusPowerupsRef.current = []
        magicDefencePowerupsRef.current = []
        superWeaponPowerupsRef.current = []
        clockExtenderPowerupsRef.current = []
        homingMissilesRef.current = []
        bonusTextsRef.current = []
        bossRef.current = null
        bossShieldHitsRef.current = 0
        nextBossPowerupSpawnFrameRef.current = null
        frameCountRef.current = 0
        lastFrameTimeRef.current = null // Reset delta time tracking
        lastPlayerShotTimeRef.current = null // Reset player shot timing
        levelStartTimeRef.current = Date.now()
        levelAnnouncementStartTimeRef.current = Date.now()
        // Set first powerup spawn at a random time within the first level (0 to LEVEL_DURATION_FRAMES)
        nextPowerupSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        nextScoreBonusSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        nextMagicDefenceSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        nextSuperWeaponSpawnFrameRef.current = Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
        // Reset previous high score ref to current high score at game start
        previousHighScoreRef.current = highScore
    }, [highScore, onClearGameState])

    const gameOver = useCallback(() => {
        setGameState('gameover')
        if (gameStateRef.current.score > highScore) {
            const newHighScore = gameStateRef.current.score
            setHighScore(newHighScore)
            previousHighScoreRef.current = newHighScore
            localStorage.setItem('aliensHighScore', newHighScore.toString())
        }
        // Sad sound (80's computer style - descending low frequency)
        if (soundEnabled) {
            createSound(200, 0.3, 'sawtooth', 0.25)
            setTimeout(() => createSound(150, 0.3, 'sawtooth', 0.25), 300)
            setTimeout(() => createSound(100, 0.4, 'sawtooth', 0.25), 600)
        }
        // Wait 3 seconds before allowing restart
        setGameOverWait(true)
        setTimeout(() => {
            setGameOverWait(false)
        }, 3000)
    }, [highScore, soundEnabled])

    const victory = useCallback(() => {
        setGameState('gameover')
        setIsVictory(true)
        if (gameStateRef.current.score > highScore) {
            const newHighScore = gameStateRef.current.score
            setHighScore(newHighScore)
            previousHighScoreRef.current = newHighScore
            localStorage.setItem('aliensHighScore', newHighScore.toString())
        }
        
        // Create lots of fireworks all over the screen
        const positions = []
        for (let i = 0; i < 15; i++) {
            positions.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT
            })
        }
        fireworksRef.current = []
        positions.forEach(pos => {
            fireworksRef.current.push(...createFireworks(pos.x, pos.y))
        })
        
        // Special long 80's victory sounds
        if (soundEnabled) {
            const ctx = getAudioContext()
            if (ctx) {
                try {
                    // Long ascending victory fanfare
                    const osc1 = ctx.createOscillator()
                    const gain1 = ctx.createGain()
                    osc1.connect(gain1)
                    gain1.connect(ctx.destination)
                    osc1.type = 'square'
                    osc1.frequency.setValueAtTime(400, ctx.currentTime)
                    osc1.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3)
                    gain1.gain.setValueAtTime(0.3, ctx.currentTime)
                    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                    osc1.start(ctx.currentTime)
                    osc1.stop(ctx.currentTime + 0.5)
                    
                    setTimeout(() => {
                        const osc2 = ctx.createOscillator()
                        const gain2 = ctx.createGain()
                        osc2.connect(gain2)
                        gain2.connect(ctx.destination)
                        osc2.type = 'square'
                        osc2.frequency.setValueAtTime(500, ctx.currentTime)
                        osc2.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.3)
                        gain2.gain.setValueAtTime(0.3, ctx.currentTime)
                        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                        osc2.start(ctx.currentTime)
                        osc2.stop(ctx.currentTime + 0.5)
                    }, 400)
                    
                    setTimeout(() => {
                        const osc3 = ctx.createOscillator()
                        const gain3 = ctx.createGain()
                        osc3.connect(gain3)
                        gain3.connect(ctx.destination)
                        osc3.type = 'square'
                        osc3.frequency.setValueAtTime(600, ctx.currentTime)
                        osc3.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4)
                        gain3.gain.setValueAtTime(0.35, ctx.currentTime)
                        gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
                        osc3.start(ctx.currentTime)
                        osc3.stop(ctx.currentTime + 0.6)
                    }, 800)
                } catch (e) {}
            }
        }
        
        // Wait 5 seconds before allowing restart
        setGameOverWait(true)
        setTimeout(() => {
            setGameOverWait(false)
        }, 5000)
    }, [highScore, soundEnabled, createFireworks])

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e) => {
            keysRef.current[e.key] = true
            if (e.key === ' ') {
                e.preventDefault()
                if (gameStateRef.current.gameState === 'menu') {
                    startGame()
                } else if (gameStateRef.current.gameState === 'gameover' && !gameOverWait) {
                    startGame()
                }
            }
        }
        
        const handleKeyUp = (e) => {
            keysRef.current[e.key] = false
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [startGame, gameOverWait])

    // Touch handlers
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !isMobile) return

        const getCanvasCoordinates = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect()
            const scaleX = canvas.width / rect.width
            const scaleY = canvas.height / rect.height
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            }
        }

        const handleTouchStart = (e) => {
            e.preventDefault()
            if (gameStateRef.current.gameState === 'menu') {
                startGame()
                return
            } else if (gameStateRef.current.gameState === 'gameover' && !gameOverWait) {
                startGame()
                return
            }

            // Try to play pending music (mobile only, after user interaction)
            playMusicIfPending()

            const touch = e.touches[0]
            const coords = getCanvasCoordinates(touch.clientX, touch.clientY)
            const player = playerRef.current
            
            // Check if touch is on the player (within reasonable hitbox radius)
            const PLAYER_HITBOX_RADIUS = 40 // pixels
            const dx = coords.x - player.x
            const dy = coords.y - player.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const isOnPlayer = distance <= PLAYER_HITBOX_RADIUS
            
            touchRef.current = {
                x: coords.x,
                y: coords.y,
                isTouching: true,
                shootPressed: isOnPlayer // Only set to true if touching directly on player
            }
        }

        const handleTouchMove = (e) => {
            e.preventDefault()
            if (touchRef.current.isTouching && gameStateRef.current.gameState === 'playing') {
                // Try to play pending music (mobile only, after user interaction)
                playMusicIfPending()

                const touch = e.touches[0]
                const coords = getCanvasCoordinates(touch.clientX, touch.clientY)
                touchRef.current.x = coords.x
                touchRef.current.y = coords.y
            }
        }

        const handleTouchEnd = (e) => {
            e.preventDefault()
            touchRef.current = {
                x: null,
                y: null,
                isTouching: false,
                shootPressed: false
            }
        }

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart)
            canvas.removeEventListener('touchmove', handleTouchMove)
            canvas.removeEventListener('touchend', handleTouchEnd)
            canvas.removeEventListener('touchcancel', handleTouchEnd)
        }
    }, [startGame, isMobile, gameOverWait])

    // Load high score and restore game state on mount
    useEffect(() => {
        const saved = localStorage.getItem('aliensHighScore')
        if (saved) {
            const savedHighScore = parseInt(saved, 10)
            setHighScore(savedHighScore)
            previousHighScoreRef.current = savedHighScore
        }
        
        // Try to restore game state (will be null if page was refreshed, as React state clears)
        restoreGameState()
    }, [restoreGameState])

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => {
                if (countdown > 1) {
                    setCountdown(countdown - 1)
                } else {
                    setCountdown(0)
                    // Resume game after countdown
                    levelAnnouncementStartTimeRef.current = null
                }
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    // Death countdown timer
    useEffect(() => {
        if (deathCountdown > 0) {
            const timer = setTimeout(() => {
                if (deathCountdown > 1) {
                    setDeathCountdown(deathCountdown - 1)
                } else {
                    setDeathCountdown(0)
                    // Clear all enemies and bullets, reset player position
                    enemiesRef.current = []
                    bulletsRef.current = []
                    enemyBulletsRef.current = []
                    playerRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 }
                    
                    // If we're on level 10, respawn boss from top (only if boss exists, or if boss was defeated and explosion is over)
                    // Only respawn if boss exists (normal respawn) OR if explosion was active (boss was defeated)
                    if (level === 10 && levelStartTimeRef.current) {
                        const timeInLevel = (Date.now() - levelStartTimeRef.current) / 1000 // seconds
                        // Respawn boss if: (1) boss exists, OR (2) boss was defeated (explosion was active) and enough time has passed for boss to have spawned originally (60+ seconds)
                        if (bossRef.current || (bossExplosionStartTime && timeInLevel >= 60)) {
                            const BOSS_SIZE = 120
                            bossRef.current = {
                                x: CANVAS_WIDTH / 2 - BOSS_SIZE / 2,
                                y: -BOSS_SIZE, // Respawn from above
                                width: BOSS_SIZE,
                                height: BOSS_SIZE,
                                health: 40,
                                vx: 0,
                                vy: 2, // Initial downward velocity
                                lastShotFrame: null
                            }
                            // Initialize boss powerup spawn timer (4-15 seconds, at 60fps: 240-900 frames)
                            nextBossPowerupSpawnFrameRef.current = frameCountRef.current + 240 + Math.floor(Math.random() * 660)
                            // Clear explosion state if it was active
                            setBossExplosionStartTime(null)
                            bossExplosionRef.current = []
                        }
                    }
                    
                    // Clear clock extenders (useless since we're clearing special powers)
                    clockExtenderPowerupsRef.current = []
                    
                    // Clear homing missiles (from super weapon powerup)
                    homingMissilesRef.current = []
                    
                    // Clear all active special powers and their timers
                    setScoreMultiplier(1)
                    setScoreMultiplierEndTime(null)
                    setMagicDefenceActive(false)
                    setMagicDefenceEndTime(null)
                    setSuperWeaponActive(false)
                    setSuperWeaponEndTime(null)
                    
                    // Note: Regular powerups (lifePowerupsRef, scoreBonusPowerupsRef, 
                    // magicDefencePowerupsRef, superWeaponPowerupsRef) continue falling
                }
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [deathCountdown, level, bossExplosionStartTime])

    // Celebration timer (5 seconds)
    useEffect(() => {
        if (isCelebrating && celebrationStartTime) {
            const timer = setTimeout(() => {
                // Update high score after celebration
                setHighScore(gameStateRef.current.score)
                previousHighScoreRef.current = gameStateRef.current.score
                localStorage.setItem('aliensHighScore', gameStateRef.current.score.toString())
                setIsCelebrating(false)
                setCelebrationStartTime(null)
                fireworksRef.current = []
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [isCelebrating, celebrationStartTime])

    // 3X score multiplier timer
    useEffect(() => {
        if (scoreMultiplierEndTime) {
            const checkTimer = setInterval(() => {
                if (Date.now() >= scoreMultiplierEndTime) {
                    setScoreMultiplier(1)
                    setScoreMultiplierEndTime(null)
                }
            }, 100) // Check every 100ms
            return () => clearInterval(checkTimer)
        }
    }, [scoreMultiplierEndTime])

    // Magic defence timer
    useEffect(() => {
        if (magicDefenceEndTime) {
            const checkTimer = setInterval(() => {
                if (Date.now() >= magicDefenceEndTime) {
                    setMagicDefenceActive(false)
                    setMagicDefenceEndTime(null)
                }
            }, 100) // Check every 100ms
            return () => clearInterval(checkTimer)
        }
    }, [magicDefenceEndTime])

    // Super weapon timer
    useEffect(() => {
        if (superWeaponEndTime) {
            const checkTimer = setInterval(() => {
                if (Date.now() >= superWeaponEndTime) {
                    setSuperWeaponActive(false)
                    setSuperWeaponEndTime(null)
                }
            }, 100) // Check every 100ms
            return () => clearInterval(checkTimer)
        }
    }, [superWeaponEndTime])

    // Save game state on unmount
    useEffect(() => {
        return () => {
            saveGameState()
        }
    }, [saveGameState])

    // Detect mobile/desktop and set canvas size on mobile
    useEffect(() => {
        const checkMobile = () => {
            // Detect if device has touch capability (mobile)
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
            // Detect if width suggests mobile (even in landscape)
            const widthBasedMobile = window.innerWidth < 768
            // Check if in landscape orientation
            const isLandscape = window.innerWidth > window.innerHeight
            
            // If it has touch AND width is >= 768 AND landscape, it's likely mobile in landscape
            const mobileInLandscape = hasTouch && !widthBasedMobile && isLandscape
            
            if (mobileInLandscape) {
                setIsLandscapeMobile(true)
                setIsMobile(false)
                // Set desktop canvas size for now
                if (canvasRef.current) {
                    canvasRef.current.width = CANVAS_WIDTH
                    canvasRef.current.height = CANVAS_HEIGHT
                }
            } else {
                setIsLandscapeMobile(false)
                const mobile = widthBasedMobile || (hasTouch && window.innerWidth < 1024)
                setIsMobile(mobile)
                
                // On mobile, set canvas resolution to match viewport
                if (mobile && canvasRef.current) {
                    const canvas = canvasRef.current
                    canvas.width = window.innerWidth
                    canvas.height = window.innerHeight
                } else if (!mobile && canvasRef.current) {
                    // Reset to logical size on desktop
                    canvasRef.current.width = CANVAS_WIDTH
                    canvasRef.current.height = CANVAS_HEIGHT
                }
            }
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        window.addEventListener('orientationchange', checkMobile)
        return () => {
            window.removeEventListener('resize', checkMobile)
            window.removeEventListener('orientationchange', checkMobile)
        }
    }, [])

    // Update game state ref
    useEffect(() => {
        gameStateRef.current = { gameState, score, level, lives }
        soundEnabledRef.current = soundEnabled
        showHelpDialogRef.current = showHelpDialog
    }, [gameState, score, level, lives, soundEnabled, showHelpDialog])

    // Pause/resume level timer when help dialog opens/closes
    useEffect(() => {
        if (showHelpDialog && levelStartTimeRef.current) {
            // Help dialog opened: record pause start time
            helpDialogPauseStartTimeRef.current = Date.now()
        } else if (!showHelpDialog && helpDialogPauseStartTimeRef.current && levelStartTimeRef.current) {
            // Help dialog closed: adjust level start time to account for pause duration
            const pauseDuration = Date.now() - helpDialogPauseStartTimeRef.current
            levelStartTimeRef.current = levelStartTimeRef.current + pauseDuration
            helpDialogPauseStartTimeRef.current = null
        }
    }, [showHelpDialog])

    // Update high score during gameplay when current score exceeds it
    useEffect(() => {
        if (gameState === 'playing' && score > highScore) {
            setHighScore(score)
            localStorage.setItem('aliensHighScore', score.toString())
        }
    }, [score, highScore, gameState])

    // Get music player context
    const { audioRef: musicAudioRef, isPlaying: musicIsPlaying, hasPlayedRef: musicHasPlayedRef, handlePlayPause } = useMusicPlayerContext()

    // Ref for volume transition interval
    const volumeTransitionRef = useRef(null)
    
    // Ref to track if music playback is pending (on mobile, waiting for user interaction)
    const musicPlayPendingRef = useRef(false)

    // Helper function to play music (called from user interaction handlers on mobile)
    const playMusicIfPending = useCallback(() => {
        if (musicPlayPendingRef.current && musicAudioRef.current && musicAudioRef.current.paused) {
            const musicWasPausedInGame = localStorage.getItem('aliensGameMusicPaused') === 'true'
            if (!musicWasPausedInGame) {
                const targetVolume = soundEnabled ? 0.25 : 1.0
                musicAudioRef.current.volume = targetVolume
                const playPromise = musicAudioRef.current.play()
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Silently fail if autoplay is blocked (browser policy)
                        console.error('Auto-play music on game start failed:', error)
                    })
                }
                musicPlayPendingRef.current = false
            }
        }
    }, [musicAudioRef, soundEnabled])

    // Helper function for gradual volume transition
    const transitionVolume = useCallback((targetVolume, duration = 2000) => {
        if (!musicAudioRef.current) return

        const startVolume = musicAudioRef.current.volume
        const startTime = Date.now()

        // Clear any existing transition
        if (volumeTransitionRef.current) {
            clearInterval(volumeTransitionRef.current)
        }

        // Only transition if there's a change needed
        if (Math.abs(startVolume - targetVolume) < 0.01) {
            musicAudioRef.current.volume = targetVolume
            return
        }

        // Gradual volume transition
        volumeTransitionRef.current = setInterval(() => {
            if (!musicAudioRef.current) {
                if (volumeTransitionRef.current) {
                    clearInterval(volumeTransitionRef.current)
                    volumeTransitionRef.current = null
                }
                return
            }

            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            
            // Ease in-out cubic for smooth transition
            const easeProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2

            const currentVolume = startVolume + (targetVolume - startVolume) * easeProgress
            musicAudioRef.current.volume = currentVolume

            if (progress >= 1) {
                musicAudioRef.current.volume = targetVolume
                if (volumeTransitionRef.current) {
                    clearInterval(volumeTransitionRef.current)
                    volumeTransitionRef.current = null
                }
            }
        }, 16) // ~60fps updates
    }, [musicAudioRef])

    // Track game entry with analytics and set initial music volume
    useEffect(() => {
        if (window.gtag) {
            window.gtag('event', 'game_entry', {
                game_name: 'Aliens',
                action: 'enter_game'
            })
        }

        // Set initial volume when entering game route
        // If music is already playing, transition gradually; otherwise set immediately
        if (musicAudioRef.current) {
            const initialVolume = soundEnabled ? 0.25 : 1.0
            if (musicIsPlaying && !musicAudioRef.current.paused) {
                // Music is playing: transition gradually
                transitionVolume(initialVolume)
            } else {
                // Music is not playing: set immediately (no transition needed)
                musicAudioRef.current.volume = initialVolume
            }
        }
    }, [musicIsPlaying, soundEnabled, transitionVolume])

    // Wrapper for handlePlayPause that tracks in-game music state
    const handleMusicToggle = () => {
        handlePlayPause()
        // After toggling, update localStorage based on new state
        // We need to check the actual audio state after a brief delay
        setTimeout(() => {
            if (musicAudioRef.current) {
                const isNowPaused = musicAudioRef.current.paused
                if (isNowPaused) {
                    localStorage.setItem('aliensGameMusicPaused', 'true')
                } else {
                    localStorage.removeItem('aliensGameMusicPaused')
                }
            }
        }, 100)
    }

    // Play music when game starts, unless explicitly paused in-game
    // On mobile, delay playback until after user interaction
    const gameStartedRef = useRef(false)
    useEffect(() => {
        if (gameState === 'playing' && !gameStartedRef.current) {
            gameStartedRef.current = true
            const musicWasPausedInGame = localStorage.getItem('aliensGameMusicPaused') === 'true'
            if (!musicWasPausedInGame && musicAudioRef.current && musicAudioRef.current.paused) {
                if (isMobile) {
                    // On mobile, mark music as pending to play after user interaction
                    musicPlayPendingRef.current = true
                } else {
                    // On desktop, play immediately
                    const targetVolume = soundEnabled ? 0.25 : 1.0
                    musicAudioRef.current.volume = targetVolume
                    const playPromise = musicAudioRef.current.play()
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            // Silently fail if autoplay is blocked (browser policy)
                            console.error('Auto-play music on game start failed:', error)
                        })
                    }
                }
            }
        } else if (gameState === 'menu' || gameState === 'gameover') {
            gameStartedRef.current = false
            musicPlayPendingRef.current = false
        }
    }, [gameState, musicAudioRef, soundEnabled, isMobile])

    // Handle navigation back to home with analytics
    const handleBackToHome = () => {
        saveGameState()
        if (window.gtag) {
            window.gtag('event', 'game_exit', {
                game_name: 'Aliens',
                action: 'return_to_home'
            })
        }
        navigate('/')
    }

    // Toggle sound
    const toggleSound = () => {
        setSoundEnabled(prev => !prev)
    }

    // Share game using Web Share API
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Hostile Space @ neuronoiser.com',
                    text: 'Check out this retro space shooter game! Play Hostile Space - an 80s-style space shooter with powerups, 10 levels, and increasing difficulty.',
                    url: window.location.href
                })
            } catch (error) {
                // User cancelled or error occurred - silently fail
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error)
                }
            }
        }
    }

    // Helper functions to draw small icons for help dialog
    const drawRegularEnemyIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        // Outer glow
        ctx.shadowBlur = 4
        ctx.shadowColor = '#FF4400'
        ctx.fillStyle = '#8B0000'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Main body
        ctx.shadowBlur = 0
        ctx.fillStyle = '#CC0000'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius * 0.85, 0, Math.PI * 2)
        ctx.fill()
        
        // Center detail
        ctx.fillStyle = '#FFAA00'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }, [])

    const drawSkullEnemyIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        // Red halo
        ctx.shadowBlur = 6
        ctx.shadowColor = '#FF0000'
        ctx.fillStyle = '#000000'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Main body
        ctx.shadowBlur = 0
        ctx.fillStyle = '#1A0000'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        
        // Skull symbol (simplified)
        ctx.fillStyle = '#666666'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(centerX, centerY - radius * 0.2, radius * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        // Eye sockets
        ctx.fillStyle = '#FF0000'
        ctx.shadowBlur = 3
        ctx.shadowColor = '#FF0000'
        ctx.beginPath()
        ctx.arc(centerX - radius * 0.25, centerY - radius * 0.25, radius * 0.1, 0, Math.PI * 2)
        ctx.arc(centerX + radius * 0.25, centerY - radius * 0.25, radius * 0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
    }, [])

    const drawLifePowerupIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        ctx.fillStyle = '#0088FF'
        ctx.shadowBlur = 4
        ctx.shadowColor = '#0088FF'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = 'bold 10px "Courier New", monospace'
        ctx.fillText('+1', centerX, centerY)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.restore()
    }, [])

    const drawScorePowerupIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        const gradient = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX, centerY, radius)
        gradient.addColorStop(0, '#ADFF2F')
        gradient.addColorStop(0.5, '#32CD32')
        gradient.addColorStop(1, '#228B22')
        ctx.fillStyle = gradient
        ctx.shadowBlur = 5
        ctx.shadowColor = '#00FF00'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = 'bold 8px "Courier New", monospace'
        ctx.fillText('3X', centerX, centerY)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
        ctx.restore()
    }, [])

    const drawMagicDefencePowerupIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        const gradient = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX, centerY, radius)
        gradient.addColorStop(0, '#9370DB')
        gradient.addColorStop(0.5, '#8A2BE2')
        gradient.addColorStop(1, '#4B0082')
        ctx.fillStyle = gradient
        ctx.shadowBlur = 5
        ctx.shadowColor = '#9370DB'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
    }, [])

    const drawSuperWeaponPowerupIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        const gradient = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX, centerY, radius)
        gradient.addColorStop(0, '#40E0D0') // Bright turquoise
        gradient.addColorStop(0.5, '#00CED1') // Dark turquoise
        gradient.addColorStop(1, '#008B8B') // Dark cyan
        ctx.fillStyle = gradient
        ctx.shadowBlur = 5
        ctx.shadowColor = '#40E0D0'
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        
        // Crosshair
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1
        const symbolSize = radius * 0.5
        ctx.beginPath()
        ctx.moveTo(centerX - symbolSize, centerY)
        ctx.lineTo(centerX + symbolSize, centerY)
        ctx.moveTo(centerX, centerY - symbolSize)
        ctx.lineTo(centerX, centerY + symbolSize)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(centerX, centerY, symbolSize * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }, [])

    const drawClockExtenderPowerupIcon = useCallback((ctx, size = 20) => {
        const centerX = size / 2
        const centerY = size / 2
        const radius = size * 0.4
        
        ctx.save()
        const gradient = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX, centerY, radius)
        gradient.addColorStop(0, '#F0F0F0')
        gradient.addColorStop(0.5, '#E0E0E0')
        gradient.addColorStop(1, '#C0C0C0')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1
        ctx.stroke()
        
        // Clock hands
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 1
        ctx.lineCap = 'round'
        const clockRadius = radius * 0.8
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(centerX + clockRadius * 0.4, centerY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(centerX, centerY - clockRadius * 0.6)
        ctx.stroke()
        
        ctx.fillStyle = '#000000'
        ctx.beginPath()
        ctx.arc(centerX, centerY, 1, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }, [])

    // Draw help dialog icons
    useEffect(() => {
        if (!showHelpDialog) return

        const iconSize = 24
        const drawIcon = (canvasRef, drawFn) => {
            const canvas = canvasRef.current
            if (!canvas) return
            canvas.width = iconSize
            canvas.height = iconSize
            const ctx = canvas.getContext('2d')
            drawFn(ctx, iconSize)
        }

        drawIcon(regularEnemyIconRef, drawRegularEnemyIcon)
        drawIcon(skullEnemyIconRef, drawSkullEnemyIcon)
        drawIcon(lifePowerupIconRef, drawLifePowerupIcon)
        drawIcon(scorePowerupIconRef, drawScorePowerupIcon)
        drawIcon(magicDefencePowerupIconRef, drawMagicDefencePowerupIcon)
        drawIcon(superWeaponPowerupIconRef, drawSuperWeaponPowerupIcon)
        drawIcon(clockExtenderPowerupIconRef, drawClockExtenderPowerupIcon)
    }, [showHelpDialog, drawRegularEnemyIcon, drawSkullEnemyIcon, drawLifePowerupIcon, drawScorePowerupIcon, drawMagicDefencePowerupIcon, drawSuperWeaponPowerupIcon, drawClockExtenderPowerupIcon])

    // Track if we've initialized volume (skip transition on initial mount)
    const volumeInitializedRef = useRef(false)

    // Adjust music volume based on sound effects state (gradual transition)
    useEffect(() => {
        if (!volumeInitializedRef.current) {
            // Skip transition on initial mount (volume was already set in game entry effect)
            volumeInitializedRef.current = true
            return () => {
                // Restore volume to 100% when leaving game route
                transitionVolume(1.0)
            }
        }

        // After initial mount, use gradual transitions when sound effects toggle changes
        const targetVolume = soundEnabled ? 0.25 : 1.0 // 25% when sound effects on, 100% when off
        transitionVolume(targetVolume)

        return () => {
            // Restore volume to 100% when leaving game route
            transitionVolume(1.0)
        }
    }, [soundEnabled, transitionVolume])

    // Game loop
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        
        const gameLoop = () => {
            // Calculate delta time for frame-rate independent movement (fixes mobile throttling issue)
            const currentTime = performance.now()
            const deltaTime = lastFrameTimeRef.current !== null 
                ? Math.min((currentTime - lastFrameTimeRef.current) / 16.67, 2.0) // Normalize to 60fps, cap at 2x
                : 1.0 // First frame
            lastFrameTimeRef.current = currentTime
            
            // Clear canvas
            ctx.fillStyle = '#000011'
            if (isMobile) {
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                
                // Canvas resolution matches viewport (fills screen)
                // Scale drawing context to map logical coordinates and compensate aspect ratio
                const viewportAspect = canvas.width / canvas.height
                const logicalAspect = CANVAS_WIDTH / CANVAS_HEIGHT
                
                // Scale to map logical coordinates to viewport
                const baseScaleX = canvas.width / CANVAS_WIDTH
                const baseScaleY = canvas.height / CANVAS_HEIGHT
                
                // Compensate for aspect ratio difference to keep circles circular
                const aspectCompensation = logicalAspect / viewportAspect
                
                ctx.save()
                ctx.scale(baseScaleX * aspectCompensation, baseScaleY)
            } else {
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
            }

            // Draw stars
            ctx.fillStyle = '#ffffff'
            starsRef.current.forEach(star => {
                star.y += star.speed * deltaTime // Frame-rate independent
                if (star.y > CANVAS_HEIGHT) {
                    star.y = 0
                    star.x = Math.random() * CANVAS_WIDTH
                }
                ctx.fillRect(star.x, star.y, star.size, star.size)
            })

            if (gameStateRef.current.gameState === 'playing' && countdown === 0 && deathCountdown === 0 && !showHelpDialogRef.current) {
                frameCountRef.current++

                // Check for new high score (only once per game, and only if there was a previous high score)
                if (!hasCelebratedThisGameRef.current && 
                    previousHighScoreRef.current > 0 && 
                    gameStateRef.current.score > previousHighScoreRef.current && 
                    !isCelebrating) {
                    hasCelebratedThisGameRef.current = true
                    setIsCelebrating(true)
                    setCelebrationStartTime(Date.now())
                    // Create multiple firework bursts at different positions
                    const positions = [
                        { x: CANVAS_WIDTH * 0.2, y: CANVAS_HEIGHT * 0.3 },
                        { x: CANVAS_WIDTH * 0.5, y: CANVAS_HEIGHT * 0.4 },
                        { x: CANVAS_WIDTH * 0.8, y: CANVAS_HEIGHT * 0.3 },
                        { x: CANVAS_WIDTH * 0.3, y: CANVAS_HEIGHT * 0.6 },
                        { x: CANVAS_WIDTH * 0.7, y: CANVAS_HEIGHT * 0.6 }
                    ]
                    fireworksRef.current = []
                    positions.forEach(pos => {
                        fireworksRef.current.push(...createFireworks(pos.x, pos.y))
                    })
                    // Celebration sound
                    if (soundEnabledRef.current) {
                        createSound(400, 0.2, 'square', 0.3)
                        setTimeout(() => createSound(500, 0.2, 'square', 0.3), 150)
                        setTimeout(() => createSound(600, 0.3, 'square', 0.3), 300)
                    }
                }

                // Level progression: advance level every 60 seconds
                if (levelStartTimeRef.current && level < 10) {
                    const timeInLevel = (Date.now() - levelStartTimeRef.current) / 1000 // seconds
                    if (timeInLevel >= 60) {
                        const newLevel = level + 1
                        setLevel(newLevel)
                        levelStartTimeRef.current = Date.now()
                        levelAnnouncementStartTimeRef.current = Date.now()
                        // Set next powerup spawn at a random time within the new level
                        nextPowerupSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        nextScoreBonusSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        nextMagicDefenceSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        nextSuperWeaponSpawnFrameRef.current = frameCountRef.current + Math.floor(Math.random() * LEVEL_DURATION_FRAMES)
                        // Level up sound
                        if (soundEnabledRef.current) {
                            createSound(300, 0.1, 'square', 0.15)
                            setTimeout(() => createSound(400, 0.1, 'square', 0.15), 100)
                            setTimeout(() => createSound(500, 0.15, 'square', 0.15), 200)
                        }
                    }
                }

                // Check if level 10 is complete (60 seconds survived) and spawn boss
                if (level === 10 && levelStartTimeRef.current && !bossRef.current) {
                    const timeInLevel = (Date.now() - levelStartTimeRef.current) / 1000 // seconds
                    if (timeInLevel >= 60) {
                        // Spawn boss: Giant Space Spider (arrives from above)
                        const BOSS_SIZE = 120 // 4x regular enemy size (30 * 4)
                        bossRef.current = {
                            x: CANVAS_WIDTH / 2 - BOSS_SIZE / 2,
                            y: -BOSS_SIZE, // Start above screen
                            width: BOSS_SIZE,
                            height: BOSS_SIZE,
                            health: 40,
                            vx: 0,
                            vy: 2, // Initial downward velocity
                            lastShotFrame: null
                        }
                        // Initialize boss powerup spawn timer (4-15 seconds, at 60fps: 240-900 frames)
                        nextBossPowerupSpawnFrameRef.current = frameCountRef.current + 240 + Math.floor(Math.random() * 660)
                    }
                }

                // Get current level-based difficulty
                const currentEnemySpeed = getEnemySpeed(level)
                const currentEnemySpawnRate = getEnemySpawnRate(level)
                const currentEnemyHorizontalSpeed = getEnemyHorizontalSpeed(level)
                const megaEnemySpawnChance = getMegaEnemySpawnChance(level)
                const megaEnemyFireRate = getMegaEnemyFireRate(level)

                // Player movement
                const player = playerRef.current
                
                // Touch controls (20% faster on mobile)
                if (touchRef.current.isTouching && touchRef.current.x !== null && touchRef.current.y !== null) {
                    const targetX = Math.max(20, Math.min(CANVAS_WIDTH - 20, touchRef.current.x))
                    const targetY = Math.max(CANVAS_HEIGHT / 2, Math.min(CANVAS_HEIGHT - 20, touchRef.current.y))
                    const dx = targetX - player.x
                    const dy = targetY - player.y
                    const distance = Math.sqrt(dx * dx + dy * dy)
                    
                    // 20% faster on mobile (1.2x multiplier)
                    const playerSpeed = isMobile ? PLAYER_SPEED * 1.2 : PLAYER_SPEED
                    
                    if (distance > playerSpeed * deltaTime) {
                        player.x += (dx / distance) * playerSpeed * deltaTime
                        player.y += (dy / distance) * playerSpeed * deltaTime
                    } else {
                        player.x = targetX
                        player.y = targetY
                    }
                } else {
                    // Keyboard controls
                    if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A']) {
                        player.x = Math.max(20, player.x - PLAYER_SPEED * deltaTime)
                    }
                    if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) {
                        player.x = Math.min(CANVAS_WIDTH - 20, player.x + PLAYER_SPEED * deltaTime)
                    }
                    if (keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W']) {
                        player.y = Math.max(CANVAS_HEIGHT / 2, player.y - PLAYER_SPEED * deltaTime)
                    }
                    if (keysRef.current['ArrowDown'] || keysRef.current['s'] || keysRef.current['S']) {
                        player.y = Math.min(CANVAS_HEIGHT - 20, player.y + PLAYER_SPEED * deltaTime)
                    }
                }

                // Shooting
                const shouldShoot = keysRef.current[' '] || touchRef.current.shootPressed
                if (shouldShoot) {
                    const currentTime = performance.now()
                    if (superWeaponActive) {
                        // Super weapon: fire homing missiles (never more than number of enemies, max 3, and only for enemies not already targeted)
                        // Time-based fire rate: every 250ms (equivalent to every 15 frames at 60fps)
                        const superWeaponFireRate = 250 // milliseconds
                        const canShoot = lastPlayerShotTimeRef.current === null || 
                                       (currentTime - lastPlayerShotTimeRef.current) >= superWeaponFireRate
                        if (canShoot) {
                            lastPlayerShotTimeRef.current = currentTime
                            // Check if boss is already targeted
                            const bossTargeted = homingMissilesRef.current.some(m => m.targetBoss === true)
                            
                            // Find which enemies are already targeted by existing missiles
                            const targetedEnemyIndices = new Set(
                                homingMissilesRef.current
                                    .filter(m => m.targetEnemyIndex !== null && 
                                                m.targetEnemyIndex < enemiesRef.current.length &&
                                                enemiesRef.current[m.targetEnemyIndex] !== undefined)
                                    .map(m => m.targetEnemyIndex)
                            )
                            
                            // Find enemies that are not yet targeted
                            const availableEnemies = enemiesRef.current
                                .map((enemy, index) => ({ enemy, index }))
                                .filter(({ index }) => !targetedEnemyIndices.has(index))
                            
                            // Fire missiles for available enemies (max 3)
                            let missileCount = Math.min(3, availableEnemies.length)
                            
                            // If boss exists and not targeted, fire one missile at boss
                            if (bossRef.current && !bossTargeted) {
                                missileCount = 1
                                homingMissilesRef.current.push({
                                    x: player.x,
                                    y: player.y - 30,
                                    width: 6,
                                    height: 10,
                                    targetEnemyIndex: null,
                                    targetBoss: true // Mark as targeting boss
                                })
                                // Super weapon shoot sound (slightly different)
                                if (soundEnabledRef.current) createShootSound()
                            } else if (missileCount > 0) {
                                const spread = 20 // Horizontal spread for missiles
                                for (let i = 0; i < missileCount; i++) {
                                    const offsetX = (i - (missileCount - 1) / 2) * spread // Center the spread
                                    homingMissilesRef.current.push({
                                        x: player.x + offsetX,
                                        y: player.y - 30,
                                        width: 6,
                                        height: 10,
                                        targetEnemyIndex: null, // Will be assigned during update
                                        targetBoss: false
                                    })
                                }
                                // Super weapon shoot sound (slightly different)
                                if (soundEnabledRef.current) createShootSound()
                            }
                        }
                    } else {
                        // Regular shooting - time-based fire rate (every ~167ms = every 10 frames at 60fps)
                        const regularFireRate = 167 // milliseconds
                        const canShoot = lastPlayerShotTimeRef.current === null || 
                                       (currentTime - lastPlayerShotTimeRef.current) >= regularFireRate
                        if (canShoot) {
                            lastPlayerShotTimeRef.current = currentTime
                            bulletsRef.current.push({
                                x: player.x,
                                y: player.y - 30,
                                width: 4,
                                height: 12
                            })
                            // Shoot sound
                            if (soundEnabledRef.current) createShootSound()
                        }
                    }
                }

                // Update bullets
                bulletsRef.current = bulletsRef.current
                    .map(bullet => ({ ...bullet, y: bullet.y - BULLET_SPEED * deltaTime }))
                    .filter(bullet => bullet.y > -bullet.height)

                // Update homing missiles
                if (enemiesRef.current.length > 0 || bossRef.current) {
                    // Assign targets to missiles that don't have one (ensure unique targets)
                    const assignedTargets = new Set(
                        homingMissilesRef.current
                            .filter(m => m.targetEnemyIndex !== null && 
                                        m.targetEnemyIndex < enemiesRef.current.length &&
                                        enemiesRef.current[m.targetEnemyIndex] !== undefined)
                            .map(m => m.targetEnemyIndex)
                    )
                    
                    homingMissilesRef.current.forEach(missile => {
                        // Skip if already targeting boss
                        if (missile.targetBoss) return
                        
                        if (missile.targetEnemyIndex === null || 
                            missile.targetEnemyIndex >= enemiesRef.current.length ||
                            enemiesRef.current[missile.targetEnemyIndex] === undefined) {
                            // Find nearest enemy that isn't already targeted
                            let bestEnemyIndex = -1
                            let bestDistance = Infinity
                            
                            enemiesRef.current.forEach((enemy, index) => {
                                if (!assignedTargets.has(index)) {
                                    const distance = Math.sqrt(
                                        Math.pow(missile.x - (enemy.x + enemy.width / 2), 2) +
                                        Math.pow(missile.y - (enemy.y + enemy.height / 2), 2)
                                    )
                                    
                                    if (distance < bestDistance) {
                                        bestEnemyIndex = index
                                        bestDistance = distance
                                    }
                                }
                            })
                            
                            // If all enemies are targeted, find nearest anyway (fallback)
                            if (bestEnemyIndex === -1 && enemiesRef.current.length > 0) {
                                enemiesRef.current.forEach((enemy, index) => {
                                    const distance = Math.sqrt(
                                        Math.pow(missile.x - (enemy.x + enemy.width / 2), 2) +
                                        Math.pow(missile.y - (enemy.y + enemy.height / 2), 2)
                                    )
                                    if (distance < bestDistance) {
                                        bestEnemyIndex = index
                                        bestDistance = distance
                                    }
                                })
                            }
                            
                            if (bestEnemyIndex !== -1) {
                                missile.targetEnemyIndex = bestEnemyIndex
                                assignedTargets.add(bestEnemyIndex)
                            }
                        }
                    })
                    
                    // Move missiles toward their targets
                    homingMissilesRef.current = homingMissilesRef.current
                        .map(missile => {
                            // Handle boss targeting
                            if (missile.targetBoss && bossRef.current) {
                                const boss = bossRef.current
                                const targetX = boss.x + boss.width / 2
                                const targetY = boss.y + boss.height / 2
                                
                                const dx = targetX - missile.x
                                const dy = targetY - missile.y
                                const distance = Math.sqrt(dx * dx + dy * dy)
                                
                                if (distance > 0) {
                                    // Move toward boss with homing behavior
                                    const moveX = (dx / distance) * HOMING_MISSILE_SPEED * deltaTime
                                    const moveY = (dy / distance) * HOMING_MISSILE_SPEED * deltaTime
                                    
                                    return {
                                        ...missile,
                                        x: missile.x + moveX,
                                        y: missile.y + moveY
                                    }
                                }
                            }
                            
                            // Handle enemy targeting
                            if (missile.targetEnemyIndex !== null && 
                                missile.targetEnemyIndex < enemiesRef.current.length &&
                                enemiesRef.current[missile.targetEnemyIndex] !== undefined) {
                                const target = enemiesRef.current[missile.targetEnemyIndex]
                                const targetX = target.x + target.width / 2
                                const targetY = target.y + target.height / 2
                                
                                const dx = targetX - missile.x
                                const dy = targetY - missile.y
                                const distance = Math.sqrt(dx * dx + dy * dy)
                                
                                if (distance > 0) {
                                    // Move toward target with homing behavior
                                    const moveX = (dx / distance) * HOMING_MISSILE_SPEED * deltaTime
                                    const moveY = (dy / distance) * HOMING_MISSILE_SPEED * deltaTime
                                    
                                    return {
                                        ...missile,
                                        x: missile.x + moveX,
                                        y: missile.y + moveY
                                    }
                                }
                            }
                            // If no target, move upward
                            return {
                                ...missile,
                                y: missile.y - HOMING_MISSILE_SPEED
                            }
                        })
                        .filter(missile => {
                            // Remove if off screen
                            if (missile.y < -missile.height || missile.y > CANVAS_HEIGHT ||
                                missile.x < -missile.width || missile.x > CANVAS_WIDTH) {
                                return false
                            }
                            return true
                        })
                } else {
                    // No enemies or boss, just move missiles upward
                    homingMissilesRef.current = homingMissilesRef.current
                        .map(missile => ({
                            ...missile,
                            y: missile.y - HOMING_MISSILE_SPEED * deltaTime
                        }))
                        .filter(missile => missile.y > -missile.height)
                }

                // Update enemy bullets
                enemyBulletsRef.current = enemyBulletsRef.current
                    .map(bullet => ({
                        ...bullet,
                        x: bullet.x + bullet.vx * deltaTime,
                        y: bullet.y + bullet.vy * deltaTime
                    }))
                    .filter(bullet => {
                        // Remove if off screen
                        if (bullet.y > CANVAS_HEIGHT || bullet.x < 0 || bullet.x > CANVAS_WIDTH) {
                            return false
                        }
                        
                        // Collision with player
                        if (
                            bullet.x < player.x + 20 &&
                            bullet.x + bullet.width > player.x - 20 &&
                            bullet.y < player.y + 20 &&
                            bullet.y + bullet.height > player.y - 20
                        ) {
                            if (magicDefenceActive) {
                                // Check if this is a boss bullet - boss can destroy shield with 4 hits
                                if (bullet.isBossBullet) {
                                    bossShieldHitsRef.current += 1
                                    if (bossShieldHitsRef.current >= 4) {
                                        // Shield destroyed by boss - disable magic defence
                                        setMagicDefenceActive(false)
                                        setMagicDefenceEndTime(null)
                                        bossShieldHitsRef.current = 0
                                        // Shield destroyed sound
                                        if (soundEnabledRef.current) createSound(100, 0.2, 'sawtooth', 0.3)
                                    } else {
                                        // Boss hit shield but didn't destroy it yet - hit sound
                                        if (soundEnabledRef.current) createSound(200, 0.1, 'sawtooth', 0.2)
                                    }
                                } else {
                                    // Regular enemy bullet: blocked by shield
                                    // No sound, just remove the bullet
                                }
                            } else {
                                // Normal collision: lose life
                                setLives(prev => {
                                    const newLives = prev - 1
                                    // Lose life sound
                                    if (soundEnabledRef.current) createSound(150, 0.3, 'sawtooth', 0.25)
                                    if (newLives <= 0) {
                                        gameOver()
                                    } else {
                                        // Start 3-second death countdown before resuming with next life
                                        setDeathCountdown(3)
                                    }
                                    return newLives
                                })
                            }
                            return false
                        }
                        
                        return true
                    })

                // Spawn enemies (using level-based spawn rate) - but not when boss is active
                if (!bossRef.current && frameCountRef.current % Math.floor(currentEnemySpawnRate) === 0) {
                    // Random horizontal velocity (left or right)
                    const direction = Math.random() < 0.5 ? -1 : 1
                    const isMega = Math.random() < megaEnemySpawnChance
                    enemiesRef.current.push({
                        x: Math.random() * (CANVAS_WIDTH - 40) + 20,
                        y: -30,
                        width: 30,
                        height: 30,
                        health: 1,
                        vx: direction * (Math.random() * currentEnemyHorizontalSpeed + currentEnemyHorizontalSpeed * 0.5), // Random speed within range
                        isMega: isMega,
                        lastShotFrame: null // Track when mega enemy last shot (null = hasn't shot yet)
                    })
                }

                // Spawn life powerups at random intervals (approximately once per level)
                // Only spawn if none currently exists on screen
                if (nextPowerupSpawnFrameRef.current !== null && frameCountRef.current >= nextPowerupSpawnFrameRef.current && lifePowerupsRef.current.length === 0) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80 // Avoid spawning within 80 pixels of player x position
                    const BULLET_AVOID_ZONE = 50 // Avoid spawning within 50 pixels of bullet/missile x position
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        
                        // Check if position is too close to player
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        
                        // Check if position would be in path of bullets (in upper screen area)
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        
                        // Check if position would be in path of homing missiles (in upper screen area)
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) {
                            spawnX = null // Force retry
                        }
                    } while (spawnX === null && attempts < 30)
                    
                    // Clear the spawn frame whether we succeeded or failed to prevent multiple spawn attempts
                    nextPowerupSpawnFrameRef.current = null
                    
                    if (spawnX !== null) {
                        lifePowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                    }
                }

                // Spawn 3X score bonus powerups at random intervals (approximately once per level)
                // Only spawn if none currently exists on screen
                if (nextScoreBonusSpawnFrameRef.current !== null && frameCountRef.current >= nextScoreBonusSpawnFrameRef.current && scoreBonusPowerupsRef.current.length === 0) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    // Clear the spawn frame whether we succeeded or failed to prevent multiple spawn attempts
                    nextScoreBonusSpawnFrameRef.current = null
                    
                    if (spawnX !== null) {
                        scoreBonusPowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                    }
                }

                // Spawn magic defence powerups at random intervals (approximately once per level)
                // Only spawn if none currently exists on screen
                if (nextMagicDefenceSpawnFrameRef.current !== null && frameCountRef.current >= nextMagicDefenceSpawnFrameRef.current && magicDefencePowerupsRef.current.length === 0) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    // Clear the spawn frame whether we succeeded or failed to prevent multiple spawn attempts
                    nextMagicDefenceSpawnFrameRef.current = null
                    
                    if (spawnX !== null) {
                        magicDefencePowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                    }
                }

                // Spawn super weapon powerups at random intervals (approximately once per level)
                // Only spawn if none currently exists on screen
                if (nextSuperWeaponSpawnFrameRef.current !== null && frameCountRef.current >= nextSuperWeaponSpawnFrameRef.current && superWeaponPowerupsRef.current.length === 0) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    // Clear the spawn frame whether we succeeded or failed to prevent multiple spawn attempts
                    nextSuperWeaponSpawnFrameRef.current = null
                    
                    if (spawnX !== null) {
                        superWeaponPowerupsRef.current.push({
                            x: spawnX,
                            y: -LIFE_POWERUP_SIZE,
                            size: LIFE_POWERUP_SIZE
                        })
                    }
                }

                // Spawn clock extender powerups (randomly between 5 and 1.5 seconds before expiration)
                const CLOCK_EXTENDER_SPAWN_WINDOW_START = 5000 // 5 seconds before expiration
                const CLOCK_EXTENDER_SPAWN_WINDOW_END = 1500 // 1.5 seconds before expiration
                const EXTENSION_DURATION = 30000 // 30 seconds in milliseconds
                const clockExtenderSpawned = clockExtenderPowerupsRef.current.length > 0
                
                // Check if any powerup is in the spawn window (between 5 and 1.5 seconds before expiration)
                const now = Date.now()
                const clockExtenderSpawnChance = 0.02 // 2% chance per frame when in window

                // Update bonus texts (fade out and move up, remove after 1.5 seconds)
                const BONUS_TEXT_DURATION = 1500 // 1.5 seconds
                bonusTextsRef.current = bonusTextsRef.current
                    .filter(bonus => {
                        const age = now - bonus.startTime
                        return age < BONUS_TEXT_DURATION
                    })
                    .map(bonus => {
                        const age = now - bonus.startTime
                        return {
                            ...bonus,
                            y: bonus.y - 1, // Move up slowly
                            opacity: 1 - (age / BONUS_TEXT_DURATION) // Fade out
                        }
                    })
                
                // Check score multiplier
                if (scoreMultiplierEndTime && !clockExtenderSpawnedForScoreMultiplierRef.current && !clockExtenderDisabledForScoreMultiplierRef.current) {
                    const timeRemaining = scoreMultiplierEndTime - now
                    if (timeRemaining <= CLOCK_EXTENDER_SPAWN_WINDOW_START && timeRemaining >= CLOCK_EXTENDER_SPAWN_WINDOW_END && !clockExtenderSpawned) {
                        if (Math.random() < clockExtenderSpawnChance) {
                            clockExtenderSpawnedForScoreMultiplierRef.current = true
                            const PLAYER_AVOID_ZONE = 80
                            const BULLET_AVOID_ZONE = 50
                            let spawnX
                            let attempts = 0
                            do {
                                spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                                attempts++
                                const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                                const hasBulletInPath = bulletsRef.current.some(bullet => {
                                    const bulletCenterX = bullet.x
                                    return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                                })
                                const hasMissileInPath = homingMissilesRef.current.some(missile => {
                                    const missileCenterX = missile.x + missile.width / 2
                                    return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                                })
                                if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                            } while (spawnX === null && attempts < 30)
                            
                            if (spawnX !== null) {
                                clockExtenderPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                            }
                        }
                    }
                }
                
                // Check magic defence
                if (magicDefenceEndTime && !clockExtenderSpawnedForMagicDefenceRef.current && !clockExtenderDisabledForMagicDefenceRef.current) {
                    const timeRemaining = magicDefenceEndTime - now
                    if (timeRemaining <= CLOCK_EXTENDER_SPAWN_WINDOW_START && timeRemaining >= CLOCK_EXTENDER_SPAWN_WINDOW_END && !clockExtenderSpawned) {
                        if (Math.random() < clockExtenderSpawnChance) {
                            clockExtenderSpawnedForMagicDefenceRef.current = true
                            const PLAYER_AVOID_ZONE = 80
                            const BULLET_AVOID_ZONE = 50
                            let spawnX
                            let attempts = 0
                            do {
                                spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                                attempts++
                                const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                                const hasBulletInPath = bulletsRef.current.some(bullet => {
                                    const bulletCenterX = bullet.x
                                    return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                                })
                                const hasMissileInPath = homingMissilesRef.current.some(missile => {
                                    const missileCenterX = missile.x + missile.width / 2
                                    return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                                })
                                if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                            } while (spawnX === null && attempts < 30)
                            
                            if (spawnX !== null) {
                                clockExtenderPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                            }
                        }
                    }
                }
                
                // Check super weapon
                if (superWeaponEndTime && !clockExtenderSpawnedForSuperWeaponRef.current && !clockExtenderDisabledForSuperWeaponRef.current) {
                    const timeRemaining = superWeaponEndTime - now
                    if (timeRemaining <= CLOCK_EXTENDER_SPAWN_WINDOW_START && timeRemaining >= CLOCK_EXTENDER_SPAWN_WINDOW_END && !clockExtenderSpawned) {
                        if (Math.random() < clockExtenderSpawnChance) {
                            clockExtenderSpawnedForSuperWeaponRef.current = true
                            const PLAYER_AVOID_ZONE = 80
                            const BULLET_AVOID_ZONE = 50
                            let spawnX
                            let attempts = 0
                            do {
                                spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                                attempts++
                                const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                                const hasBulletInPath = bulletsRef.current.some(bullet => {
                                    const bulletCenterX = bullet.x
                                    return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                                })
                                const hasMissileInPath = homingMissilesRef.current.some(missile => {
                                    const missileCenterX = missile.x + missile.width / 2
                                    return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                                })
                                if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                            } while (spawnX === null && attempts < 30)
                            
                            if (spawnX !== null) {
                                clockExtenderPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                            }
                        }
                    }
                }
                
                // Reset spawn flags when powerups expire
                if (!scoreMultiplierEndTime) {
                    clockExtenderSpawnedForScoreMultiplierRef.current = false
                    clockExtenderDisabledForScoreMultiplierRef.current = false
                }
                if (!magicDefenceEndTime) {
                    clockExtenderSpawnedForMagicDefenceRef.current = false
                    clockExtenderDisabledForMagicDefenceRef.current = false
                }
                if (!superWeaponEndTime) {
                    clockExtenderSpawnedForSuperWeaponRef.current = false
                    clockExtenderDisabledForSuperWeaponRef.current = false
                }

                // Update life powerups
                lifePowerupsRef.current = lifePowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED * deltaTime }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            setLives(prev => prev + 1)
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(400, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(600, 0.1, 'square', 0.15), 50)
                            }
                            return false
                        }
                        return true
                    })

                // Update 3X score bonus powerups
                scoreBonusPowerupsRef.current = scoreBonusPowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED * deltaTime }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Check if already active (bonus condition)
                            const isAlreadyActive = scoreMultiplierEndTime !== null
                            if (isAlreadyActive) {
                                // Bonus: 1000 normally, 3000 with 3X multiplier
                                const bonusPoints = scoreMultiplier === 3 ? 3000 : 1000
                                setScore(prev => prev + bonusPoints)
                                // Special happy sound
                                if (soundEnabledRef.current) {
                                    createSound(800, 0.15, 'square', 0.2)
                                    setTimeout(() => createSound(1000, 0.15, 'square', 0.2), 100)
                                    setTimeout(() => createSound(1200, 0.2, 'square', 0.2), 200)
                                }
                                // Add bonus text
                                bonusTextsRef.current.push({
                                    x: powerup.x,
                                    y: powerup.y,
                                    text: `+${bonusPoints}`,
                                    startTime: Date.now()
                                })
                            }
                            // Activate 3X score multiplier for 20 seconds
                            setScoreMultiplier(3)
                            setScoreMultiplierEndTime(Date.now() + POWERUP_DURATION_SECONDS * 1000)
                            // 50% chance this powerup won't get a clock extender
                            clockExtenderDisabledForScoreMultiplierRef.current = Math.random() < 0.5
                            // Powerup collect sound (if not bonus)
                            if (!isAlreadyActive && soundEnabledRef.current) {
                                createSound(500, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(600, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(700, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update magic defence powerups
                magicDefencePowerupsRef.current = magicDefencePowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED * deltaTime }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Check if already active (bonus condition)
                            const isAlreadyActive = magicDefenceActive
                            if (isAlreadyActive) {
                                // Bonus: 1000 normally, 3000 with 3X multiplier
                                const bonusPoints = scoreMultiplier === 3 ? 3000 : 1000
                                setScore(prev => prev + bonusPoints)
                                // Special happy sound
                                if (soundEnabledRef.current) {
                                    createSound(800, 0.15, 'square', 0.2)
                                    setTimeout(() => createSound(1000, 0.15, 'square', 0.2), 100)
                                    setTimeout(() => createSound(1200, 0.2, 'square', 0.2), 200)
                                }
                                // Add bonus text
                                bonusTextsRef.current.push({
                                    x: powerup.x,
                                    y: powerup.y,
                                    text: `+${bonusPoints}`,
                                    startTime: Date.now()
                                })
                            }
                            // Activate magic defence for 20 seconds
                            setMagicDefenceActive(true)
                            setMagicDefenceEndTime(Date.now() + POWERUP_DURATION_SECONDS * 1000)
                            bossShieldHitsRef.current = 0 // Reset boss shield hits counter
                            // 50% chance this powerup won't get a clock extender
                            clockExtenderDisabledForMagicDefenceRef.current = Math.random() < 0.5
                            // Powerup collect sound (if not bonus)
                            if (!isAlreadyActive && soundEnabledRef.current) {
                                createSound(600, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(700, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(800, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update super weapon powerups
                superWeaponPowerupsRef.current = superWeaponPowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + LIFE_POWERUP_SPEED * deltaTime }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Check if already active (bonus condition)
                            const isAlreadyActive = superWeaponActive
                            if (isAlreadyActive) {
                                // Bonus: 1000 normally, 3000 with 3X multiplier
                                const bonusPoints = scoreMultiplier === 3 ? 3000 : 1000
                                setScore(prev => prev + bonusPoints)
                                // Special happy sound
                                if (soundEnabledRef.current) {
                                    createSound(800, 0.15, 'square', 0.2)
                                    setTimeout(() => createSound(1000, 0.15, 'square', 0.2), 100)
                                    setTimeout(() => createSound(1200, 0.2, 'square', 0.2), 200)
                                }
                                // Add bonus text
                                bonusTextsRef.current.push({
                                    x: powerup.x,
                                    y: powerup.y,
                                    text: `+${bonusPoints}`,
                                    startTime: Date.now()
                                })
                            }
                            // Activate super weapon for 20 seconds
                            setSuperWeaponActive(true)
                            setSuperWeaponEndTime(Date.now() + POWERUP_DURATION_SECONDS * 1000)
                            // 50% chance this powerup won't get a clock extender
                            clockExtenderDisabledForSuperWeaponRef.current = Math.random() < 0.5
                            // Powerup collect sound (if not bonus)
                            if (!isAlreadyActive && soundEnabledRef.current) {
                                createSound(700, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(800, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(900, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update clock extender powerups
                const CLOCK_EXTENDER_SPEED = LIFE_POWERUP_SPEED * 2.2 * 1.15 // 2.53x faster than other powerups (2.2 * 1.15)
                clockExtenderPowerupsRef.current = clockExtenderPowerupsRef.current
                    .map(powerup => ({ ...powerup, y: powerup.y + CLOCK_EXTENDER_SPEED * deltaTime }))
                    .filter(powerup => {
                        if (powerup.y > CANVAS_HEIGHT) return false
                        
                        // Collision with player (collect powerup)
                        const distance = Math.sqrt(
                            Math.pow(powerup.x - player.x, 2) + 
                            Math.pow(powerup.y - player.y, 2)
                        )
                        if (distance < powerup.size + 20) {
                            // Extend all active powerup timers by 30 seconds
                            const EXTENSION_DURATION = 30000
                            
                            if (scoreMultiplierEndTime) {
                                setScoreMultiplierEndTime(scoreMultiplierEndTime + EXTENSION_DURATION)
                                clockExtenderSpawnedForScoreMultiplierRef.current = false // Reset flag to allow another spawn
                            }
                            if (magicDefenceEndTime) {
                                setMagicDefenceEndTime(magicDefenceEndTime + EXTENSION_DURATION)
                                clockExtenderSpawnedForMagicDefenceRef.current = false // Reset flag to allow another spawn
                            }
                            if (superWeaponEndTime) {
                                setSuperWeaponEndTime(superWeaponEndTime + EXTENSION_DURATION)
                                clockExtenderSpawnedForSuperWeaponRef.current = false // Reset flag to allow another spawn
                            }
                            
                            // Powerup collect sound
                            if (soundEnabledRef.current) {
                                createSound(800, 0.1, 'square', 0.15)
                                setTimeout(() => createSound(900, 0.1, 'square', 0.15), 50)
                                setTimeout(() => createSound(1000, 0.1, 'square', 0.15), 100)
                            }
                            return false
                        }
                        return true
                    })

                // Update enemies (using level-based speed with horizontal movement)
                enemiesRef.current = enemiesRef.current
                    .map(enemy => {
                        // Move vertically
                        let newY = enemy.y + currentEnemySpeed * deltaTime
                        
                        // Move horizontally and handle boundary bouncing
                        let newX = enemy.x + (enemy.vx || 0) * deltaTime
                        let newVx = enemy.vx || 0
                        
                        // Bounce off left and right edges
                        if (newX < 0 || newX + enemy.width > CANVAS_WIDTH) {
                            newVx = -newVx // Reverse direction
                            newX = Math.max(0, Math.min(CANVAS_WIDTH - enemy.width, newX)) // Clamp to bounds
                        }
                        
                        // Mega enemies fire bullets at the player
                        let lastShotFrame = enemy.lastShotFrame
                        // Only shoot if enemy's bottom is at or above the player's y position (can't shoot upward)
                        if (enemy.isMega && enemy.y > 0 && enemy.y < CANVAS_HEIGHT - 100 && (enemy.y + enemy.height) <= player.y) {
                            // Fire rate varies by level (slow at low levels, rapid at high levels)
                            const fireRate = megaEnemyFireRate
                            // If lastShotFrame is null, allow immediate firing (set to a value that will trigger firing)
                            const framesSinceLastShot = lastShotFrame === null 
                                ? fireRate // Allow immediate firing if hasn't shot yet
                                : frameCountRef.current - lastShotFrame
                            if (framesSinceLastShot >= fireRate) {
                                // Shoot at player
                                const dx = player.x - (enemy.x + enemy.width / 2)
                                const dy = player.y - (enemy.y + enemy.height)
                                const distance = Math.sqrt(dx * dx + dy * dy)
                                const angle = Math.atan2(dy, dx)
                                
                                enemyBulletsRef.current.push({
                                    x: enemy.x + enemy.width / 2,
                                    y: enemy.y + enemy.height,
                                    width: 4,
                                    height: 8,
                                    vx: Math.cos(angle) * ENEMY_BULLET_SPEED,
                                    vy: Math.sin(angle) * ENEMY_BULLET_SPEED
                                })
                                
                                lastShotFrame = frameCountRef.current
                                
                                // Enemy shoot sound (quieter, different pitch)
                                if (soundEnabledRef.current) {
                                    const ctx = getAudioContext()
                                    if (ctx) {
                                        try {
                                            const oscillator = ctx.createOscillator()
                                            const gainNode = ctx.createGain()
                                            oscillator.connect(gainNode)
                                            gainNode.connect(ctx.destination)
                                            oscillator.type = 'sawtooth'
                                            oscillator.frequency.setValueAtTime(800, ctx.currentTime)
                                            oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)
                                            gainNode.gain.setValueAtTime(0.025, ctx.currentTime)
                                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
                                            oscillator.start(ctx.currentTime)
                                            oscillator.stop(ctx.currentTime + 0.1)
                                        } catch (e) {}
                                    }
                                }
                            }
                        }
                        
                        return { ...enemy, x: newX, y: newY, vx: newVx, lastShotFrame }
                    })
                    .filter(enemy => {
                        if (enemy.y > CANVAS_HEIGHT) return false
                        // Collision with player
                        if (
                            enemy.x < player.x + 20 &&
                            enemy.x + enemy.width > player.x - 20 &&
                            enemy.y < player.y + 20 &&
                            enemy.y + enemy.height > player.y - 20
                        ) {
                            if (magicDefenceActive) {
                                // Magic defence active: give points instead of losing life
                                const basePoints = enemy.isMega ? 500 : 100
                                setScore(prev => prev + (basePoints * scoreMultiplier))
                                // Defence hit sound
                                if (soundEnabledRef.current) createSound(200, 0.1, 'sawtooth', 0.2)
                            } else {
                                // Normal collision: lose life
                                setLives(prev => {
                                    const newLives = prev - 1
                                    // Lose life sound
                                    if (soundEnabledRef.current) createSound(150, 0.3, 'sawtooth', 0.25)
                                    if (newLives <= 0) {
                                        gameOver()
                                    } else {
                                        // Start 3-second death countdown before resuming with next life
                                        setDeathCountdown(3)
                                    }
                                    return newLives
                                })
                            }
                            return false
                        }
                        return true
                    })

                // Update boss movement and shooting
                // Don't update boss if explosion has started (boss was defeated)
                if (bossRef.current && !bossExplosionStartTime) {
                    const boss = bossRef.current
                    const BOSS_SIZE = 120
                    
                    // Boss arrives from above, then moves around
                    let newX = boss.x + boss.vx * deltaTime
                    let newY = boss.y + boss.vy * deltaTime
                    
                    // If boss is still entering from above (y < 50), continue moving down
                    if (boss.y < 50 && boss.vy > 0) {
                        // Continue moving down
                    } else if (boss.y < 50 && boss.vy <= 0) {
                        // Boss has entered, switch to random movement
                        if (frameCountRef.current % 60 === 0 || (boss.vx === 0 && boss.vy === 0)) {
                            const angle = Math.random() * Math.PI * 2
                            boss.vx = Math.cos(angle) * BOSS_SPEED
                            boss.vy = Math.sin(angle) * BOSS_SPEED
                        }
                    } else {
                        // Boss is on screen, use random movement
                        if (frameCountRef.current % 60 === 0 || (boss.vx === 0 && boss.vy === 0)) {
                            const angle = Math.random() * Math.PI * 2
                            boss.vx = Math.cos(angle) * BOSS_SPEED
                            boss.vy = Math.sin(angle) * BOSS_SPEED
                        }
                    }
                    
                    // Keep boss on screen (bounce off edges)
                    // Restrict boss to upper 2/3 of screen
                    const MAX_BOSS_Y = (CANVAS_HEIGHT * 2) / 3
                    if (newX < 0) {
                        newX = 0
                        boss.vx = -boss.vx
                    } else if (newX + BOSS_SIZE > CANVAS_WIDTH) {
                        newX = CANVAS_WIDTH - BOSS_SIZE
                        boss.vx = -boss.vx
                    }
                    
                    if (newY < 0) {
                        newY = 0
                        boss.vy = -boss.vy
                    } else if (newY + BOSS_SIZE > MAX_BOSS_Y) {
                        newY = MAX_BOSS_Y - BOSS_SIZE
                        boss.vy = -boss.vy
                    }
                    
                    boss.x = newX
                    boss.y = newY
                    
                    // Boss healing: heals completely in 30 seconds (adds 1/30 of missing health per second, 2x faster)
                    const MAX_BOSS_HEALTH = 40
                    if (boss.health < MAX_BOSS_HEALTH) {
                        const missingHealth = MAX_BOSS_HEALTH - boss.health
                        const healPerSecond = missingHealth / 30 // 1/30 of missing health per second (2x faster)
                        const healPerFrame = healPerSecond / 60 // At 60fps, heal per frame
                        boss.health = Math.min(MAX_BOSS_HEALTH, boss.health + healPerFrame)
                    }
                    
                    // Boss rapid fire shooting at player
                    const framesSinceLastShot = boss.lastShotFrame === null 
                        ? BOSS_FIRE_RATE // Allow immediate firing if hasn't shot yet
                        : frameCountRef.current - boss.lastShotFrame
                    
                    if (framesSinceLastShot >= BOSS_FIRE_RATE) {
                        // Shoot at player
                        const dx = player.x - (boss.x + BOSS_SIZE / 2)
                        const dy = player.y - (boss.y + BOSS_SIZE / 2)
                        const distance = Math.sqrt(dx * dx + dy * dy)
                        const angle = Math.atan2(dy, dx)
                        
                        enemyBulletsRef.current.push({
                            x: boss.x + BOSS_SIZE / 2,
                            y: boss.y + BOSS_SIZE / 2,
                            width: 6,
                            height: 10,
                            vx: Math.cos(angle) * ENEMY_BULLET_SPEED,
                            vy: Math.sin(angle) * ENEMY_BULLET_SPEED,
                            isBossBullet: true // Mark as boss bullet for shield destruction logic
                        })
                        
                        boss.lastShotFrame = frameCountRef.current
                        
                        // Boss shoot sound (deeper, more menacing)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    const oscillator = ctx.createOscillator()
                                    const gainNode = ctx.createGain()
                                    oscillator.connect(gainNode)
                                    gainNode.connect(ctx.destination)
                                    oscillator.type = 'sawtooth'
                                    oscillator.frequency.setValueAtTime(400, ctx.currentTime)
                                    oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15)
                                    gainNode.gain.setValueAtTime(0.04, ctx.currentTime)
                                    gainNode.gain.exponentialRampToValueAtTime(0.015, ctx.currentTime + 0.15)
                                    oscillator.start(ctx.currentTime)
                                    oscillator.stop(ctx.currentTime + 0.15)
                                } catch (e) {}
                            }
                        }
                    }
                }

                // Spawn random powerups when boss is active (4-15 second intervals)
                // Don't spawn powerups if explosion has started (boss was defeated)
                if (bossRef.current && !bossExplosionStartTime && nextBossPowerupSpawnFrameRef.current !== null && frameCountRef.current >= nextBossPowerupSpawnFrameRef.current) {
                    // Generate spawn position that avoids player's x position and player bullets/missiles
                    const PLAYER_AVOID_ZONE = 80
                    const BULLET_AVOID_ZONE = 50
                    let spawnX
                    let attempts = 0
                    do {
                        spawnX = Math.random() * (CANVAS_WIDTH - LIFE_POWERUP_SIZE * 2) + LIFE_POWERUP_SIZE
                        attempts++
                        const tooCloseToPlayer = Math.abs(spawnX - player.x) < PLAYER_AVOID_ZONE
                        const hasBulletInPath = bulletsRef.current.some(bullet => {
                            const bulletCenterX = bullet.x
                            return Math.abs(spawnX - bulletCenterX) < BULLET_AVOID_ZONE && bullet.y < CANVAS_HEIGHT * 0.3
                        })
                        const hasMissileInPath = homingMissilesRef.current.some(missile => {
                            const missileCenterX = missile.x + missile.width / 2
                            return Math.abs(spawnX - missileCenterX) < BULLET_AVOID_ZONE && missile.y < CANVAS_HEIGHT * 0.3
                        })
                        if (tooCloseToPlayer || hasBulletInPath || hasMissileInPath) spawnX = null
                    } while (spawnX === null && attempts < 30)
                    
                    if (spawnX !== null) {
                        // Randomly select powerup type (0=life, 1=score bonus, 2=magic defence, 3=super weapon)
                        const powerupType = Math.floor(Math.random() * 4)
                        switch (powerupType) {
                            case 0:
                                lifePowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                                break
                            case 1:
                                scoreBonusPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                                break
                            case 2:
                                magicDefencePowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                                break
                            case 3:
                                superWeaponPowerupsRef.current.push({
                                    x: spawnX,
                                    y: -LIFE_POWERUP_SIZE,
                                    size: LIFE_POWERUP_SIZE
                                })
                                break
                        }
                        // Schedule next boss powerup spawn (4-15 seconds, at 60fps: 240-900 frames)
                        nextBossPowerupSpawnFrameRef.current = frameCountRef.current + 240 + Math.floor(Math.random() * 660)
                    } else {
                        // If couldn't find a spawn position, try again soon
                        nextBossPowerupSpawnFrameRef.current = frameCountRef.current + 60 // Try again in 1 second
                    }
                }

                // Bullet-enemy collisions
                bulletsRef.current = bulletsRef.current.filter(bullet => {
                    // Check collision with boss first (if boss exists)
                    if (bossRef.current) {
                        const boss = bossRef.current
                        if (
                            bullet.x < boss.x + boss.width &&
                            bullet.x + bullet.width > boss.x &&
                            bullet.y < boss.y + boss.height &&
                            bullet.y + bullet.height > boss.y
                        ) {
                            // Hit boss - reduce health
                            boss.health -= 1
                            // Award points for hitting boss (2000 base, tripled with 3x score)
                            const hitPoints = 2000 * scoreMultiplier
                            setScore(prev => prev + hitPoints)
                            // Boss hit sound
                            if (soundEnabledRef.current) createSound(150, 0.15, 'sawtooth', 0.25)
                            
                            // Check if boss is defeated
                            if (boss.health <= 0) {
                                // Award points for killing boss (10000 base, tripled with 3x score)
                                const killPoints = 10000 * scoreMultiplier
                                setScore(prev => prev + killPoints)
                                // Immediately remove boss to prevent further updates/drawing
                                const BOSS_SIZE = 120
                                const explosionX = boss.x + BOSS_SIZE / 2
                                const explosionY = boss.y + BOSS_SIZE / 2
                                bossRef.current = null // Set to null IMMEDIATELY
                                bossExplosionRef.current = createBossExplosion(explosionX, explosionY)
                                setBossExplosionStartTime(Date.now())
                                
                                // Big explosion sound
                                if (soundEnabledRef.current) {
                                    const ctx = getAudioContext()
                                    if (ctx) {
                                        try {
                                            // Low frequency boom
                                            const osc1 = ctx.createOscillator()
                                            const gain1 = ctx.createGain()
                                            osc1.connect(gain1)
                                            gain1.connect(ctx.destination)
                                            osc1.type = 'sawtooth'
                                            osc1.frequency.setValueAtTime(80, ctx.currentTime)
                                            osc1.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5)
                                            gain1.gain.setValueAtTime(0.3, ctx.currentTime)
                                            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
                                            osc1.start(ctx.currentTime)
                                            osc1.stop(ctx.currentTime + 0.8)
                                            
                                            // High frequency crack
                                            setTimeout(() => {
                                                const osc2 = ctx.createOscillator()
                                                const gain2 = ctx.createGain()
                                                osc2.connect(gain2)
                                                gain2.connect(ctx.destination)
                                                osc2.type = 'square'
                                                osc2.frequency.setValueAtTime(400, ctx.currentTime)
                                                osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3)
                                                gain2.gain.setValueAtTime(0.2, ctx.currentTime)
                                                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                                                osc2.start(ctx.currentTime)
                                                osc2.stop(ctx.currentTime + 0.5)
                                            }, 100)
                                        } catch (e) {}
                                    }
                                }
                            }
                            return false
                        }
                    }
                    
                    // Check collision with enemies
                    const hitEnemy = enemiesRef.current.findIndex(enemy => {
                        if (
                            bullet.x < enemy.x + enemy.width &&
                            bullet.x + bullet.width > enemy.x &&
                            bullet.y < enemy.y + enemy.height &&
                            bullet.y + bullet.height > enemy.y
                        ) {
                            return true
                        }
                        return false
                    })

                    if (hitEnemy !== -1) {
                        const destroyedEnemy = enemiesRef.current[hitEnemy]
                        const enemyCenterX = destroyedEnemy.x + destroyedEnemy.width / 2
                        const enemyCenterY = destroyedEnemy.y + destroyedEnemy.height / 2
                        // Create explosion at enemy center (fancy for mega enemies)
                        enemyExplosionsRef.current.push({
                            particles: destroyedEnemy.isMega 
                                ? createMegaEnemyExplosion(enemyCenterX, enemyCenterY)
                                : createEnemyExplosion(enemyCenterX, enemyCenterY),
                            startTime: Date.now()
                        })
                        enemiesRef.current.splice(hitEnemy, 1)
                        // Mega enemies give 500 points, regular enemies give 100
                        const basePoints = destroyedEnemy.isMega ? 500 : 100
                        setScore(prev => prev + (basePoints * scoreMultiplier))
                        // Enemy explosion sound (more satisfying for mega enemies)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    if (destroyedEnemy.isMega) {
                                        // Fancy skull ship explosion: two-part satisfying sound
                                        // Low frequency boom
                                        const osc1 = ctx.createOscillator()
                                        const gain1 = ctx.createGain()
                                        osc1.connect(gain1)
                                        gain1.connect(ctx.destination)
                                        osc1.type = 'sawtooth'
                                        osc1.frequency.setValueAtTime(120, ctx.currentTime)
                                        osc1.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25)
                                        gain1.gain.setValueAtTime(0.2, ctx.currentTime)
                                        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                        osc1.start(ctx.currentTime)
                                        osc1.stop(ctx.currentTime + 0.35)
                                        
                                        // High frequency crack (satisfying pop)
                                        setTimeout(() => {
                                            const osc2 = ctx.createOscillator()
                                            const gain2 = ctx.createGain()
                                            osc2.connect(gain2)
                                            gain2.connect(ctx.destination)
                                            osc2.type = 'square'
                                            osc2.frequency.setValueAtTime(350, ctx.currentTime)
                                            osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2)
                                            gain2.gain.setValueAtTime(0.15, ctx.currentTime)
                                            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
                                            osc2.start(ctx.currentTime)
                                            osc2.stop(ctx.currentTime + 0.3)
                                        }, 80)
                                    } else {
                                        // Regular enemy: simple explosion sound
                                        const osc1 = ctx.createOscillator()
                                        const gain1 = ctx.createGain()
                                        osc1.connect(gain1)
                                        gain1.connect(ctx.destination)
                                        osc1.type = 'sawtooth'
                                        osc1.frequency.setValueAtTime(150, ctx.currentTime)
                                        osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15)
                                        gain1.gain.setValueAtTime(0.15, ctx.currentTime)
                                        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
                                        osc1.start(ctx.currentTime)
                                        osc1.stop(ctx.currentTime + 0.2)
                                    }
                                } catch (e) {}
                            }
                        }
                        return false
                    }

                    return true
                })

                // Homing missile-enemy collisions
                const missilesToRemove = new Set()
                const enemiesToRemove = []
                
                homingMissilesRef.current.forEach((missile, missileIndex) => {
                    // Check collision with boss first (if boss exists)
                    if (bossRef.current && !missilesToRemove.has(missileIndex)) {
                        const boss = bossRef.current
                        const missileCenterX = missile.x + missile.width / 2
                        const missileCenterY = missile.y + missile.height / 2
                        const bossCenterX = boss.x + boss.width / 2
                        const bossCenterY = boss.y + boss.height / 2
                        
                        const distance = Math.sqrt(
                            Math.pow(missileCenterX - bossCenterX, 2) +
                            Math.pow(missileCenterY - bossCenterY, 2)
                        )
                        
                        // Collision detection with reasonable hitbox
                        if (distance < (missile.width + boss.width) / 2) {
                            // Hit boss - reduce health
                            boss.health -= 1
                            // Mark this missile for removal
                            missilesToRemove.add(missileIndex)
                            // Award points for hitting boss (2000 base, tripled with 3x score)
                            const hitPoints = 2000 * scoreMultiplier
                            setScore(prev => prev + hitPoints)
                            // Boss hit sound
                            if (soundEnabledRef.current) createSound(150, 0.15, 'sawtooth', 0.25)
                            
                            // Check if boss is defeated
                            if (boss.health <= 0) {
                                // Award points for killing boss (10000 base, tripled with 3x score)
                                const killPoints = 10000 * scoreMultiplier
                                setScore(prev => prev + killPoints)
                                // Immediately remove boss to prevent further updates/drawing
                                const BOSS_SIZE = 120
                                const explosionX = boss.x + BOSS_SIZE / 2
                                const explosionY = boss.y + BOSS_SIZE / 2
                                bossRef.current = null // Set to null IMMEDIATELY
                                bossExplosionRef.current = createBossExplosion(explosionX, explosionY)
                                setBossExplosionStartTime(Date.now())
                                
                                // Big explosion sound
                                if (soundEnabledRef.current) {
                                    const ctx = getAudioContext()
                                    if (ctx) {
                                        try {
                                            // Low frequency boom
                                            const osc1 = ctx.createOscillator()
                                            const gain1 = ctx.createGain()
                                            osc1.connect(gain1)
                                            gain1.connect(ctx.destination)
                                            osc1.type = 'sawtooth'
                                            osc1.frequency.setValueAtTime(80, ctx.currentTime)
                                            osc1.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5)
                                            gain1.gain.setValueAtTime(0.3, ctx.currentTime)
                                            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
                                            osc1.start(ctx.currentTime)
                                            osc1.stop(ctx.currentTime + 0.8)
                                            
                                            // High frequency crack
                                            setTimeout(() => {
                                                const osc2 = ctx.createOscillator()
                                                const gain2 = ctx.createGain()
                                                osc2.connect(gain2)
                                                gain2.connect(ctx.destination)
                                                osc2.type = 'square'
                                                osc2.frequency.setValueAtTime(400, ctx.currentTime)
                                                osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3)
                                                gain2.gain.setValueAtTime(0.2, ctx.currentTime)
                                                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                                                osc2.start(ctx.currentTime)
                                                osc2.stop(ctx.currentTime + 0.5)
                                            }, 100)
                                        } catch (e) {}
                                    }
                                }
                            }
                        }
                    }
                    
                    // Check collision with enemies
                    let hitEnemy = -1
                    if (!missilesToRemove.has(missileIndex)) {
                        hitEnemy = enemiesRef.current.findIndex(enemy => {
                            const missileCenterX = missile.x + missile.width / 2
                            const missileCenterY = missile.y + missile.height / 2
                            const enemyCenterX = enemy.x + enemy.width / 2
                            const enemyCenterY = enemy.y + enemy.height / 2
                            
                            const distance = Math.sqrt(
                                Math.pow(missileCenterX - enemyCenterX, 2) +
                                Math.pow(missileCenterY - enemyCenterY, 2)
                            )
                            
                            // Collision detection with reasonable hitbox
                            return distance < (missile.width + Math.max(enemy.width, enemy.height)) / 2
                        })
                    }

                    if (hitEnemy !== -1 && !enemiesToRemove.includes(hitEnemy)) {
                        const destroyedEnemy = enemiesRef.current[hitEnemy]
                        const enemyCenterX = destroyedEnemy.x + destroyedEnemy.width / 2
                        const enemyCenterY = destroyedEnemy.y + destroyedEnemy.height / 2
                        const BLAST_RADIUS = 60 // Radius for blast effect
                        
                        // Create explosion at enemy center (fancy for mega enemies)
                        enemyExplosionsRef.current.push({
                            particles: destroyedEnemy.isMega 
                                ? createMegaEnemyExplosion(enemyCenterX, enemyCenterY)
                                : createEnemyExplosion(enemyCenterX, enemyCenterY),
                            startTime: Date.now()
                        })
                        
                        // Mark this missile for removal
                        missilesToRemove.add(missileIndex)
                        
                        // Mark enemy for removal
                        enemiesToRemove.push(hitEnemy)
                        
                        // Find and mark all nearby missiles for destruction (blast effect)
                        homingMissilesRef.current.forEach((otherMissile, otherIndex) => {
                            if (otherIndex !== missileIndex && !missilesToRemove.has(otherIndex)) {
                                const otherMissileCenterX = otherMissile.x + otherMissile.width / 2
                                const otherMissileCenterY = otherMissile.y + otherMissile.height / 2
                                
                                const distanceToBlast = Math.sqrt(
                                    Math.pow(otherMissileCenterX - enemyCenterX, 2) +
                                    Math.pow(otherMissileCenterY - enemyCenterY, 2)
                                )
                                
                                if (distanceToBlast < BLAST_RADIUS) {
                                    missilesToRemove.add(otherIndex)
                                }
                            }
                        })
                        
                        // Mega enemies give 500 points, regular enemies give 100
                        const basePoints = destroyedEnemy.isMega ? 500 : 100
                        setScore(prev => prev + (basePoints * scoreMultiplier))
                        // Enemy explosion sound (more satisfying for mega enemies)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    if (destroyedEnemy.isMega) {
                                        // Fancy skull ship explosion: two-part satisfying sound
                                        // Low frequency boom
                                        const osc1 = ctx.createOscillator()
                                        const gain1 = ctx.createGain()
                                        osc1.connect(gain1)
                                        gain1.connect(ctx.destination)
                                        osc1.type = 'sawtooth'
                                        osc1.frequency.setValueAtTime(120, ctx.currentTime)
                                        osc1.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25)
                                        gain1.gain.setValueAtTime(0.2, ctx.currentTime)
                                        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                        osc1.start(ctx.currentTime)
                                        osc1.stop(ctx.currentTime + 0.35)
                                        
                                        // High frequency crack (satisfying pop)
                                        setTimeout(() => {
                                            const osc2 = ctx.createOscillator()
                                            const gain2 = ctx.createGain()
                                            osc2.connect(gain2)
                                            gain2.connect(ctx.destination)
                                            osc2.type = 'square'
                                            osc2.frequency.setValueAtTime(350, ctx.currentTime)
                                            osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2)
                                            gain2.gain.setValueAtTime(0.15, ctx.currentTime)
                                            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
                                            osc2.start(ctx.currentTime)
                                            osc2.stop(ctx.currentTime + 0.3)
                                        }, 80)
                                    } else {
                                        // Regular enemy: simple explosion sound
                                        const osc1 = ctx.createOscillator()
                                        const gain1 = ctx.createGain()
                                        osc1.connect(gain1)
                                        gain1.connect(ctx.destination)
                                        osc1.type = 'sawtooth'
                                        osc1.frequency.setValueAtTime(150, ctx.currentTime)
                                        osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15)
                                        gain1.gain.setValueAtTime(0.15, ctx.currentTime)
                                        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
                                        osc1.start(ctx.currentTime)
                                        osc1.stop(ctx.currentTime + 0.2)
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                })
                
                // Remove destroyed enemies (in reverse order to maintain indices)
                enemiesToRemove.sort((a, b) => b - a).forEach(index => {
                    enemiesRef.current.splice(index, 1)
                })
                
                // Remove destroyed missiles (in reverse order to maintain indices)
                const missilesIndicesToRemove = Array.from(missilesToRemove).sort((a, b) => b - a)
                missilesIndicesToRemove.forEach(index => {
                    homingMissilesRef.current.splice(index, 1)
                })

                // Check collision with life powerups (destroy powerup if shot)
                bulletsRef.current = bulletsRef.current.filter(bullet => {
                    // Check collision with life powerups (destroy powerup if shot)
                    const hitLifePowerup = lifePowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitLifePowerup !== -1) {
                        const destroyedPowerup = lifePowerupsRef.current[hitLifePowerup]
                        const powerupCenterX = destroyedPowerup.x
                        const powerupCenterY = destroyedPowerup.y
                        // Create disappointment explosion at powerup center
                        powerupExplosionsRef.current.push({
                            particles: createPowerupExplosion(powerupCenterX, powerupCenterY),
                            startTime: Date.now()
                        })
                        lifePowerupsRef.current.splice(hitLifePowerup, 1)
                        // Disappointment sound (descending sad tone)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    const osc = ctx.createOscillator()
                                    const gain = ctx.createGain()
                                    osc.connect(gain)
                                    gain.connect(ctx.destination)
                                    osc.type = 'sawtooth'
                                    osc.frequency.setValueAtTime(300, ctx.currentTime)
                                    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3)
                                    gain.gain.setValueAtTime(0.12, ctx.currentTime)
                                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                    osc.start(ctx.currentTime)
                                    osc.stop(ctx.currentTime + 0.35)
                                } catch (e) {}
                            }
                        }
                        return false
                    }

                    // Check collision with 3X score bonus powerups (destroy powerup if shot)
                    const hitScoreBonusPowerup = scoreBonusPowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitScoreBonusPowerup !== -1) {
                        const destroyedPowerup = scoreBonusPowerupsRef.current[hitScoreBonusPowerup]
                        const powerupCenterX = destroyedPowerup.x
                        const powerupCenterY = destroyedPowerup.y
                        // Create disappointment explosion at powerup center
                        powerupExplosionsRef.current.push({
                            particles: createPowerupExplosion(powerupCenterX, powerupCenterY),
                            startTime: Date.now()
                        })
                        scoreBonusPowerupsRef.current.splice(hitScoreBonusPowerup, 1)
                        // Disappointment sound (descending sad tone)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    const osc = ctx.createOscillator()
                                    const gain = ctx.createGain()
                                    osc.connect(gain)
                                    gain.connect(ctx.destination)
                                    osc.type = 'sawtooth'
                                    osc.frequency.setValueAtTime(300, ctx.currentTime)
                                    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3)
                                    gain.gain.setValueAtTime(0.12, ctx.currentTime)
                                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                    osc.start(ctx.currentTime)
                                    osc.stop(ctx.currentTime + 0.35)
                                } catch (e) {}
                            }
                        }
                        return false
                    }

                    // Check collision with magic defence powerups (destroy powerup if shot)
                    const hitMagicDefencePowerup = magicDefencePowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitMagicDefencePowerup !== -1) {
                        const destroyedPowerup = magicDefencePowerupsRef.current[hitMagicDefencePowerup]
                        const powerupCenterX = destroyedPowerup.x
                        const powerupCenterY = destroyedPowerup.y
                        // Create disappointment explosion at powerup center
                        powerupExplosionsRef.current.push({
                            particles: createPowerupExplosion(powerupCenterX, powerupCenterY),
                            startTime: Date.now()
                        })
                        magicDefencePowerupsRef.current.splice(hitMagicDefencePowerup, 1)
                        // Disappointment sound (descending sad tone)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    const osc = ctx.createOscillator()
                                    const gain = ctx.createGain()
                                    osc.connect(gain)
                                    gain.connect(ctx.destination)
                                    osc.type = 'sawtooth'
                                    osc.frequency.setValueAtTime(300, ctx.currentTime)
                                    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3)
                                    gain.gain.setValueAtTime(0.12, ctx.currentTime)
                                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                    osc.start(ctx.currentTime)
                                    osc.stop(ctx.currentTime + 0.35)
                                } catch (e) {}
                            }
                        }
                        return false
                    }

                    // Check collision with super weapon powerups (destroy powerup if shot)
                    const hitSuperWeaponPowerup = superWeaponPowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitSuperWeaponPowerup !== -1) {
                        const destroyedPowerup = superWeaponPowerupsRef.current[hitSuperWeaponPowerup]
                        const powerupCenterX = destroyedPowerup.x
                        const powerupCenterY = destroyedPowerup.y
                        // Create disappointment explosion at powerup center
                        powerupExplosionsRef.current.push({
                            particles: createPowerupExplosion(powerupCenterX, powerupCenterY),
                            startTime: Date.now()
                        })
                        superWeaponPowerupsRef.current.splice(hitSuperWeaponPowerup, 1)
                        // Disappointment sound (descending sad tone)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    const osc = ctx.createOscillator()
                                    const gain = ctx.createGain()
                                    osc.connect(gain)
                                    gain.connect(ctx.destination)
                                    osc.type = 'sawtooth'
                                    osc.frequency.setValueAtTime(300, ctx.currentTime)
                                    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3)
                                    gain.gain.setValueAtTime(0.12, ctx.currentTime)
                                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                    osc.start(ctx.currentTime)
                                    osc.stop(ctx.currentTime + 0.35)
                                } catch (e) {}
                            }
                        }
                        return false
                    }

                    // Check collision with clock extender powerups (destroy powerup if shot)
                    const hitClockExtenderPowerup = clockExtenderPowerupsRef.current.findIndex(powerup => {
                        const distance = Math.sqrt(
                            Math.pow(bullet.x - powerup.x, 2) + 
                            Math.pow(bullet.y - powerup.y, 2)
                        )
                        return distance < powerup.size
                    })

                    if (hitClockExtenderPowerup !== -1) {
                        const destroyedPowerup = clockExtenderPowerupsRef.current[hitClockExtenderPowerup]
                        const powerupCenterX = destroyedPowerup.x
                        const powerupCenterY = destroyedPowerup.y
                        // Create disappointment explosion at powerup center
                        powerupExplosionsRef.current.push({
                            particles: createPowerupExplosion(powerupCenterX, powerupCenterY),
                            startTime: Date.now()
                        })
                        clockExtenderPowerupsRef.current.splice(hitClockExtenderPowerup, 1)
                        // Disappointment sound (descending sad tone)
                        if (soundEnabledRef.current) {
                            const ctx = getAudioContext()
                            if (ctx) {
                                try {
                                    const osc = ctx.createOscillator()
                                    const gain = ctx.createGain()
                                    osc.connect(gain)
                                    gain.connect(ctx.destination)
                                    osc.type = 'sawtooth'
                                    osc.frequency.setValueAtTime(300, ctx.currentTime)
                                    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3)
                                    gain.gain.setValueAtTime(0.12, ctx.currentTime)
                                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
                                    osc.start(ctx.currentTime)
                                    osc.stop(ctx.currentTime + 0.35)
                                } catch (e) {}
                            }
                        }
                        return false
                    }

                    return true
                })

                // Draw player
                ctx.fillStyle = '#00FFFF'
                const playerWidth = isMobile ? 30 : 15
                ctx.beginPath()
                ctx.moveTo(player.x, player.y - 25)
                ctx.lineTo(player.x - playerWidth, player.y + 15)
                ctx.lineTo(player.x, player.y + 5)
                ctx.lineTo(player.x + playerWidth, player.y + 15)
                ctx.closePath()
                ctx.fill()
                
                // Player glow
                ctx.shadowBlur = 15
                ctx.shadowColor = '#00FFFF'
                ctx.fill()
                ctx.shadowBlur = 0

                // Draw magic defence shield (circular, fading as time runs out)
                if (magicDefenceActive && magicDefenceEndTime) {
                    const timeRemaining = (magicDefenceEndTime - Date.now()) / 1000
                    const maxTime = POWERUP_DURATION_SECONDS
                    const opacity = Math.max(0.3, timeRemaining / maxTime) // Fade from 1.0 to 0.3
                    
                    ctx.save()
                    ctx.globalAlpha = opacity
                    ctx.strokeStyle = '#800080'
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    ctx.arc(player.x, player.y, 30, 0, Math.PI * 2)
                    ctx.stroke()
                    
                    // Shield glow
                    ctx.shadowBlur = 20
                    ctx.shadowColor = '#800080'
                    ctx.stroke()
                    ctx.shadowBlur = 0
                    ctx.restore()
                }

                // Draw bullets
                ctx.fillStyle = '#FFFF00'
                bulletsRef.current.forEach(bullet => {
                    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
                })

                // Draw homing missiles
                ctx.fillStyle = '#FF6600'
                ctx.strokeStyle = '#FFA500'
                ctx.lineWidth = 1.5
                homingMissilesRef.current.forEach(missile => {
                    ctx.save()
                    const centerX = missile.x + missile.width / 2
                    const centerY = missile.y + missile.height / 2
                    
                    // Missile body (pointed shape)
                    ctx.beginPath()
                    ctx.moveTo(centerX, centerY - missile.height / 2) // Top point
                    ctx.lineTo(centerX - missile.width / 2, centerY + missile.height / 2) // Bottom left
                    ctx.lineTo(centerX, centerY + missile.height / 2 - 2) // Bottom center
                    ctx.lineTo(centerX + missile.width / 2, centerY + missile.height / 2) // Bottom right
                    ctx.closePath()
                    ctx.fill()
                    ctx.stroke()
                    
                    // Glow effect
                    ctx.shadowBlur = 8
                    ctx.shadowColor = '#FF6600'
                    ctx.fill()
                    ctx.shadowBlur = 0
                    
                    ctx.restore()
                })

                // Draw enemy bullets
                ctx.fillStyle = '#FF4444'
                enemyBulletsRef.current.forEach(bullet => {
                    ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
                })

                // Draw enemies
                enemiesRef.current.forEach(enemy => {
                    const enemyRadiusX = isMobile ? enemy.width : enemy.width / 2
                    const enemyRadiusY = enemy.width / 2
                    const centerX = enemy.x + enemy.width / 2
                    const centerY = enemy.y + enemy.height / 2
                    
                    // Enemy details or skull for mega enemies
                    if (enemy.isMega) {
                        // Skull ships: black body with red halo effect
                        ctx.save()
                        
                        // Red halo/glow effect (drawn first, behind the body)
                        ctx.shadowBlur = 20
                        ctx.shadowColor = '#FF0000'
                        ctx.fillStyle = '#000000'
                        ctx.beginPath()
                        if (isMobile) {
                            ctx.ellipse(centerX, centerY, enemyRadiusX, enemyRadiusY, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(centerX, centerY, enemyRadiusX, 0, Math.PI * 2)
                        }
                        ctx.fill()
                        
                        // Main body: very dark/black
                        ctx.shadowBlur = 0
                        ctx.fillStyle = '#1A0000' // Very dark red-black
                        ctx.beginPath()
                        if (isMobile) {
                            ctx.ellipse(centerX, centerY, enemyRadiusX, enemyRadiusY, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(centerX, centerY, enemyRadiusX, 0, Math.PI * 2)
                        }
                        ctx.fill()
                        
                        ctx.restore()
                        
                        // Draw skull symbol (darker, more visible against black)
                        ctx.fillStyle = '#666666' // Gray skull for visibility
                        ctx.strokeStyle = '#000000'
                        ctx.lineWidth = 2
                        
                        const sizeX = enemyRadiusX
                        const sizeY = enemyRadiusY
                        
                        // Skull shape (simplified 80's style)
                        ctx.beginPath()
                        // Head (ellipse on mobile, circle on desktop)
                        if (isMobile) {
                            ctx.ellipse(centerX, centerY - sizeY * 0.2, sizeX * 0.7, sizeY * 0.7, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(centerX, centerY - sizeY * 0.2, sizeY * 0.7, 0, Math.PI * 2)
                        }
                        ctx.fill()
                        ctx.stroke()
                        
                        // Eye sockets (red glow)
                        ctx.fillStyle = '#FF0000'
                        ctx.shadowBlur = 8
                        ctx.shadowColor = '#FF0000'
                        ctx.beginPath()
                        ctx.arc(centerX - sizeX * 0.25, centerY - sizeY * 0.3, sizeY * 0.15, 0, Math.PI * 2)
                        ctx.arc(centerX + sizeX * 0.25, centerY - sizeY * 0.3, sizeY * 0.15, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.shadowBlur = 0
                        
                        // Jaw/teeth (gray with red accent)
                        ctx.fillStyle = '#888888'
                        ctx.strokeStyle = '#000000'
                        ctx.beginPath()
                        ctx.moveTo(centerX - sizeX * 0.4, centerY + sizeY * 0.1)
                        ctx.lineTo(centerX, centerY + sizeY * 0.6)
                        ctx.lineTo(centerX + sizeX * 0.4, centerY + sizeY * 0.1)
                        ctx.closePath()
                        ctx.fill()
                        ctx.stroke()
                        
                        ctx.lineWidth = 1
                    } else {
                        // Regular enemy ships: yellow, red, and black combination
                        ctx.save()
                        
                        // Outer glow: red-orange
                        ctx.shadowBlur = 12
                        ctx.shadowColor = '#FF4400'
                        ctx.fillStyle = '#8B0000' // Dark red base
                        ctx.beginPath()
                        if (isMobile) {
                            ctx.ellipse(centerX, centerY, enemyRadiusX, enemyRadiusY, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(centerX, centerY, enemyRadiusX, 0, Math.PI * 2)
                        }
                        ctx.fill()
                        
                        // Main body: dark red with black accents
                        ctx.shadowBlur = 0
                        ctx.fillStyle = '#CC0000' // Red
                        ctx.beginPath()
                        if (isMobile) {
                            ctx.ellipse(centerX, centerY, enemyRadiusX * 0.85, enemyRadiusY * 0.85, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(centerX, centerY, enemyRadiusX * 0.85, 0, Math.PI * 2)
                        }
                        ctx.fill()
                        
                        ctx.restore()
                        
                        // Center detail: yellow accent
                        ctx.fillStyle = '#FFAA00' // Yellow-orange
                        const detailRadiusX = isMobile ? enemy.width / 3 : enemy.width / 5
                        const detailRadiusY = enemy.width / 5
                        ctx.beginPath()
                        if (isMobile) {
                            ctx.ellipse(centerX, centerY, detailRadiusX, detailRadiusY, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(centerX, centerY, detailRadiusY, 0, Math.PI * 2)
                        }
                        ctx.fill()
                    }
                })

                // Draw boss (Giant Space Spider)
                // Don't draw boss if explosion has started (boss was defeated)
                if (bossRef.current && !bossExplosionStartTime) {
                    const boss = bossRef.current
                    const BOSS_SIZE = 120
                    const centerX = boss.x + BOSS_SIZE / 2
                    const centerY = boss.y + BOSS_SIZE / 2
                    const radius = BOSS_SIZE / 2
                    
                    ctx.save()
                    
                    // Boss color changes based on health: normal color to blood-red
                    // health 40 = normal (#1A1A1A), health 0 = blood-red (#8B0000)
                    const MAX_BOSS_HEALTH = 40
                    const healthRatio = Math.max(0, boss.health / MAX_BOSS_HEALTH) // 1.0 (full) to 0.0 (dead)
                    
                    // Interpolate between normal color (RGB: 26, 26, 26) and blood-red (RGB: 139, 0, 0)
                    const normalR = 26, normalG = 26, normalB = 26
                    const redR = 139, redG = 0, redB = 0
                    const r = Math.round(normalR + (redR - normalR) * (1 - healthRatio))
                    const g = Math.round(normalG + (redG - normalG) * (1 - healthRatio))
                    const b = Math.round(normalB + (redB - normalB) * (1 - healthRatio))
                    
                    // Convert to hex color
                    const bossColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                    const bossOutlineColor = `#${Math.max(0, r - 10).toString(16).padStart(2, '0')}${Math.max(0, g - 10).toString(16).padStart(2, '0')}${Math.max(0, b - 10).toString(16).padStart(2, '0')}`
                    const bossLegColor = `#${Math.min(255, r + 5).toString(16).padStart(2, '0')}${Math.min(255, g + 5).toString(16).padStart(2, '0')}${Math.min(255, b + 5).toString(16).padStart(2, '0')}`
                    
                    // Boss body: color changes from dark gray to blood-red based on health
                    ctx.fillStyle = bossColor
                    ctx.strokeStyle = bossOutlineColor
                    ctx.lineWidth = 2
                    
                    // Main body (spider abdomen)
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(centerX, centerY, radius * 0.9, radius * 0.75, 0, 0, Math.PI * 2)
                    } else {
                        ctx.ellipse(centerX, centerY, radius * 0.9, radius * 0.75, 0, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    ctx.stroke()
                    
                    // Spider head (smaller circle at front)
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(centerX - radius * 0.3, centerY, radius * 0.4, radius * 0.35, 0, 0, Math.PI * 2)
                    } else {
                        ctx.ellipse(centerX - radius * 0.3, centerY, radius * 0.4, radius * 0.35, 0, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    ctx.stroke()
                    
                    // Spider legs (8 legs total - 4 on each side)
                    ctx.strokeStyle = bossLegColor
                    ctx.lineWidth = 3
                    ctx.beginPath()
                    
                    // Top legs (left side)
                    ctx.moveTo(centerX - radius * 0.4, centerY - radius * 0.3)
                    ctx.lineTo(centerX - radius * 1.2, centerY - radius * 0.8)
                    ctx.moveTo(centerX - radius * 0.3, centerY - radius * 0.5)
                    ctx.lineTo(centerX - radius * 1.1, centerY - radius * 1.0)
                    
                    // Top legs (right side)
                    ctx.moveTo(centerX + radius * 0.4, centerY - radius * 0.3)
                    ctx.lineTo(centerX + radius * 1.2, centerY - radius * 0.8)
                    ctx.moveTo(centerX + radius * 0.3, centerY - radius * 0.5)
                    ctx.lineTo(centerX + radius * 1.1, centerY - radius * 1.0)
                    
                    // Bottom legs (left side)
                    ctx.moveTo(centerX - radius * 0.4, centerY + radius * 0.3)
                    ctx.lineTo(centerX - radius * 1.2, centerY + radius * 0.8)
                    ctx.moveTo(centerX - radius * 0.3, centerY + radius * 0.5)
                    ctx.lineTo(centerX - radius * 1.1, centerY + radius * 1.0)
                    
                    // Bottom legs (right side)
                    ctx.moveTo(centerX + radius * 0.4, centerY + radius * 0.3)
                    ctx.lineTo(centerX + radius * 1.2, centerY + radius * 0.8)
                    ctx.moveTo(centerX + radius * 0.3, centerY + radius * 0.5)
                    ctx.lineTo(centerX + radius * 1.1, centerY + radius * 1.0)
                    
                    ctx.stroke()
                    
                    // Eyes (tiny dark red glows - barely visible)
                    ctx.fillStyle = '#1A0000' // Very dark red
                    ctx.shadowBlur = 3
                    ctx.shadowColor = '#1A0000'
                    ctx.beginPath()
                    ctx.arc(centerX - radius * 0.4, centerY - radius * 0.1, radius * 0.08, 0, Math.PI * 2)
                    ctx.arc(centerX - radius * 0.2, centerY - radius * 0.05, radius * 0.08, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.shadowBlur = 0
                    
                    ctx.restore()
                }

                // Draw life powerups
                lifePowerupsRef.current.forEach(powerup => {
                    // Blue circle (ellipse on mobile - width doubled, height same)
                    ctx.fillStyle = '#0088FF'
                    const powerupRadiusX = isMobile ? powerup.size * 2 : powerup.size
                    const powerupRadiusY = powerup.size
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Powerup glow
                    ctx.shadowBlur = 15
                    ctx.shadowColor = '#0088FF'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // "+1" text
                    ctx.fillStyle = '#FFFFFF'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.fillText('+1', powerup.x, powerup.y)
                    ctx.textAlign = 'left'
                    ctx.textBaseline = 'alphabetic'
                })

                // Draw 3X score bonus powerups
                scoreBonusPowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    const powerupRadiusX = isMobile ? powerup.size * 2 : powerup.size
                    const powerupRadiusY = powerup.size
                    
                    // Outer glow for shiny effect
                    ctx.shadowBlur = 20
                    ctx.shadowColor = '#00FF00'
                    ctx.fillStyle = '#32CD32'
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Bright shiny green gradient circle
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerupRadiusX * 0.3, 
                        powerup.y - powerupRadiusY * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerupRadiusX
                    )
                    gradient.addColorStop(0, '#ADFF2F') // Bright yellow-green
                    gradient.addColorStop(0.5, '#32CD32') // Lime green
                    gradient.addColorStop(1, '#228B22') // Forest green
                    ctx.fillStyle = gradient
                    ctx.shadowBlur = 0
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Additional inner glow for shine
                    ctx.shadowBlur = 8
                    ctx.shadowColor = '#ADFF2F'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // "3X" text
                    ctx.fillStyle = '#FFFFFF'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.fillText('3X', powerup.x, powerup.y)
                    ctx.textAlign = 'left'
                    ctx.textBaseline = 'alphabetic'
                    
                    ctx.restore()
                })

                // Draw magic defence powerups
                magicDefencePowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    const powerupRadiusX = isMobile ? powerup.size * 2 : powerup.size
                    const powerupRadiusY = powerup.size
                    
                    // Aura effect - multiple glowing layers
                    const auraColors = [
                        { color: '#9370DB', opacity: 0.4, blur: 25, radiusX: powerupRadiusX * 1.4, radiusY: powerupRadiusY * 1.4 },
                        { color: '#8A2BE2', opacity: 0.3, blur: 20, radiusX: powerupRadiusX * 1.2, radiusY: powerupRadiusY * 1.2 },
                        { color: '#6A0DAD', opacity: 0.2, blur: 15, radiusX: powerupRadiusX * 1.0, radiusY: powerupRadiusY * 1.0 }
                    ]
                    
                    auraColors.forEach(aura => {
                        ctx.globalAlpha = aura.opacity
                        ctx.shadowBlur = aura.blur
                        ctx.shadowColor = aura.color
                        ctx.fillStyle = aura.color
                        ctx.beginPath()
                        if (isMobile) {
                            ctx.ellipse(powerup.x, powerup.y, aura.radiusX, aura.radiusY, 0, 0, Math.PI * 2)
                        } else {
                            ctx.arc(powerup.x, powerup.y, aura.radiusY, 0, Math.PI * 2)
                        }
                        ctx.fill()
                    })
                    
                    ctx.shadowBlur = 0
                    ctx.globalAlpha = 1.0
                    
                    // Base circle with purple-blue gradient effect
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerupRadiusX * 0.3, 
                        powerup.y - powerupRadiusY * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerupRadiusX
                    )
                    gradient.addColorStop(0, '#9370DB')
                    gradient.addColorStop(0.5, '#8A2BE2')
                    gradient.addColorStop(1, '#4B0082')
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Inner glow
                    ctx.shadowBlur = 10
                    ctx.shadowColor = '#9370DB'
                    ctx.fill()
                    ctx.shadowBlur = 0
                    
                    ctx.restore()
                })

                // Draw super weapon powerups
                superWeaponPowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    const powerupRadiusX = isMobile ? powerup.size * 2 : powerup.size
                    const powerupRadiusY = powerup.size
                    
                    // Bright turquoise circle with glow
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerupRadiusX * 0.3, 
                        powerup.y - powerupRadiusY * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerupRadiusX
                    )
                    gradient.addColorStop(0, '#40E0D0') // Bright turquoise
                    gradient.addColorStop(0.5, '#00CED1') // Dark turquoise
                    gradient.addColorStop(1, '#008B8B') // Dark cyan
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Outer glow
                    ctx.shadowBlur = 20
                    ctx.shadowColor = '#40E0D0'
                    ctx.fill()
                    ctx.shadowBlur = 0

                    // Weapon symbol (crosshair/target style)
                    ctx.fillStyle = '#FFFFFF'
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    
                    const centerX = powerup.x
                    const centerY = powerup.y
                    const symbolSize = powerupRadiusX * 0.5
                    
                    // Crosshair lines
                    ctx.beginPath()
                    // Horizontal line
                    ctx.moveTo(centerX - symbolSize, centerY)
                    ctx.lineTo(centerX + symbolSize, centerY)
                    // Vertical line
                    ctx.moveTo(centerX, centerY - symbolSize)
                    ctx.lineTo(centerX, centerY + symbolSize)
                    ctx.stroke()
                    
                    // Center circle
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, symbolSize * 0.3, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.stroke()
                    
                    // Outer circle
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, symbolSize * 0.7, 0, Math.PI * 2)
                    ctx.stroke()
                    
                    ctx.restore()
                })

                // Draw clock extender powerups
                clockExtenderPowerupsRef.current.forEach(powerup => {
                    ctx.save()
                    
                    const powerupRadiusX = isMobile ? powerup.size * 2 : powerup.size
                    const powerupRadiusY = powerup.size
                    
                    // Clock face circle (light gray/white)
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerupRadiusX * 0.3, 
                        powerup.y - powerupRadiusY * 0.3, 
                        0,
                        powerup.x, 
                        powerup.y, 
                        powerupRadiusX
                    )
                    gradient.addColorStop(0, '#F0F0F0')
                    gradient.addColorStop(0.5, '#E0E0E0')
                    gradient.addColorStop(1, '#C0C0C0')
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Outer border
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    ctx.stroke()
                    
                    // Clock hands (hour and minute)
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    ctx.lineCap = 'round'
                    
                    const centerX = powerup.x
                    const centerY = powerup.y
                    const clockRadius = powerupRadiusX * 0.8
                    
                    // Hour hand (pointing to 3 o'clock)
                    ctx.beginPath()
                    ctx.moveTo(centerX, centerY)
                    ctx.lineTo(centerX + clockRadius * 0.4, centerY)
                    ctx.stroke()
                    
                    // Minute hand (pointing to 12 o'clock)
                    ctx.beginPath()
                    ctx.moveTo(centerX, centerY)
                    ctx.lineTo(centerX, centerY - clockRadius * 0.6)
                    ctx.stroke()
                    
                    // Center dot
                    ctx.fillStyle = '#000000'
                    ctx.beginPath()
                    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2)
                    ctx.fill()
                    
                    // Clock numbers (12, 3, 6, 9 positions as dots)
                    ctx.fillStyle = '#000000'
                    const dotSize = 2
                    // 12 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX, centerY - clockRadius * 0.75, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    // 3 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX + clockRadius * 0.75, centerY, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    // 6 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX, centerY + clockRadius * 0.75, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    // 9 o'clock
                    ctx.beginPath()
                    ctx.arc(centerX - clockRadius * 0.75, centerY, dotSize, 0, Math.PI * 2)
                    ctx.fill()
                    
                    ctx.restore()
                })

                // Draw bonus texts
                bonusTextsRef.current.forEach(bonus => {
                    ctx.save()
                    ctx.globalAlpha = bonus.opacity
                    ctx.fillStyle = '#00FF00' // Green
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.fillText(`Bonus ${bonus.text}`, bonus.x, bonus.y)
                    ctx.restore()
                })
            }

            // Update and draw enemy explosions
            enemyExplosionsRef.current = enemyExplosionsRef.current
                .map(explosion => {
                    // Update particles for this explosion
                    const updatedParticles = explosion.particles
                        .map(particle => ({
                            ...particle,
                            x: particle.x + particle.vx * deltaTime,
                            y: particle.y + particle.vy * deltaTime,
                            vy: particle.vy + 0.1 * deltaTime, // slight gravity
                            life: particle.life - particle.decay
                        }))
                        .filter(particle => particle.life > 0)
                    
                    // Return explosion if it still has particles, otherwise null (will be filtered out)
                    return updatedParticles.length > 0 ? { ...explosion, particles: updatedParticles } : null
                })
                .filter(explosion => explosion !== null)

            // Draw enemy explosions (in logical coordinates, before context restore)
            enemyExplosionsRef.current.forEach(explosion => {
                explosion.particles.forEach(particle => {
                    ctx.save()
                    ctx.globalAlpha = particle.life
                    ctx.fillStyle = particle.color
                    ctx.shadowBlur = 8
                    ctx.shadowColor = particle.color
                    ctx.beginPath()
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.shadowBlur = 0
                    ctx.restore()
                })
            })

            // Update and draw powerup explosions
            powerupExplosionsRef.current = powerupExplosionsRef.current
                .map(explosion => {
                    // Update particles for this explosion
                    const updatedParticles = explosion.particles
                        .map(particle => ({
                            ...particle,
                            x: particle.x + particle.vx * deltaTime,
                            y: particle.y + particle.vy * deltaTime,
                            vy: particle.vy + 0.08 * deltaTime, // slight gravity
                            life: particle.life - particle.decay
                        }))
                        .filter(particle => particle.life > 0)
                    
                    // Return explosion if it still has particles, otherwise null (will be filtered out)
                    return updatedParticles.length > 0 ? { ...explosion, particles: updatedParticles } : null
                })
                .filter(explosion => explosion !== null)

            // Draw powerup explosions (in logical coordinates, before context restore)
            powerupExplosionsRef.current.forEach(explosion => {
                explosion.particles.forEach(particle => {
                    ctx.save()
                    ctx.globalAlpha = particle.life
                    ctx.fillStyle = particle.color
                    ctx.shadowBlur = 6
                    ctx.shadowColor = particle.color
                    ctx.beginPath()
                    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                    ctx.fill()
                    ctx.shadowBlur = 0
                    ctx.restore()
                })
            })

            // Update and draw boss explosion
            if (bossExplosionStartTime) {
                const explosionTime = (Date.now() - bossExplosionStartTime) / 1000 // seconds

                // Update explosion particles
                bossExplosionRef.current = bossExplosionRef.current
                    .map(particle => ({
                        ...particle,
                        x: particle.x + particle.vx,
                        y: particle.y + particle.vy,
                        vy: particle.vy + 0.05, // slight gravity
                        life: particle.life - particle.decay
                    }))
                    .filter(particle => particle.life > 0)

                // Draw explosion particles (in logical coordinates, before context restore)
                if (bossExplosionRef.current.length > 0) {
                    bossExplosionRef.current.forEach(particle => {
                        ctx.save()
                        ctx.globalAlpha = particle.life
                        ctx.fillStyle = particle.color
                        ctx.shadowBlur = 15
                        ctx.shadowColor = particle.color
                        ctx.beginPath()
                        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.shadowBlur = 0
                        ctx.restore()
                    })
                }
                
                // After 3 seconds, trigger victory
                if (explosionTime >= 3.0) {
                    setBossExplosionStartTime(null)
                    victory()
                }
            }

            // Update and draw fireworks (even during celebration) - before context restore
            if (isCelebrating) {
                fireworksRef.current = fireworksRef.current
                    .map(particle => ({
                        ...particle,
                        x: particle.x + particle.vx,
                        y: particle.y + particle.vy,
                        vy: particle.vy + 0.1, // gravity
                        life: particle.life - particle.decay
                    }))
                    .filter(particle => particle.life > 0)
                
                // Draw fireworks (in logical coordinates, before context restore)
                if (fireworksRef.current.length > 0) {
                    fireworksRef.current.forEach(particle => {
                        ctx.save()
                        ctx.globalAlpha = particle.life
                        ctx.fillStyle = particle.color
                        ctx.shadowBlur = 10
                        ctx.shadowColor = particle.color
                        ctx.beginPath()
                        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                        ctx.fill()
                        ctx.shadowBlur = 0
                        ctx.restore()
                    })
                }
            }

            // Restore context if we scaled it (mobile) - before drawing UI
            if (isMobile) {
                ctx.restore()
            }

            // Draw celebration overlay (HIGH SCORE!) - dimmed background so game remains visible
            if (isCelebrating) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.16)' // 60% more transparent (was 0.4)
                ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                
                ctx.fillStyle = '#FFFF00'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                    ctx.fillText('HIGH SCORE!', canvas.width / 2, (CANVAS_HEIGHT / 2 - 60) * scaleY)
                    ctx.font = `bold ${32 * fontScale}px "Courier New", monospace`
                    ctx.fillText(`${gameStateRef.current.score}`, canvas.width / 2, (CANVAS_HEIGHT / 2 + 20) * scaleY)
                } else {
                    ctx.font = 'bold 48px "Courier New", monospace'
                    ctx.fillText('HIGH SCORE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60)
                    ctx.font = 'bold 32px "Courier New", monospace'
                    ctx.fillText(`${gameStateRef.current.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
                }
                ctx.textAlign = 'left'
                ctx.textBaseline = 'alphabetic'
            }

            // Draw countdown overlay
            if (countdown > 0 && gameStateRef.current.gameState === 'playing') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.32)' // 60% more transparent (was 0.8)
                ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                
                ctx.fillStyle = '#00FFFF'
                ctx.textAlign = 'center'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${72 * fontScale}px "Courier New", monospace`
                    ctx.fillText(countdown.toString(), canvas.width / 2, (CANVAS_HEIGHT / 2) * scaleY)
                } else {
                    ctx.font = 'bold 72px "Courier New", monospace'
                    ctx.fillText(countdown.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
                }
                ctx.textAlign = 'left'
            }

            // Draw death countdown overlay
            if (deathCountdown > 0 && gameStateRef.current.gameState === 'playing') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.32)' // 60% more transparent (was 0.8)
                ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                
                ctx.textAlign = 'center'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    
                    // Draw lives remaining text above countdown
                    ctx.fillStyle = '#FF0088'
                    ctx.font = `bold ${18 * fontScale}px "Courier New", monospace`
                    const livesText = gameStateRef.current.lives === 1 
                        ? `You have 1 more life` 
                        : `You have ${gameStateRef.current.lives} more lives`
                    ctx.fillText(livesText, canvas.width / 2, (CANVAS_HEIGHT / 2 - 100) * scaleY)
                    
                    // Draw countdown number
                    ctx.font = `bold ${72 * fontScale}px "Courier New", monospace`
                    ctx.fillText(deathCountdown.toString(), canvas.width / 2, (CANVAS_HEIGHT / 2) * scaleY)
                } else {
                    // Draw lives remaining text above countdown
                    ctx.fillStyle = '#FF0088'
                    ctx.font = 'bold 18px "Courier New", monospace'
                    const livesText = gameStateRef.current.lives === 1 
                        ? `You have 1 more life` 
                        : `You have ${gameStateRef.current.lives} more lives`
                    ctx.fillText(livesText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 100)
                    
                    // Draw countdown number
                    ctx.font = 'bold 72px "Courier New", monospace'
                    ctx.fillText(deathCountdown.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
                }
                ctx.textAlign = 'left'
            }

            // Draw level announcement overlay with fade-out
            if (levelAnnouncementStartTimeRef.current && gameStateRef.current.gameState === 'playing' && countdown === 0 && deathCountdown === 0) {
                const announcementAge = (Date.now() - levelAnnouncementStartTimeRef.current) / 1000 // seconds
                const fadeDuration = 0.5 // fade out over 0.5 seconds
                const showDuration = 1.5 // show fully for 1.5 seconds
                const totalDuration = showDuration + fadeDuration // 2 seconds total
                
                if (announcementAge < totalDuration) {
                    // Calculate opacity: 1.0 for first 1.5s, then fade to 0 over 0.5s
                    let opacity = 1.0
                    if (announcementAge > showDuration) {
                        opacity = 1.0 - ((announcementAge - showDuration) / fadeDuration)
                    }
                    
                    ctx.fillStyle = `rgba(0, 0, 0, ${0.32 * opacity})` // 60% more transparent (was 0.8)
                    ctx.fillRect(0, 0, isMobile ? canvas.width : CANVAS_WIDTH, isMobile ? canvas.height : CANVAS_HEIGHT)
                    
                    ctx.fillStyle = `rgba(0, 255, 255, ${opacity})`
                    ctx.textAlign = 'center'
                    if (isMobile) {
                        const scaleX = canvas.width / CANVAS_WIDTH
                        const scaleY = canvas.height / CANVAS_HEIGHT
                        const fontScale = scaleX
                        ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                        ctx.fillText(`LEVEL ${level}`, canvas.width / 2, (CANVAS_HEIGHT / 2 - 40) * scaleY)
                        ctx.font = `${24 * fontScale}px "Courier New", monospace`
                        ctx.fillText('BEGIN!', canvas.width / 2, (CANVAS_HEIGHT / 2 + 40) * scaleY)
                    } else {
                        ctx.font = 'bold 48px "Courier New", monospace'
                        ctx.fillText(`LEVEL ${level}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
                        ctx.font = '24px "Courier New", monospace'
                        ctx.fillText('BEGIN!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
                    }
                    ctx.textAlign = 'left'
                } else {
                    // Clear the ref after fade completes
                    levelAnnouncementStartTimeRef.current = null
                }
            }

            // Draw UI in actual canvas coordinates
            ctx.fillStyle = '#00FFFF'
            if (isMobile) {
                // On mobile, use viewport-relative positioning
                // Canvas resolution matches viewport, so use reasonable fixed values
                const fontSize = Math.max(14, canvas.width / 25) * 0.8 // Scale font with viewport width, 80% for mobile
                ctx.font = `${fontSize}px "Courier New", monospace`
                const x = 10
                const y1 = fontSize + 5
                const y2 = fontSize * 2 + 10
                const y3 = fontSize * 3 + 15
                const y4 = fontSize * 4 + 20
                ctx.fillText(`Score: ${gameStateRef.current.score}`, x, y1)
                ctx.fillText(`High Score: ${highScore}`, x, y2)
                ctx.fillText(`Level: ${level}`, x, y3)
                ctx.fillText(`Lives: ${gameStateRef.current.lives}`, x, y4)
                
                // Draw 3X multiplier indicator with countdown
                if (scoreMultiplierEndTime) {
                    const timeRemaining = Math.max(0, Math.ceil((scoreMultiplierEndTime - Date.now()) / 1000))
                    if (timeRemaining > 0) {
                        ctx.fillStyle = '#FFFF00'
                        ctx.fillText(`3X Score: ${timeRemaining}s`, x, y4 + fontSize + 5)
                    }
                }
            } else {
                ctx.font = '20px "Courier New", monospace'
                ctx.fillText(`Score: ${gameStateRef.current.score}`, 20, 30)
                ctx.fillText(`High Score: ${highScore}`, 20, 60)
                ctx.fillText(`Level: ${level}`, 20, 90)
                ctx.fillText(`Lives: ${gameStateRef.current.lives}`, 20, 120)
                
                // Draw 3X multiplier indicator with countdown
                if (scoreMultiplierEndTime) {
                    const timeRemaining = Math.max(0, Math.ceil((scoreMultiplierEndTime - Date.now()) / 1000))
                    if (timeRemaining > 0) {
                        ctx.fillStyle = '#FFFF00'
                        ctx.fillText(`3X Score: ${timeRemaining}s`, 20, 150)
                    }
                }
            }

            if (gameStateRef.current.gameState === 'menu') {
                ctx.fillStyle = '#00FFFF'
                if (isMobile) {
                    const scaleX = canvas.width / CANVAS_WIDTH
                    const scaleY = canvas.height / CANVAS_HEIGHT
                    const fontScale = scaleX
                    ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                    ctx.textAlign = 'center'
                    ctx.fillText('HOSTILE SPACE', canvas.width / 2, (CANVAS_HEIGHT / 2 - 80) * scaleY)
                    
                    // Music credit below title (half font size, lighter navy blue)
                    ctx.font = `${26 * fontScale}px "Courier New", monospace`
                    ctx.fillStyle = '#4169E1' // Lighter navy blue (royal blue)
                    ctx.fillText('Music by neuronoizer', canvas.width / 2, (CANVAS_HEIGHT / 2 - 80 + 30) * scaleY)
                    
                    ctx.font = `${24 * fontScale}px "Courier New", monospace`
                    ctx.fillStyle = '#FFFFFF' // Reset to white
                    ctx.fillText('TOUCH TO START', canvas.width / 2, (CANVAS_HEIGHT / 2 + 20) * scaleY)
                    
                    ctx.font = `${14 * fontScale}px "Courier New", monospace`
                    ctx.fillText('Touch ship to move & shoot | Touch elsewhere to move only', canvas.width / 2, canvas.height - 30 * scaleY)
                    
                    ctx.textAlign = 'left'
                } else {
                    ctx.font = 'bold 48px "Courier New", monospace'
                    ctx.textAlign = 'center'
                    ctx.fillText('HOSTILE SPACE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80)
                    
                    // Music credit below title (half font size, lighter navy blue)
                    ctx.font = '26px "Courier New", monospace'
                    ctx.fillStyle = '#4169E1' // Lighter navy blue (royal blue)
                    ctx.fillText('Music by neuronoizer', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80 + 30)
                    
                    ctx.font = '24px "Courier New", monospace'
                    ctx.fillStyle = '#FFFFFF' // Reset to white
                    ctx.fillText('PRESS SPACE TO START', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20)
                    
                    ctx.font = '16px "Courier New", monospace'
                    ctx.fillText('Arrow Keys / WASD: Move', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80)
                    ctx.fillText('Space: Shoot', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 110)
                    
                    ctx.textAlign = 'left'
                }
            }

            if (gameStateRef.current.gameState === 'gameover') {
                if (isVictory) {
                    // Victory message
                    ctx.fillStyle = '#00FF00'
                    if (isMobile) {
                        const scaleX = canvas.width / CANVAS_WIDTH
                        const scaleY = canvas.height / CANVAS_HEIGHT
                        const fontScale = scaleX
                        ctx.font = `bold ${64 * fontScale}px "Courier New", monospace`
                        ctx.textAlign = 'center'
                        ctx.fillText('YOU WON!', canvas.width / 2, (CANVAS_HEIGHT / 2 - 60) * scaleY)
                        
                        ctx.fillStyle = '#FFFF00'
                        ctx.font = `${32 * fontScale}px "Courier New", monospace`
                        ctx.fillText(`Final Score: ${gameStateRef.current.score}`, canvas.width / 2, (CANVAS_HEIGHT / 2 + 40) * scaleY)
                        if (!gameOverWait) {
                            ctx.fillText('TOUCH TO RESTART', canvas.width / 2, (CANVAS_HEIGHT / 2 + 100) * scaleY)
                        }
                        
                        ctx.textAlign = 'left'
                    } else {
                        ctx.font = 'bold 64px "Courier New", monospace'
                        ctx.textAlign = 'center'
                        ctx.fillText('YOU WON!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60)
                        
                        ctx.fillStyle = '#FFFF00'
                        ctx.font = '32px "Courier New", monospace'
                        ctx.fillText(`Final Score: ${gameStateRef.current.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
                        if (!gameOverWait) {
                            ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100)
                        }
                        
                        ctx.textAlign = 'left'
                    }
                } else {
                    // Regular game over
                    ctx.fillStyle = '#FF0088'
                    if (isMobile) {
                        const scaleX = canvas.width / CANVAS_WIDTH
                        const scaleY = canvas.height / CANVAS_HEIGHT
                        const fontScale = scaleX
                        ctx.font = `bold ${48 * fontScale}px "Courier New", monospace`
                        ctx.textAlign = 'center'
                        ctx.fillText('GAME OVER', canvas.width / 2, (CANVAS_HEIGHT / 2 - 40) * scaleY)
                        
                        ctx.fillStyle = '#00FFFF'
                        ctx.font = `${24 * fontScale}px "Courier New", monospace`
                        ctx.fillText(`Final Score: ${gameStateRef.current.score}`, canvas.width / 2, (CANVAS_HEIGHT / 2 + 40) * scaleY)
                        ctx.fillText('TOUCH TO RESTART', canvas.width / 2, (CANVAS_HEIGHT / 2 + 100) * scaleY)
                        
                        ctx.textAlign = 'left'
                    } else {
                        ctx.font = 'bold 48px "Courier New", monospace'
                        ctx.textAlign = 'center'
                        ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)
                        
                        ctx.fillStyle = '#00FFFF'
                        ctx.font = '24px "Courier New", monospace'
                        ctx.fillText(`Final Score: ${gameStateRef.current.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)
                        ctx.fillText('PRESS SPACE TO RESTART', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100)
                        
                        ctx.textAlign = 'left'
                    }
                }
            }

            animationFrameRef.current = requestAnimationFrame(gameLoop)
        }

        animationFrameRef.current = requestAnimationFrame(gameLoop)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [gameState, highScore, gameOver, victory, startGame, isMobile, level, getEnemySpeed, getEnemySpawnRate, getEnemyHorizontalSpeed, getMegaEnemySpawnChance, getMegaEnemyFireRate, countdown, deathCountdown, isCelebrating, isVictory, gameOverWait, createFireworks, createBossExplosion, createEnemyExplosion, createMegaEnemyExplosion, createPowerupExplosion, bossExplosionStartTime, scoreMultiplier, scoreMultiplierEndTime, magicDefenceActive, magicDefenceEndTime, superWeaponActive, superWeaponEndTime])

    // Show landscape orientation warning for mobile devices (but not in test environment)
    // Detect test environment: import.meta.vitest is available in Vitest, or process.env.NODE_ENV === 'test'
    const isTestEnv = (typeof import.meta !== 'undefined' && typeof import.meta.vitest !== 'undefined') || 
                      (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test')
    if (isLandscapeMobile && !isTestEnv) {
        return (
            <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="text-neon-cyan text-4xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-mono font-bold text-neon-cyan mb-4">Landscape Mode Not Supported</h2>
                    <p className="text-white font-mono mb-4">
                        This game is designed for portrait orientation on mobile devices. Please rotate your device to portrait mode to play.
                    </p>
                    <button
                        onClick={handleBackToHome}
                        className="text-neon-cyan font-mono hover:text-white transition-colors text-lg bg-black/70 px-4 py-2 rounded border border-neon-cyan/50"
                    >
                        ← neuronoiser.com
                    </button>
                </div>
            </div>
        )
    }

    if (isMobile) {
        // Mobile: Full screen canvas
        return (
            <div className="fixed inset-0 w-screen h-screen bg-black" style={{ touchAction: 'none', overflow: 'hidden' }}>
                {/* Back button for mobile */}
                <button
                    onClick={handleBackToHome}
                    className="absolute top-2 right-4 z-20 text-neon-cyan hover:text-white transition-colors p-2"
                    aria-label="Back to home"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </button>

                {/* Share button for mobile (only show if Web Share API is supported) */}
                {navigator.share && (
                    <button
                        onClick={handleShare}
                        className="absolute top-[44px] right-4 z-20 text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label="Share game"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                    </button>
                )}

                {/* Help button for mobile */}
                <button
                    onClick={() => setShowHelpDialog(true)}
                    className="absolute top-[80px] right-4 z-20 text-neon-cyan hover:text-white transition-colors p-2"
                    aria-label="Show help"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </button>
                
                {/* Sound toggle button for mobile */}
                <button
                    onClick={toggleSound}
                    className="absolute top-[116px] right-4 z-20 text-neon-cyan hover:text-white transition-colors p-2"
                    aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                >
                    {soundEnabled ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    )}
                </button>

                {/* Music toggle button for mobile */}
                <button
                    onClick={handleMusicToggle}
                    className="absolute top-[152px] right-4 z-20 text-neon-cyan hover:text-white transition-colors p-2"
                    aria-label={musicIsPlaying ? 'Pause music' : 'Play music'}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </button>
                
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    style={{ 
                        touchAction: 'none',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: '#000011',
                        display: 'block'
                    }}
                />
                
                {/* Mobile instructions */}
                {(gameState === 'menu') && (
                    <div className="absolute bottom-4 left-0 right-0 z-10 text-center text-gray-500 text-xs font-mono bg-black/70 backdrop-blur-sm py-2">
                        <div>
                            <p>Touch ship directly: Move and shoot</p>
                            <p>Touch elsewhere: Move only</p>
                        </div>
                    </div>
                )}

                {/* Help Dialog */}
                {showHelpDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="relative bg-dark-gray border-2 border-neon-cyan rounded-lg shadow-lg shadow-neon-cyan/50 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b border-neon-cyan/50">
                                <h2 className="text-2xl font-mono font-semibold text-neon-cyan">Game Instructions</h2>
                                <button
                                    onClick={() => setShowHelpDialog(false)}
                                    className="text-neon-cyan hover:text-white transition-colors p-1"
                                    aria-label="Close help"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="overflow-y-auto p-6 flex-1 text-neon-cyan font-mono">
                                <div className="space-y-4 text-sm leading-relaxed">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Controls</h3>
                                        <p className="mb-2"><strong>Desktop:</strong></p>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Arrow Keys or WASD: Move your ship</li>
                                            <li>Space: Shoot</li>
                                        </ul>
                                        <p className="mt-3 mb-2"><strong>Mobile:</strong></p>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Touch directly on your ship: Move and shoot</li>
                                            <li>Touch elsewhere: Move only (release and touch ship to shoot)</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Objective</h3>
                                        <p>Survive through 10 levels of increasing difficulty. Destroy enemy ships to score points and collect powerups to gain special abilities.</p>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Enemies</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li className="flex items-center gap-2">
                                                <canvas ref={regularEnemyIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span>Regular enemies: 100 points each</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <canvas ref={skullEnemyIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span>Skull ships (red): 500 points each, can shoot back at you</span>
                                            </li>
                                            <li>Enemy difficulty increases with each level</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Powerups</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li className="flex items-center gap-2">
                                                <canvas ref={lifePowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span><strong>+1 Life</strong> (green cross): Gain an extra life</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <canvas ref={scorePowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span><strong>3X Score</strong> (yellow star): Triple your score for 20 seconds</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <canvas ref={magicDefencePowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span><strong>Magic Defence</strong> (purple shield): Become invincible for 20 seconds</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <canvas ref={superWeaponPowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span><strong>Super Weapon</strong> (orange missile): Fire 3 homing missiles for 20 seconds</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <canvas ref={clockExtenderPowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                                <span><strong>Clock Extender</strong> (white clock): Extends active powerup duration by 30 seconds</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Gameplay</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>You start with 3 lives</li>
                                            <li>Lose a life when hit by enemy bullets or collisions</li>
                                            <li>Game ends when all lives are lost</li>
                                            <li>Each level lasts 60 seconds</li>
                                            <li>Enemy spawn rate and speed increase each level</li>
                                            <li>Beat your high score to unlock special celebrations!</li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold text-white mb-2">Tips</h3>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                            <li>Stay mobile to avoid enemy fire</li>
                                            <li>Collect powerups strategically</li>
                                            <li>Use Magic Defence when overwhelmed</li>
                                            <li>Combine 3X Score with Super Weapon for maximum points</li>
                                            <li>Watch for Clock Extenders to extend your powerups</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Desktop: Bordered frame design
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="mb-4 flex items-center justify-between w-full max-w-4xl">
                <button
                    onClick={handleBackToHome}
                    className="text-neon-cyan font-mono hover:text-white transition-colors text-lg"
                >
                    ← neuronoiser.com
                </button>
                
                <div className="flex items-center gap-2">
                    {/* Sound toggle button for desktop */}
                    <button
                        onClick={toggleSound}
                        className="text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                    >
                        {soundEnabled ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                <line x1="17" y1="9" x2="23" y2="15"></line>
                            </svg>
                        )}
                    </button>

                    {/* Music toggle button for desktop */}
                    <button
                        onClick={handleMusicToggle}
                        className="text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label={musicIsPlaying ? 'Pause music' : 'Play music'}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                    </button>

                    {/* Help button for desktop */}
                    <button
                        onClick={() => setShowHelpDialog(true)}
                        className="text-neon-cyan hover:text-white transition-colors p-2"
                        aria-label="Show help"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div className="border-2 border-neon-cyan rounded-lg p-4 shadow-lg shadow-neon-cyan/50">
                <canvas
                    ref={canvasRef}
                    data-testid="game-canvas"
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="block bg-black w-full max-w-full"
                    style={{ 
                        maxWidth: '100%', 
                        height: 'auto'
                    }}
                />
            </div>

            {/* Help Dialog */}
            {showHelpDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="relative bg-dark-gray border-2 border-neon-cyan rounded-lg shadow-lg shadow-neon-cyan/50 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-neon-cyan/50">
                            <h2 className="text-2xl font-mono font-semibold text-neon-cyan">Game Instructions</h2>
                            <button
                                onClick={() => setShowHelpDialog(false)}
                                className="text-neon-cyan hover:text-white transition-colors p-1"
                                aria-label="Close help"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 flex-1 text-neon-cyan font-mono">
                            <div className="space-y-4 text-sm leading-relaxed">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Controls</h3>
                                    <p className="mb-2"><strong>Desktop:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Arrow Keys or WASD: Move your ship</li>
                                        <li>Space: Shoot</li>
                                    </ul>
                                    <p className="mt-3 mb-2"><strong>Mobile:</strong></p>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Touch directly on your ship: Move and shoot</li>
                                        <li>Touch elsewhere: Move only (release and touch ship to shoot)</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Objective</h3>
                                    <p>Survive through 10 levels of increasing difficulty. Destroy enemy ships to score points and collect powerups to gain special abilities.</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Enemies</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li className="flex items-center gap-2">
                                            <canvas ref={regularEnemyIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span>Regular enemies: 100 points each</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <canvas ref={skullEnemyIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span>Skull ships (red): 500 points each, can shoot back at you</span>
                                        </li>
                                        <li>Enemy difficulty increases with each level</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Powerups</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li className="flex items-center gap-2">
                                            <canvas ref={lifePowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span><strong>+1 Life</strong> (green cross): Gain an extra life</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <canvas ref={scorePowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span><strong>3X Score</strong> (yellow star): Triple your score for 20 seconds</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <canvas ref={magicDefencePowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span><strong>Magic Defence</strong> (purple shield): Become invincible for 20 seconds</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <canvas ref={superWeaponPowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span><strong>Super Weapon</strong> (orange missile): Fire 3 homing missiles for 20 seconds</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <canvas ref={clockExtenderPowerupIconRef} className="inline-block" style={{ width: '24px', height: '24px' }}></canvas>
                                            <span><strong>Clock Extender</strong> (white clock): Extends active powerup duration by 30 seconds</span>
                                        </li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Gameplay</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>You start with 3 lives</li>
                                        <li>Lose a life when hit by enemy bullets or collisions</li>
                                        <li>Game ends when all lives are lost</li>
                                        <li>Each level lasts 60 seconds</li>
                                        <li>Enemy spawn rate and speed increase each level</li>
                                        <li>Beat your high score to unlock special celebrations!</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">Tips</h3>
                                    <ul className="list-disc list-inside ml-2 space-y-1">
                                        <li>Stay mobile to avoid enemy fire</li>
                                        <li>Collect powerups strategically</li>
                                        <li>Use Magic Defence when overwhelmed</li>
                                        <li>Combine 3X Score with Super Weapon for maximum points</li>
                                        <li>Watch for Clock Extenders to extend your powerups</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AliensGame
