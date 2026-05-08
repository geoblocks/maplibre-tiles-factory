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

const SOURCES: Record<string, () => Promise<maplibregl.StyleSpecification>> = {
  "Avenue (PMTiles)": async () =>
    getStyle("avenue", {
      pmtiles,
      sprite,
      glyphs,
      lang,
      hidePOIs: true,
      globe: false,
      terrain: { pmtiles: pmtilesTerrain, hillshading: true, encoding: terrainEncoding },
    }),
  "Swisstopo Light": async () => {
    const response = await fetch(
      "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json",
    );
    return response.json();
  },
};

export async function olDemo() {
  maplibregl.addProtocol("pmtiles", new Protocol().tile);

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

  const mercatorGrid = createXYZ({
    tileSize: TILE_SIZE * DPR,
    maxZoom: 19,
  });

  const initialStyleName = Object.keys(SOURCES)[0];
  const initialStyle = await SOURCES[initialStyleName]();

  let reprojectedSource = new MapLibreReprojectedSource(initialStyle, {
    tileSize: TILE_SIZE,
    dpr: DPR,
    reprojectionProjection: lv95,
    numberOfRenderers: 3,
    timeout: 30000,
    parentElement: document.getElementById("tiles-debug"),
  });

  const maplibreLayer = new TileLayer({
    source: reprojectedSource.source,
    opacity: 1,
  });

  const olMap = new OlMap({
    target: "map",
    layers: [
      new TileLayer({
        source: new OSM(),
        opacity: 0.3,
      }),
      maplibreLayer,
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

  // Floating source selector
  const select = document.createElement("select");
  Object.assign(select.style, {
    position: "absolute",
    top: "12px",
    right: "12px",
    zIndex: "1000",
    padding: "6px 10px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    background: "white",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  });

  for (const name of Object.keys(SOURCES)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }

  select.value = initialStyleName;

  select.addEventListener("change", async () => {
    const styleName = select.value;
    const styleLoader = SOURCES[styleName];
    if (!styleLoader) return;

    select.disabled = true;
    try {
      const newStyle = await styleLoader();
      reprojectedSource.destroy();
      reprojectedSource = new MapLibreReprojectedSource(newStyle, {
        tileSize: TILE_SIZE,
        dpr: DPR,
        reprojectionProjection: lv95,
        numberOfRenderers: 3,
        timeout: 30000,
        parentElement: document.getElementById("tiles-debug"),
      });
      maplibreLayer.setSource(reprojectedSource.source);
    } finally {
      select.disabled = false;
    }
  });

  const mapElement = document.getElementById("map");
  if (mapElement) {
    mapElement.style.position = "relative";
    mapElement.appendChild(select);
  }
}
