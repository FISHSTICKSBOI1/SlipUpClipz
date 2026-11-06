import type { ShowcaseCrop } from '../config/aiVoiceShowcase'

export function cropFrameStyle(
  crop: ShowcaseCrop,
  image: { width: number; height: number },
) {
  return {
    aspectRatio: `${crop.width} / ${crop.height}`,
    image: {
      width: `${(image.width / crop.width) * 100}%`,
      height: `${(image.height / crop.height) * 100}%`,
      left: `${(-crop.x / crop.width) * 100}%`,
      top: `${(-crop.y / crop.height) * 100}%`,
    },
  }
}
