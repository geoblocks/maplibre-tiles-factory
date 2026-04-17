import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { getStyle } from "basemapkit";
import { Protocol } from "pmtiles";
import { pmtiles, sprite, glyphs, lang, pmtilesTerrain, terrainEncoding } from "./constants";
import { fitTileBounds, getImageAsPixelData, getImageAsPngObjectURL, wrapTileIndex } from "../lib/tools";
import type { TileIndex } from "../lib/types";


function createMapContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.id = '_maplibre-tiles-factory-container_'
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

export async function basicDemo() {
  const snapButton = document.getElementById('snap-bt') as HTMLButtonElement
  const snapContainer = document.getElementById('snap-container') as HTMLDivElement
  if (!snapButton) return
  if (!snapContainer) return

  let tileIndex: TileIndex

  document.getElementById('tile-index-input').addEventListener('input', ({target}) => {
    const value = (target as HTMLInputElement).value
    const members = value.split('/').map((el) => Number.parseInt(el))
    tileIndex = undefined

    if (members.length !== 3) {
      snapButton.disabled = true
      return
    }

    if (members.some((el) => Number.isNaN(el))) {
      snapButton.disabled = true
      return
    }

    const wrappedTileIndex = wrapTileIndex({ z: members[0], x: members[1], y: members[2] })

    if (!wrappedTileIndex) {
      snapButton.disabled = true
      return
    }

    tileIndex = wrappedTileIndex
    snapButton.disabled = false
  })


  snapButton.addEventListener('pointerup', async () => {
    if (!tileIndex) return

    map.showTileBoundaries = false

    console.time("fit map")
    await fitTileBounds(map, tileIndex)
    console.timeEnd("fit map")

    // console.time("get pixel data")
    // getImageAsPixelData(map)
    // console.timeEnd("get pixel data")

    console.time("create object URL")
    
    const {url, revoke } = await getImageAsPngObjectURL(map)
    map.showTileBoundaries = true
    console.timeEnd("create object URL")
    
  
    const img = document.createElement('img')
    img.src = url

    snapContainer.append(img)
  })
  

  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  
  const style = getStyle("avenue", {
    pmtiles,
    sprite,
    glyphs,
    lang,
    hidePOIs: true,
    globe: false,
    terrain: {
      pmtiles: pmtilesTerrain,
      hillshading: true,
      encoding: terrainEncoding,
    }
  })

  const map = new maplibregl.Map({
    container: createMapContainer(),
    hash: false,
    zoom: 4,
    center: [27.35, 38.92],
    style: style,
    maxPitch: 89,
    pixelRatio: 2,
    canvasContextAttributes: {
      preserveDrawingBuffer: true,
      antialias: false,
    }
  })

  map.showTileBoundaries = true
  // await new Promise((resolve) => map.on("load", resolve))


  map.on('sourcedataabort', () => {
    console.log('event sourcedataabort');
  })

  map.on('dataabort', () => {
    console.log('event dataabort');
  })

  map.on('error', () => {
    console.log('event error');
  })

  map.on('styledataloading', () => {
    console.log('event styledataloading');
  })

  map.on('styledata', () => {
    console.log('event styledata');
  })

  // map.on('sourcedataloading', () => {
  //   console.log('event sourcedataloading');
  // })

  
}
