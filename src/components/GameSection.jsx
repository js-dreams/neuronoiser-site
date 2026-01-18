import React, { useEffect, useRef, useState } from 'react'

// Game preview constants (scaled down)
const PREVIEW_WIDTH = 800
const PREVIEW_HEIGHT = 200
const STAR_COUNT = 30

function GameSection() {
    const canvasRef = useRef(null)
    const animationFrameRef = useRef(null)
    const starsRef = useRef([])
    const playerRef = useRef({ x: PREVIEW_WIDTH / 2, y: PREVIEW_HEIGHT - 50 })
    const enemiesRef = useRef([])
    const bulletsRef = useRef([])
    const enemyBulletsRef = useRef([])
    const homingMissilesRef = useRef([])
    const powerupsRef = useRef([])
    const lastFrameTimeRef = useRef(null)
    const [isMobile, setIsMobile] = useState(false)

    // Detect mobile (same logic as game)
    useEffect(() => {
        const checkMobile = () => {
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
            const widthBasedMobile = window.innerWidth < 768
            const mobile = widthBasedMobile || (hasTouch && window.innerWidth < 1024)
            setIsMobile(mobile)
        }
        
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        canvas.width = PREVIEW_WIDTH
        canvas.height = PREVIEW_HEIGHT

        // Initialize stars
        starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
            x: Math.random() * PREVIEW_WIDTH,
            y: Math.random() * PREVIEW_HEIGHT,
            speed: 0.5 + Math.random() * 1.5,
            size: 1 + Math.random() * 2
        }))

        // Initialize enemies (scaled appropriately)
        enemiesRef.current = [
            { x: 100, y: 50, width: 30, height: 30, vx: 1, isMega: false },
            { x: 300, y: 40, width: 30, height: 30, vx: -1, isMega: false },
            { x: 500, y: 60, width: 30, height: 30, vx: 0.8, isMega: true },
            { x: 650, y: 45, width: 30, height: 30, vx: -0.8, isMega: false }
        ]

        // Initialize player bullets (all from ship's tip)
        const initialPlayerY = PREVIEW_HEIGHT - 50
        bulletsRef.current = [
            { x: PREVIEW_WIDTH / 2, y: initialPlayerY - 30, width: 4, height: 12 },
            { x: PREVIEW_WIDTH / 2, y: initialPlayerY - 60, width: 4, height: 12 },
            { x: PREVIEW_WIDTH / 2, y: initialPlayerY - 90, width: 4, height: 12 }
        ]

        // Initialize homing missiles (all from ship's tip)
        homingMissilesRef.current = [
            { x: PREVIEW_WIDTH / 2, y: initialPlayerY - 40, width: 6, height: 10 },
            { x: PREVIEW_WIDTH / 2, y: initialPlayerY - 70, width: 6, height: 10 }
        ]

        // Initialize enemy bullets
        enemyBulletsRef.current = [
            { x: 150, y: 80, width: 4, height: 8 },
            { x: 350, y: 90, width: 4, height: 8 }
        ]

        // Initialize powerups
        powerupsRef.current = [
            { x: 200, y: 100, size: 25, type: 'life' },
            { x: 600, y: 120, size: 25, type: 'score' }
        ]

        // Player movement animation (gentle floating)
        let playerDirection = 1
        const playerSpeed = 0.4

        const gameLoop = () => {
            const currentTime = performance.now()
            const deltaTime = lastFrameTimeRef.current !== null 
                ? Math.min((currentTime - lastFrameTimeRef.current) / 16.67, 2.0)
                : 1.0
            lastFrameTimeRef.current = currentTime

            // Clear canvas with dark background
            ctx.fillStyle = '#000011'
            ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)

            // Update and draw stars
            ctx.fillStyle = '#ffffff'
            starsRef.current.forEach(star => {
                star.y += star.speed * deltaTime
                if (star.y > PREVIEW_HEIGHT) {
                    star.y = 0
                    star.x = Math.random() * PREVIEW_WIDTH
                }
                ctx.fillRect(star.x, star.y, star.size, star.size)
            })

            // Update player position (gentle floating animation)
            playerRef.current.x += playerDirection * playerSpeed * deltaTime
            if (playerRef.current.x > PREVIEW_WIDTH - 50 || playerRef.current.x < 50) {
                playerDirection *= -1
            }

            // Update enemies
            enemiesRef.current.forEach(enemy => {
                enemy.x += enemy.vx * deltaTime
                if (enemy.x < 0 || enemy.x > PREVIEW_WIDTH - enemy.width) {
                    enemy.vx *= -1
                }
                enemy.y += 0.15 * deltaTime // Slight downward movement
                if (enemy.y > PREVIEW_HEIGHT) {
                    enemy.y = -30
                    enemy.x = Math.random() * PREVIEW_WIDTH
                }
            })

            // Update player bullets (always from ship's tip, like real game)
            bulletsRef.current.forEach(bullet => {
                bullet.y -= 4 * deltaTime
                if (bullet.y < -bullet.height) {
                    bullet.y = playerRef.current.y - 30 // Fire from ship's tip (player.y - 25 is tip, -30 for bullet start)
                    bullet.x = playerRef.current.x // Fire from center only
                }
            })

            // Update homing missiles (always from ship's tip)
            homingMissilesRef.current.forEach(missile => {
                missile.y -= 3 * deltaTime
                if (missile.y < -missile.height) {
                    missile.y = playerRef.current.y - 30 // Fire from ship's tip
                    missile.x = playerRef.current.x // Fire from center only
                }
            })

            // Update enemy bullets
            enemyBulletsRef.current.forEach(bullet => {
                bullet.y += 2 * deltaTime
                if (bullet.y > PREVIEW_HEIGHT) {
                    bullet.y = 50
                    bullet.x = enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)]?.x + 15 || 100
                }
            })

            // Update powerups
            powerupsRef.current.forEach(powerup => {
                powerup.y += 0.8 * deltaTime
                if (powerup.y > PREVIEW_HEIGHT) {
                    powerup.y = -25
                    powerup.x = Math.random() * PREVIEW_WIDTH
                }
            })

            // Draw player ship (exact match to real game - double width on mobile)
            ctx.fillStyle = '#00FFFF'
            const playerWidth = isMobile ? 30 : 15
            ctx.beginPath()
            ctx.moveTo(playerRef.current.x, playerRef.current.y - 25)
            ctx.lineTo(playerRef.current.x - playerWidth, playerRef.current.y + 15)
            ctx.lineTo(playerRef.current.x, playerRef.current.y + 5)
            ctx.lineTo(playerRef.current.x + playerWidth, playerRef.current.y + 15)
            ctx.closePath()
            ctx.fill()
            
            // Player glow
            ctx.shadowBlur = 15
            ctx.shadowColor = '#00FFFF'
            ctx.fill()
            ctx.shadowBlur = 0

            // Draw enemies (exact match to real game - double width on mobile)
            enemiesRef.current.forEach(enemy => {
                const enemyRadiusX = isMobile ? enemy.width : enemy.width / 2
                const enemyRadiusY = enemy.width / 2
                const centerX = enemy.x + enemy.width / 2
                const centerY = enemy.y + enemy.height / 2
                
                if (enemy.isMega) {
                    // Skull ships: black body with red halo effect (exact match)
                    ctx.save()
                    
                    // Red halo/glow effect
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
                    ctx.fillStyle = '#1A0000'
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(centerX, centerY, enemyRadiusX, enemyRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(centerX, centerY, enemyRadiusX, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    ctx.restore()
                    
                    // Draw simplified skull symbol
                    ctx.fillStyle = '#666666'
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    const sizeX = enemyRadiusX
                    const sizeY = enemyRadiusY
                    
                    // Head
                    ctx.beginPath()
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
                    
                    // Jaw/teeth
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
                    // Regular enemy ships: yellow, red, and black combination (exact match)
                    ctx.save()
                    
                    // Outer glow: red-orange
                    ctx.shadowBlur = 12
                    ctx.shadowColor = '#FF4400'
                    ctx.fillStyle = '#8B0000'
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(centerX, centerY, enemyRadiusX, enemyRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(centerX, centerY, enemyRadiusX, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    // Main body: dark red with black accents
                    ctx.shadowBlur = 0
                    ctx.fillStyle = '#CC0000'
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(centerX, centerY, enemyRadiusX * 0.85, enemyRadiusY * 0.85, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(centerX, centerY, enemyRadiusX * 0.85, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    
                    ctx.restore()
                    
                    // Center detail: yellow accent
                    ctx.fillStyle = '#FFAA00'
                    const detailRadiusX = isMobile ? enemy.width / 3 : enemy.width / 5
                    const detailRadiusY = enemy.width / 5
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(centerX, centerY, detailRadiusX, detailRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(centerX, centerY, detailRadiusX, 0, Math.PI * 2)
                    }
                    ctx.fill()
                }
            })

            // Draw player bullets (yellow)
            ctx.fillStyle = '#FFFF00'
            bulletsRef.current.forEach(bullet => {
                ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
            })

            // Draw homing missiles (orange with stroke)
            ctx.fillStyle = '#FF6600'
            ctx.strokeStyle = '#FFA500'
            ctx.lineWidth = 1.5
            homingMissilesRef.current.forEach(missile => {
                ctx.save()
                const centerX = missile.x + missile.width / 2
                const centerY = missile.y + missile.height / 2
                
                ctx.beginPath()
                ctx.moveTo(centerX, centerY - missile.height / 2)
                ctx.lineTo(centerX - missile.width / 2, centerY + missile.height / 2)
                ctx.lineTo(centerX, centerY + missile.height / 2 - 2)
                ctx.lineTo(centerX + missile.width / 2, centerY + missile.height / 2)
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
                
                ctx.shadowBlur = 8
                ctx.shadowColor = '#FF6600'
                ctx.fill()
                ctx.shadowBlur = 0
                ctx.restore()
            })

            // Draw enemy bullets (red)
            ctx.fillStyle = '#FF4444'
            enemyBulletsRef.current.forEach(bullet => {
                ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height)
            })

            // Draw powerups (exact match to real game - double width on mobile)
            powerupsRef.current.forEach(powerup => {
                const powerupRadiusX = isMobile ? powerup.size * 2 : powerup.size
                const powerupRadiusY = powerup.size
                
                if (powerup.type === 'life') {
                    // Life powerup: magenta/pink circle
                    ctx.fillStyle = '#FF00FF'
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    // Draw "+1" text (1.6x wider on mobile, height stays same)
                    ctx.fillStyle = '#FFFFFF'
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    if (isMobile) {
                        ctx.save()
                        ctx.scale(1.6, 1.0)
                        ctx.fillText('+1', powerup.x / 1.6, powerup.y)
                        ctx.restore()
                    } else {
                        ctx.fillText('+1', powerup.x, powerup.y)
                    }
                } else {
                    // Score bonus powerup: yellow-green with gradient
                    const gradient = ctx.createRadialGradient(
                        powerup.x - powerupRadiusX * 0.3,
                        powerup.y - powerupRadiusY * 0.3,
                        0,
                        powerup.x,
                        powerup.y,
                        powerupRadiusX
                    )
                    gradient.addColorStop(0, '#ADFF2F')
                    gradient.addColorStop(1, '#7CFC00')
                    ctx.fillStyle = gradient
                    ctx.beginPath()
                    if (isMobile) {
                        ctx.ellipse(powerup.x, powerup.y, powerupRadiusX, powerupRadiusY, 0, 0, Math.PI * 2)
                    } else {
                        ctx.arc(powerup.x, powerup.y, powerupRadiusY, 0, Math.PI * 2)
                    }
                    ctx.fill()
                    // Draw "3X" text (1.6x wider on mobile, height stays same)
                    ctx.fillStyle = '#FFFFFF'
                    ctx.font = 'bold 14px "Courier New", monospace'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    if (isMobile) {
                        ctx.save()
                        ctx.scale(1.6, 1.0)
                        ctx.fillText('3X', powerup.x / 1.6, powerup.y)
                        ctx.restore()
                    } else {
                        ctx.fillText('3X', powerup.x, powerup.y)
                    }
                }
            })

            // Draw title "AstroNoiser" (1.6x wider on mobile, height stays same)
            ctx.fillStyle = '#00FFFF'
            ctx.font = 'bold 48px "Courier New", monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            if (isMobile) {
                ctx.save()
                ctx.scale(1.6, 1.0)
                ctx.fillText('AstroNoiser', PREVIEW_WIDTH / 2 / 1.6, PREVIEW_HEIGHT / 2 - 15)
                ctx.restore()
            } else {
                ctx.fillText('AstroNoiser', PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2 - 15)
            }

            // Draw "Play Now!" below title (1.6x wider on mobile, height stays same, darker blue)
            ctx.fillStyle = '#0080FF' // Darker blue
            ctx.font = 'bold 25px "Courier New", monospace'
            if (isMobile) {
                ctx.save()
                ctx.scale(1.6, 1.0)
                ctx.fillText('Play Now!', PREVIEW_WIDTH / 2 / 1.6, PREVIEW_HEIGHT / 2 + 20)
                ctx.restore()
            } else {
                ctx.fillText('Play Now!', PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2 + 20)
            }

            animationFrameRef.current = requestAnimationFrame(gameLoop)
        }

        animationFrameRef.current = requestAnimationFrame(gameLoop)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [isMobile])

    return (
        <section id="game-section" className="space-y-6">
            <a 
                href="https://astronoiser.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="block"
            >
                <div className="bg-dark-gray rounded-xl shadow-inner shadow-dark-gray/50 border-2 border-neon-cyan/50 transition-all duration-300 ease-in-out hover:translate-y-[-4px] hover:scale-[1.02] hover:shadow-[0_10px_20px_rgba(0,255,255,0.4)] hover:border-neon-cyan overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-auto bg-black rounded-xl"
                        style={{ minHeight: '200px' }}
                    />
                </div>
            </a>
        </section>
    )
}

export default GameSection
