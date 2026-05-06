import { Queue } from "./Queue";
import { TileRenderer, type ImageFormat, type ImageFormatMap } from "./TileRenderer";
import { isSameTileIndex, wrapTileIndex } from "./tools";
import type { TileIndex } from "./types";

export type TileFactoryOptions = {
  /**
   * Number of concurent Maplibre Map instances used
   * to process the tile queue.
   * Default: 4
   */
  numberOfRenderers?: number;
  /**
   * Image format used in the production of tiles.
   * Default: 'ImageData'
   */
  imageFormat?: ImageFormat;

  /**
   * Timeout in milliseconds for waiting a view is ready before
   * rendering it.
   * Default: 1000
   */
  timeout?: number;

  /**
   * Tile size in pixels. Must be a power of 2 or will be set to the upper power of 2.
   * Default: 512
   */
  tileSize?: number;
};

export class TileFactory {
  private readonly tileRenderers: TileRenderer[] = [];
  private readonly queue = new Queue();
  private imageFormat: ImageFormat;
  private readonly events = new EventTarget();
  private timeout: number;

  constructor(style: maplibregl.StyleSpecification, options: TileFactoryOptions = {}) {
    this.imageFormat = options.imageFormat ?? "ImageData";
    this.timeout = options.timeout ?? 1000;
    const numberOfRenderers = options.numberOfRenderers ?? 4;

    for (let i = 0; i < numberOfRenderers; i += 1) {
      const tileRenderer = new TileRenderer(style, { tileSize: options.tileSize });

      tileRenderer.on("start", (e) => {
        this.emit("start", { tileIndex: e.detail.tileIndex, tileImage: e.detail.tileImage });
      });

      tileRenderer.on("finish", (e) => {
        this.emit("finish", { tileIndex: e.detail.tileIndex, tileImage: e.detail.tileImage });

        // when a job is done, check in the queue if any job is left
        this.tryRenderTile();
      });

      this.tileRenderers.push(tileRenderer);
    }
  }

  on<T extends ImageFormat>(
    type: "start" | "finish",
    handler: (event: CustomEvent<{ tileIndex: TileIndex; tileImage: ImageFormatMap[T] | null }>) => void,
  ) {
    const listener = handler as EventListener;
    this.events.addEventListener(type, listener);

    // Returning the off function to disable the event
    return () => {
      this.events.removeEventListener(type, listener);
    };
  }

  private emit<T extends ImageFormat>(
    type: "start" | "finish",
    detail: { tileIndex: TileIndex; tileImage: ImageFormatMap[T] | null },
  ) {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Returns the first TileRenderer instance that is
   */
  private getIdleRenderer(): TileRenderer | null {
    for (const element of this.tileRenderers) {
      if (element.isIdle()) {
        return element;
      }
    }
    return null;
  }

  private tryRenderTile() {
    const tileRenderer = this.getIdleRenderer();

    // If no tile renderer is idle at the moment
    if (!tileRenderer) {
      return;
    }

    const tileIndex = this.queue.dequeue();

    // The queue is empty
    if (!tileIndex) {
      return;
    }

    tileRenderer.renderTile(tileIndex, this.imageFormat, this.timeout);
  }

  /**
   * Discard all tiles currently waiting in the queue.
   * Tiles already being rendered are not affected.
   */
  cancelAllQueued() {
    this.queue.clear();
  }

  requestTile<T extends ImageFormat>(tileIndex: TileIndex, signal?: AbortSignal): Promise<ImageFormatMap[T] | null> {
    const wrappedTileIndex = wrapTileIndex(tileIndex);
    if (!wrappedTileIndex) {
      return Promise.resolve(null);
    }

    if (signal?.aborted) {
      return Promise.resolve(null);
    }

    this.queue.enqueue(wrappedTileIndex);

    const tileImagePromise = new Promise<ImageFormatMap[T] | null>((resolve) => {
      const removeEventFunc = this.on("finish", (e) => {
        const finishedTileIndex = e.detail.tileIndex;

        if (isSameTileIndex(finishedTileIndex, wrappedTileIndex)) {
          removeEventFunc();
          resolve(e.detail.tileImage as ImageFormatMap[T]);
        }
      });

      signal?.addEventListener(
        "abort",
        () => {
          // Still in queue: remove it so no renderer picks it up.
          this.queue.remove(wrappedTileIndex);
          // Already rendering: the finish event will never come for us, so resolve null.
          removeEventFunc();
          resolve(null);
        },
        { once: true },
      );
    });

    this.tryRenderTile();

    return tileImagePromise;
  }
}
