import maplibregl from "maplibre-gl";
import { getStyle } from "basemapkit";
import { Protocol } from "pmtiles";
import { pmtiles, sprite, glyphs, lang, pmtilesTerrain, terrainEncoding } from "./constants";
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import { get as getProjection, transformExtent } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import proj4 from "proj4";
import OSM from "ol/source/OSM";
import TileDebug from "ol/source/TileDebug.js";
import { createXYZ } from "ol/tilegrid.js";
import { MapLibreReprojectedSource } from "./MapLibreReprojectedSource";

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

  const reprojectedSource = new MapLibreReprojectedSource(style, {
    tileSize: TILE_SIZE,
    dpr: DPR,
    reprojectionProjection: lv95,
    numberOfRenderers: 3,
    timeout: 30000,
    parentElement: document.getElementById("tiles-debug"),
  });

  // Keep a reference to the mercator grid for TileDebug and View resolutions.
  const mercatorGrid = createXYZ({
    tileSize: TILE_SIZE * DPR,
    maxZoom: 19,
  });

  const olMap = new OlMap({
    target: "map",
    layers: [
      new TileLayer({
        source: new OSM(),
        opacity: 0.3,
      }),

      new TileLayer({
        source: reprojectedSource.source,
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
      resolutions: mercatorGrid.getResolutions(),
    }),
  });

  // When the zoom level changes, queued tiles for the old zoom are useless — flush them.
  olMap.getView().on("change:resolution", () => {
    reprojectedSource.cancelAllQueued();
  });
}
