import type { PixelData, TileIndex } from "./types";

export function wrapTileIndex(tileIndex: TileIndex): TileIndex | null {
  if (tileIndex.z < 0) {
    return null
  }

  const nbTilePerAxis = 2 ** tileIndex.z
  if (tileIndex.y < 0 || tileIndex.y > nbTilePerAxis) {
    return null
  }
  
  let x = tileIndex.x % nbTilePerAxis
  if (x < 0) {
    x = nbTilePerAxis + x
  }

  return {
    x: x,
    y: tileIndex.y,
    z: tileIndex.z,
  } as TileIndex;
}

export function getTileBounds(tileIndex: TileIndex): {lngMin: number, latMin: number, lngMax: number, latMax: number} {
  const n = Math.pow(2, tileIndex.z);
  const lngMin = (tileIndex.x / n) * 360 - 180;
  const latMax = (Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileIndex.y / n)))) * 180) / Math.PI;
  const lngMax = ((tileIndex.x + 1) / n) * 360 - 180;
  const latMin = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((tileIndex.y + 1) / n)))) * 180) / Math.PI;
  return { lngMin, latMin, lngMax, latMax }
}

export async function fitTileBounds(map: maplibregl.Map, tileIndex: TileIndex, timeout = 1000) {
  const tileBounds = getTileBounds(tileIndex)

  map.fitBounds([
    [tileBounds.lngMin, tileBounds.latMin],
    [tileBounds.lngMax, tileBounds.latMax]
  ], {
    duration: 0,
  });

  await isIdleOrTimeout(map, timeout)

}

async function isIdleOrTimeout(map: maplibregl.Map, timeout: number): Promise<{ didTimeout: boolean }> {

  return new Promise((resolve) => {
    // TODO: remove this event in the setTimeout
    map.once('idle', () => {
      resolve({ didTimeout: false })
    })

    setTimeout(() => {
      resolve({ didTimeout: true })
    }, timeout)

  })
}

function allSourcesLoaded(map: maplibregl.Map): boolean {
  const style = map.getStyle()
  const sourceIds = Object.keys(style.sources)
  return sourceIds.filter(id => !map.isSourceLoaded(id)).length === 0
}

export function getUnloadedSource(map: maplibregl.Map): string[] {
  const style = map.getStyle()
  const sourceIds = Object.keys(style.sources)
  return sourceIds.filter(id => !map.isSourceLoaded(id))
}



export function getImageAsPixelData(map: maplibregl.Map): PixelData {
  const canvas = map.getCanvas()
  const gl = canvas.getContext('webgl2')
  const pixelData = new Uint8Array(canvas.width * canvas.height * 4)
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData)
  return { data: pixelData, width: canvas.width, height: canvas.height }
}

export function getImageAsImageData(map: maplibregl.Map): ImageData {
  const pixelData = getImageAsPixelData(map)
  const imageData = new ImageData(pixelData.width, pixelData.height)
  imageData.data.set(pixelData.data)
  return imageData
}

export async function getImageAsImageBitmap(map: maplibregl.Map): Promise<ImageBitmap> {
  const imageData = getImageAsImageData(map)
  return createImageBitmap(imageData)
}

export function getImageAsOffscreenCanvas(map: maplibregl.Map): OffscreenCanvas {
  const imageData = getImageAsImageData(map)
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext("2d")
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export async function getImageAsPngBlob(map: maplibregl.Map): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    map.getCanvas().toBlob((blob) => {
      if (!blob) {
        reject(Error("Screenshot could not be created."))
        return
      }
      resolve(blob)
    }, "image/png")
  })
}

export async function getImageAsPngBuffer(map: maplibregl.Map): Promise<ArrayBuffer | null> {
  const blob = await getImageAsPngBlob(map)

  if (!blob) {
    console.warn("The PNG blob could not be created.")
    return null
  }

  const pngBuffer = await blob.arrayBuffer()
  return pngBuffer
}


export async function getImageAsPngObjectURL(map: maplibregl.Map): Promise<{ url: string, revoke: () => void } | null> {
  const blob = await getImageAsPngBlob(map)

  if (!blob) {
    console.warn("The PNG blob could not be created.")
    return null
  }

  const url = URL.createObjectURL(blob)
  const revoke = () => URL.revokeObjectURL(url)
  return { url, revoke }
}

