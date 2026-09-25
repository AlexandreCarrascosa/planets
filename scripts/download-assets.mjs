import { mkdir, writeFile, stat } from "node:fs/promises";
const names = [
  "sun",
  "mercury",
  "venus_atmosphere",
  "earth_daymap",
  "earth_nightmap",
  "earth_clouds",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "moon",
];
const dir = new URL("../public/assets/textures/", import.meta.url);
await mkdir(dir, { recursive: true });
for (let i = 0; i < names.length; i += 4) {
  await Promise.all(
    names.slice(i, i + 4).map(async (name) => {
      const target = new URL(`${name}.jpg`, dir);
      if (
        await stat(target)
          .then((s) => s.size > 1000)
          .catch(() => false)
      )
        return;
      const response = await fetch(
        `https://www.solarsystemscope.com/textures/download/2k_${name}.jpg`,
        { signal: AbortSignal.timeout(60000) },
      );
      if (!response.ok) throw new Error(`${name}: ${response.status}`);
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
      console.log(`Downloaded ${name}`);
    }),
  );
}
