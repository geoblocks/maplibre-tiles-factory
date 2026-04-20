import { tileIdToTileIndex, tileIndexToTileId } from "./tools"
import type { TileIndex } from "./types"

export class Queue {
  private readonly s = new Set<string>()

  /**
   * Add a TileIndex at the end of the queue
   */
  enqueue(tileIndex: TileIndex) {
    this.s.add(tileIndexToTileId(tileIndex))
  }

  /**
   * Get the TileIndex at the begining of the queue
   */
  dequeue(): TileIndex | null {
    const it = this.s.values().next()
    if (it.done) return null
    const val = it.value as string
    this.s.delete(val)
    return tileIdToTileIndex(val)
  }

  /**
   * Remove a TileIndex from the queue (eg. if its rendering has been canceled)
   */
  remove(tileIndex: TileIndex) {
    this.s.delete(tileIndexToTileId(tileIndex))
  }

  get size() {
    return this.s.size
  }
}