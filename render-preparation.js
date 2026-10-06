export async function prepareGalleryRendering(renderer, scene, camera) {
  const textures = new Set();
  scene.traverseVisible((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture && !value.isVideoTexture) textures.add(value);
      }
    }
  });
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  await nextFrame();
  await renderer.compileAsync(scene, camera);
  let batchStart = performance.now();
  for (const texture of textures) {
    if (typeof texture.image?.decode === 'function') await texture.image.decode();
    renderer.initTexture(texture);
    if (performance.now() - batchStart >= 8) {
      await nextFrame();
      batchStart = performance.now();
    }
  }
  await nextFrame();
}
