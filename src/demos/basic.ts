import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { getStyle } from "basemapkit";
import { Protocol } from "pmtiles";
import { pmtiles, sprite, glyphs, lang, pmtilesTerrain, terrainEncoding } from "./constants";
import { wrapTileIndex } from "../lib";
import type { TileIndex } from "../lib";
import { TileFactory } from "../lib";

export async function basicDemo() {
  const snapButton = document.getElementById("snap-bt") as HTMLButtonElement;
  const debugButton = document.getElementById("debug-bt") as HTMLButtonElement;
  const snapContainer = document.getElementById("snap-container") as HTMLDivElement;
  if (!snapButton) return;
  if (!snapContainer) return;

  let tileIndex: TileIndex | undefined;

  document.getElementById("tile-index-input")?.addEventListener("input", ({ target }) => {
    const value = (target as HTMLInputElement).value;
    const members = value.split("/").map((el) => Number.parseInt(el, 10));
    tileIndex = undefined;

    if (members.length !== 3) {
      snapButton.disabled = true;
      return;
    }

    if (members.some((el) => Number.isNaN(el))) {
      snapButton.disabled = true;
      return;
    }

    const wrappedTileIndex = wrapTileIndex({ z: members[0], x: members[1], y: members[2] });

    if (!wrappedTileIndex) {
      snapButton.disabled = true;
      return;
    }

    tileIndex = wrappedTileIndex;
    snapButton.disabled = false;
  });

  snapButton.addEventListener("pointerup", async () => {
    if (!tileIndex) return;

    console.time("create object URL");

    const res = await tileFactory.requestTile<"PngObjectUrl">(tileIndex);
    const img = document.createElement("img");

    if (!res) {
      img.alt = "Tile index out of range";
      snapContainer.append(img);
      return;
    }
    img.src = res.url;
    snapContainer.append(img);
  });

  debugButton.addEventListener("pointerup", async () => {
    snapContainer.innerHTML = "";
    let total = 0;
    let done = 0;
    const z = 7;

    const n = 5;

    console.time("chrono");
    // for (let x = 62; x < 68; x += 1) {
    //   for (let y = 43; y < 49; y += 1) {

    for (let x = 62; x < 62 + n; x += 1) {
      for (let y = 43; y < 43 + n; y += 1) {
        total += 1;

        tileFactory.requestTile<"PngObjectUrl">({ z, x, y }).then((res) => {
          done += 1;
          if (!res) return;
          const img = document.createElement("img");
          img.src = res.url;
          img.alt = `${z}/${x}/${y}`;
          snapContainer.append(img);

          console.log("done: ", done, "/", total);

          if (done === total) {
            console.timeEnd("chrono");
          }
        });
      }
    }

    // console.time("generate")
    // const res = await Promise.allSettled(proms)
    // console.timeEnd("generate")
    // console.log(res);

    // for (const p of res) {
    //   if (p.status !== 'fulfilled') {
    //     continue
    //   }

    //   const img = document.createElement('img')
    //   img.src = p.value.url
    //   snapContainer.append(img)
    // }
  });

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
    },
  });

  const tileFactory = new TileFactory(style, {
    imageFormat: "PngObjectUrl",
    numberOfRenderers: 6,
    tileSize: 1000,
    timeout: 30000,
  });
}
