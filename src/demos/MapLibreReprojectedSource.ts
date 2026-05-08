import maplibregl from "maplibre-gl";
import ImageTileSource from "ol/source/ImageTile.js";
import { createXYZ } from "ol/tilegrid.js";
import type { Projection } from "ol/proj.js";
import { TileFactory } from "../lib";

export type MapLibreReprojectedSourceOptions = {
  tileSize: number;
  dpr: number;
  reprojectionProjection: Projection;
  numberOfRenderers?: number;
  timeout?: number;
  parentElement?: HTMLElement | null;
};

export class MapLibreReprojectedSource {
  private readonly tileFactory: TileFactory;
  readonly source: ImageTileSource;

  constructor(style: maplibregl.StyleSpecification, options: MapLibreReprojectedSourceOptions) {
    const { tileSize, dpr, reprojectionProjection, numberOfRenderers, timeout, parentElement } = options;
    const physicalTileSize = tileSize * dpr;

    this.tileFactory = new TileFactory(style, {
      imageFormat: "ImageBitmap",
      numberOfRenderers: numberOfRenderers ?? 3,
      tileSize: physicalTileSize,
      timeout: timeout ?? 30000,
      parentElement,
    });

    const mercatorGrid = createXYZ({
      tileSize: physicalTileSize,
      maxZoom: 19,
    });

    this.source = new ImageTileSource({
      projection: "EPSG:3857",
      tileGrid: mercatorGrid,
      tileSize: physicalTileSize,
      maxZoom: 19,
      zDirection: -1,
      interpolate: true,

      loader: async (z, x, y, olOptions) => {
        const bitmap = await this.tileFactory.requestTile<"ImageBitmap">({ z, x, y }, olOptions.signal);

        if (!bitmap) {
          throw new Error(`Failed to load tile ${z}/${x}/${y}`);
        }
        return bitmap;
      },
    });

    this.source.setTileGridForProjection(
      reprojectionProjection,
      createXYZ({
        extent: reprojectionProjection.getExtent(),
        tileSize: physicalTileSize,
        maxZoom: 19,
      }),
    );
  }

  cancelAllQueued() {
    this.tileFactory.cancelAllQueued();
  }

  destroy() {
    this.tileFactory.cancelAllQueued();
  }
}
