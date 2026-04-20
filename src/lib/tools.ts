import type { TileIndex } from "./types";

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


export function tileIndexToTileId(tileIndex: TileIndex): string {
  return `${tileIndex.z}_${tileIndex.x}_${tileIndex.y}`
}


export function tileIdToTileIndex(id: string): TileIndex {
  const splitted = id.split('_')
  return {
    z: Number.parseInt(splitted[0]),
    x: Number.parseInt(splitted[1]),
    y: Number.parseInt(splitted[2]),
  }
}

export function isSameTileIndex(ti1: TileIndex, ti2: TileIndex): boolean {
  return ti1.z === ti2.z && ti1.x === ti2.x && ti1.y === ti2.y
}