import maplibregl from "maplibre-gl"

let tileRendererCounter = 0

export type RenderingFormat = 'PixelData' | 'ImageData' | 'ImageBitmap' | 'OffscreenCanvas' | 'PngBlob' | 'PngBuffer' | 'PngObjectURL'


function createMapContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.id = `_maplibre-tiles-factory-container-${tileRendererCounter++}_`
  container.style.setProperty('width', '512px')
  container.style.setProperty('height', '512px')
  container.style.setProperty('top', '-1000px')
  container.style.setProperty('left', '-1000px')
  // container.style.setProperty('bottom', '0')
  // container.style.setProperty('right', '0')
  container.style.setProperty('position', 'fixed')

  document.body.append(container)
  return container
}

export class TileRenderer {
  private map: maplibregl.Map

  constructor(style: maplibregl.StyleSpecification) {
    this.map = new maplibregl.Map({
      container: createMapContainer(),
      hash: false,
      style: style,
      pixelRatio: 2,
      canvasContextAttributes: {
        preserveDrawingBuffer: true,
        antialias: false,
      }
    })
  }

  setShowTileBoundaries(s: boolean) {
    this.map.showTileBoundaries = s
  }
}