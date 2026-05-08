import maplibregl from "maplibre-gl";
import type { PixelData, TileIndex } from "./types";
import { getTileBounds } from "./tools";
import "ol/ol.css";

export type ImageFormatMap = {
  PixelData: PixelData;
  ImageData: ImageData;
  ImageBitmap: ImageBitmap;
  OffscreenCanvas: OffscreenCanvas;
  PngBlob: Blob;
  PngBuffer: ArrayBuffer;
  PngObjectUrl: { url: string; revoke: () => void };
};

export type TileRendererOptions = {
  tileSize?: number;
  parentElement?: HTMLElement | null;
  showTileBoundaries?: boolean;
};

export type ImageFormat = keyof ImageFormatMap;

let tileRendererCounter = 0;

function createMapContainer(parent: HTMLElement, width: number, height: number): HTMLDivElement {
  const container = document.createElement("div");
  container.style.setProperty("width", `${width}px`);
  container.style.setProperty("height", `${height}px`);
  container.id = `_maplibre-tile-factory-container-${tileRendererCounter++}_`;
  parent.append(container);
  return container;
}

export class TileRenderer {
  private readonly map: maplibregl.Map;
  private idle: boolean;
  private readonly events = new EventTarget();

  constructor(style: maplibregl.StyleSpecification, options: TileRendererOptions = {}) {
    const SYSTEM_TILE_SIZE = 512;
    const tileSize = options.tileSize ?? SYSTEM_TILE_SIZE;
    const devicePixelRatio = tileSize / SYSTEM_TILE_SIZE;
    const parentElement = options.parentElement || this.createParentElement();

    this.idle = true;
    this.map = new maplibregl.Map({
      container: createMapContainer(parentElement, SYSTEM_TILE_SIZE, SYSTEM_TILE_SIZE),
      hash: false,
      style: style,
      pixelRatio: devicePixelRatio,
      interactive: false,
      attributionControl: false,
      maplibreLogo: false,
      scrollZoom: false,
      anisotropicFilterPitch: 0,
      renderWorldCopies: false,
      fadeDuration: 0,
      // crossSourceCollisions: false, // to check if OK to use
      refreshExpiredTiles: false,
      validateStyle: false,
      trackResize: false,
      collectResourceTiming: false,
      // maxCanvasSize: [512, 512],
      canvasContextAttributes: {
        contextType: "webgl2",
        preserveDrawingBuffer: true,
        antialias: false,
      },
    });

    this.map.showTileBoundaries = !!options.showTileBoundaries;
  }

  private createParentElement(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.setProperty("top", "-5000px");
    container.style.setProperty("left", "-5000px");
    container.style.setProperty("position", "fixed");
    document.body.append(container);
    return container;
  }

  on<T extends ImageFormat>(
    type: "start" | "finish",
    handler: (
      event: CustomEvent<{ tileRenderer: TileRenderer; tileIndex: TileIndex; tileImage: ImageFormatMap[T] | null }>,
    ) => void,
  ) {
    this.events.addEventListener(type, handler as EventListener);

    // Returning the off function to disable the event
    return () => {
      this.events.removeEventListener(type, handler as EventListener);
    };
  }

  once<T extends ImageFormat>(
    type: "start" | "finish",
    handler: (
      event: CustomEvent<{ tileRenderer: TileRenderer; tileIndex: TileIndex; tileImage: ImageFormatMap[T] | null }>,
    ) => void,
  ) {
    this.events.addEventListener(type, handler as EventListener, { once: true });
  }

  private emit<T extends ImageFormat>(
    type: "start" | "finish",
    detail: { tileRenderer: TileRenderer; tileIndex: TileIndex; tileImage: ImageFormatMap[T] | null },
  ) {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  isIdle(): boolean {
    return this.idle;
  }

  setShowTileBoundaries(s: boolean) {
    this.map.showTileBoundaries = s;
  }

  private async fitTileBounds(tileIndex: TileIndex, timeout = 1000) {
    const tileBounds = getTileBounds(tileIndex);

    this.map.fitBounds(
      [
        [tileBounds.lngMin, tileBounds.latMin],
        [tileBounds.lngMax, tileBounds.latMax],
      ],
      {
        animate: false,
      },
    );

    await this.isIdleOrTimeout(timeout);
  }

  private async isIdleOrTimeout(timeout: number): Promise<{ didTimeout: boolean }> {
    return new Promise((resolve) => {
      let clearId: number;
      const resolveWhenIdle = () => {
        clearTimeout(clearId);
        resolve({ didTimeout: false });
      };
      this.map.on("idle", resolveWhenIdle);

      clearId = setTimeout(() => {
        this.map.off("idle", resolveWhenIdle);
        resolve({ didTimeout: true });
      }, timeout);
    });
  }

  private getImageAsPixelData(): PixelData {
    const canvas = this.map.getCanvas();
    const gl = canvas.getContext("webgl2");

    if (!gl) {
      throw Error("Could not get WebGL2 context from canvas.");
    }

    const pixelData = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

    // WebGL readback starts from the bottom row; flip to top-left image orientation.
    const flippedPixelData = this.flipPixelRows(pixelData, canvas.width, canvas.height);
    return { data: flippedPixelData, width: canvas.width, height: canvas.height };
  }

  private flipPixelRows(pixelData: Uint8Array, width: number, height: number): Uint8Array {
    const bytesPerRow = width * 4;
    const flipped = new Uint8Array(pixelData.length);

    for (let y = 0; y < height; y += 1) {
      const sourceOffset = y * bytesPerRow;
      const targetOffset = (height - 1 - y) * bytesPerRow;
      flipped.set(pixelData.subarray(sourceOffset, sourceOffset + bytesPerRow), targetOffset);
    }

    return flipped;
  }

  private getImageAsImageData(): ImageData {
    const pixelData = this.getImageAsPixelData();
    const imageData = new ImageData(pixelData.width, pixelData.height);
    imageData.data.set(pixelData.data);
    return imageData;
  }

  private getImageAsImageBitmap(): Promise<ImageBitmap> {
    return createImageBitmap(this.map.getCanvas());
  }

  private getImageAsOffscreenCanvas(): OffscreenCanvas {
    const imageData = this.getImageAsImageData();
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw Error("Could not get 2D context from canvas.");
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private getImageAsPngBlob(): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      this.map.getCanvas().toBlob((blob) => {
        if (!blob) {
          reject(Error("Screenshot could not be created."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  }

  private async getImageAsPngBuffer(): Promise<ArrayBuffer | null> {
    const blob = await this.getImageAsPngBlob();

    if (!blob) {
      console.warn("The PNG blob could not be created.");
      return null;
    }

    const pngBuffer = await blob.arrayBuffer();
    return pngBuffer;
  }

  private async getImageAsPngObjectURL(): Promise<{ url: string; revoke: () => void } | null> {
    const blob = await this.getImageAsPngBlob();

    if (!blob) {
      console.warn("The PNG blob could not be created.");
      return null;
    }

    const url = URL.createObjectURL(blob);
    const revoke = () => URL.revokeObjectURL(url);
    return { url, revoke };
  }

  private async getImage<T extends ImageFormat>(format: T): Promise<ImageFormatMap[T]> {
    switch (format) {
      case "PixelData":
        return this.getImageAsPixelData() as ImageFormatMap[T];

      case "ImageData":
        return this.getImageAsImageData() as ImageFormatMap[T];

      case "ImageBitmap":
        return this.getImageAsImageBitmap() as Promise<ImageFormatMap[T]>;

      case "OffscreenCanvas":
        return this.getImageAsOffscreenCanvas() as ImageFormatMap[T];

      case "PngBlob":
        return this.getImageAsPngBlob() as Promise<ImageFormatMap[T]>;

      case "PngBuffer":
        return this.getImageAsPngBuffer() as Promise<ImageFormatMap[T]>;

      case "PngObjectUrl":
        return this.getImageAsPngObjectURL() as Promise<ImageFormatMap[T]>;
    }
  }

  /**
   * Render a tile in the given format
   */
  async renderTile<T extends ImageFormat>(tileIndex: TileIndex, format: T, timeout = 1000): Promise<ImageFormatMap[T]> {
    this.idle = false;
    this.emit("start", { tileRenderer: this, tileIndex, tileImage: null });
    await this.fitTileBounds(tileIndex, timeout);
    const img = await this.getImage(format);
    this.idle = true;
    this.emit("finish", { tileRenderer: this, tileIndex, tileImage: img });
    return img;
  }
}
