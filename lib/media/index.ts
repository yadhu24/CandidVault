// Media processing helpers shared with the worker (CLAUDE.md §3). sharp is
// loaded lazily inside ./image, so importing this barrel never pulls the native
// module into a bundle. ffmpeg (./video) is shelled out to only when present.
export { sha256 } from './hash'
export {
  variantsForImage,
  isHeicMime,
  imageProcessingAvailable,
  readImageDimensions,
  renderImageVariant,
} from './image'
export { ffmpegAvailable, probeVideo, extractPosterFrame } from './video'
export type { ImageDimensions, RenderedVariant, VariantSpec, VideoProbe } from './types'
