// Media processing helpers shared with the worker (CLAUDE.md §3). sharp is
// loaded lazily inside ./image, so importing this barrel never pulls the native
// module into a bundle.
export { sha256 } from './hash'
export {
  IMAGE_VARIANTS,
  imageProcessingAvailable,
  readImageDimensions,
  renderImageVariant,
} from './image'
export type { ImageDimensions, RenderedVariant, VariantSpec } from './types'
