const sharp = require('sharp')
const path = require('path')

/**
 * Overlays a target phone number onto an evidence image
 * Places the number in the bottom-right corner with a dark background
 */
async function overlayNumberOnImage(templatePath, targetNumber, outputPath) {
    try {
        // Load the template image
        const image = sharp(templatePath)
        const metadata = await image.metadata()

        // Calculate dimensions for the overlay
        const padding = 20
        const fontSize = Math.min(32, Math.floor(metadata.width / 20))
        const textWidth = targetNumber.length * (fontSize * 0.6) + 60
        const boxWidth = Math.min(textWidth + 40, metadata.width - 40)
        const boxHeight = fontSize + 40
        const x = metadata.width - boxWidth - padding
        const y = metadata.height - boxHeight - padding

        // Create SVG overlay with target number
        const svg = `
            <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.5"/>
                    </filter>
                </defs>
                <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" 
                      rx="8" ry="8" fill="black" opacity="0.8" filter="url(#shadow)"/>
                <text x="${x + boxWidth - 15}" y="${y + boxHeight - 12}" 
                      font-family="'Courier New', monospace" 
                      font-size="${fontSize}" 
                      font-weight="bold" 
                      fill="#ff4444" 
                      text-anchor="end">
                    ${targetNumber}
                </text>
                <text x="${x + boxWidth - 15}" y="${y + boxHeight - 14}" 
                      font-family="'Courier New', monospace" 
                      font-size="${fontSize}" 
                      font-weight="bold" 
                      fill="#cc0000" 
                      text-anchor="end" 
                      opacity="0.3">
                    ${targetNumber}
                </text>
            </svg>
        `

        // Composite the overlay onto the image
        await image
            .composite([{
                input: Buffer.from(svg),
                top: 0,
                left: 0,
            }])
            .jpeg({ quality: 90 })
            .toFile(outputPath)

        return outputPath

    } catch (error) {
        // If overlay fails, just copy the template directly
        const fs = require('fs')
        fs.copyFileSync(templatePath, outputPath)
        console.warn(`⚠️ Overlay failed for ${templatePath}: ${error.message} — using template directly`)
        return outputPath
    }
}

module.exports = overlayNumberOnImage
