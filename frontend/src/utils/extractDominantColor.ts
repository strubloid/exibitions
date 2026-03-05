/**
 * Extracts the dominant color from an image
 * Returns RGB color as a string: "rgb(r, g, b)"
 */
export const extractDominantColor = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 50
        canvas.height = 50
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve('rgb(80, 80, 80)') // fallback gray
          return
        }

        ctx.drawImage(img, 0, 0, 50, 50)
        const imageData = ctx.getImageData(0, 0, 50, 50).data

        let r = 0, g = 0, b = 0
        const pixelCount = imageData.length / 4

        for (let i = 0; i < imageData.length; i += 4) {
          r += imageData[i]
          g += imageData[i + 1]
          b += imageData[i + 2]
        }

        r = Math.floor(r / pixelCount)
        g = Math.floor(g / pixelCount)
        b = Math.floor(b / pixelCount)

        // Darken the color slightly for better background contrast with white text
        r = Math.floor(r * 0.7)
        g = Math.floor(g * 0.7)
        b = Math.floor(b * 0.7)

        resolve(`rgb(${r}, ${g}, ${b})`)
      } catch {
        resolve('rgb(80, 80, 80)') // fallback gray
      }
    }

    img.onerror = () => {
      resolve('rgb(80, 80, 80)') // fallback gray
    }

    img.src = imageSrc
  })
}
