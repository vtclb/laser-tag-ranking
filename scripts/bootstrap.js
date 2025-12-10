import { VERSION } from "./version.js";
import "./snow.js";

async function loadModule(name) {
  const mod = await import(`./${name}?v=${VERSION}`);
  console.log("[BOOT] loaded", name, mod);

  // Автоматичний запуск, якщо в модулі є main/initRanking
  if (typeof mod.initRanking === "function") {
    console.log("[BOOT] calling initRanking()");
    mod.initRanking();
  }
  if (typeof mod.main === "function") {
    console.log("[BOOT] calling main()");
    mod.main();
  }
}

(async () => {
  await loadModule("config.js");
  await loadModule("api.js");
  await loadModule("avatars.client.js");
  await loadModule("quickStats.js");
  await loadModule("ranking.js"); // ← САМЕ ВАЖЛИВИЙ МОДУЛЬ
})();
