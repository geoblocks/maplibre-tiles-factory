import maplibregl from "maplibre-gl";
import { getStyle } from "basemapkit";
import { Protocol } from "pmtiles";
import { pmtiles, sprite, glyphs, lang, pmtilesTerrain, terrainEncoding } from "./constants";
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import ImageTileSource from "ol/source/ImageTile.js";
import { createXYZ } from "ol/tilegrid.js";
import { get as getProjection, transformExtent } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import proj4 from "proj4";
import { TileFactory } from "../lib";
import OSM from "ol/source/OSM";
import TileDebug from "ol/source/TileDebug.js";

export function olDemo() {
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

  const style = getStyle("avenue", {
    pmtiles,
    sprite,
    glyphs,
    lang,
    hidePOIs: true,
    globe: false,
    terrain: { pmtiles: pmtilesTerrain, hillshading: true, encoding: terrainEncoding },
  });

  const TILE_SIZE = 512;
  const DPR = window.devicePixelRatio;

  const tileFactory = new TileFactory(style, {
    imageFormat: "ImageBitmap",
    numberOfRenderers: 3,
    tileSize: TILE_SIZE * DPR, // Physical pixels: 1024 on 4K with 512 logical
    timeout: 30000,
    parentElement: document.getElementById("tiles-debug"),
  });

  // Register LV95
  proj4.defs(
    "EPSG:2056",
    "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 " +
      "+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel " +
      "+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs",
  );
  register(proj4);

  const lv95 = getProjection("EPSG:2056");

  if (!lv95) {
    throw new Error("Failed to get LV95 projection");
  }

  lv95.setExtent(transformExtent([5.96, 45.82, 10.49, 47.81], "EPSG:4326", "EPSG:2056"));

  // Build an explicit 3857 XYZ tile grid so OL knows exactly
  // which zoom level to request for a given resolution.
  const mercatorGrid = createXYZ({
    tileSize: TILE_SIZE * DPR,
    maxZoom: 19,
  });

  const source3857 = new ImageTileSource({
    projection: "EPSG:3857",
    tileGrid: mercatorGrid, // ← explicit grid, no ambiguity
    tileSize: TILE_SIZE * DPR,
    maxZoom: 19,
    zDirection: -1, // ← prefer finer tiles (was backwards before)
    interpolate: true, // ← no blurring between zoom levels

    loader: async (z, x, y, options) => {
      const bitmap = await tileFactory.requestTile<"ImageBitmap">({ z, x, y }, options.signal);

      if (!bitmap) {
        throw new Error(`Failed to load tile ${z}/${x}/${y}`);
      }
      return bitmap;
    },
  });

  // Build the LV95 reprojection grid with resolutions derived from the
  // *same* mercator grid so the zoom-level mapping stays in sync.
  const mercatorResolutions = mercatorGrid.getResolutions();

  // Override resolutions to match mercator (same scale steps, different CRS units).
  // OL uses these to decide which mercator zoom to fetch.
  source3857.setTileGridForProjection(
    "EPSG:2056",
    createXYZ({
      extent: lv95.getExtent(),
      tileSize: TILE_SIZE * DPR,
      maxZoom: 19,
    }),
  );

  const olMap = new OlMap({
    target: "map",
    layers: [
      new TileLayer({
        source: new OSM(),
        opacity: 0.3,
      }),

      new TileLayer({
        source: source3857,
        opacity: 1,
      }),

      new TileLayer({
        source: new TileDebug({
          projection: "EPSG:3857",
          tileGrid: mercatorGrid,
        }),
      }),
    ],
    view: new View({
      projection: "EPSG:2056",
      center: [2600000, 1200000],
      zoom: 10,
      // Tell OL about device pixel ratio so it requests the right zoom:
      resolutions: mercatorResolutions,
    }),
  });

  // When the zoom level changes, queued tiles for the old zoom are useless — flush them.
  olMap.getView().on("change:resolution", () => {
    tileFactory.cancelAllQueued();
  });
}
