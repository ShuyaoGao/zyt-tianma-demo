/*
 * 高斯泼溅场景 · 中艺堂演示
 *
 * 两个页面共用:viewer.html(自由转动)与 scroll.html(滚动驱动环绕)。
 * 模型的摆放参数在 models/<名>.json 里(由 tools/prepare_model.py 生成):
 *   重建出来的坐标系是相机坐标系(y 朝下、作品不在原点),这里统一摆成
 *   "底座落在原点、y 朝上、高度约 1",页面只需要按角度和距离摆相机。
 */
import * as pc from "playcanvas";

export async function loadMeta(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`读取 ${url} 失败(${r.status})`);
  return r.json();
}

export function createApp(canvas, { input = false, bg = [0.043, 0.09, 0.157] } = {}) {
  const opts = { graphicsDeviceOptions: { antialias: false, alpha: false } };
  if (input) {
    opts.mouse = new pc.Mouse(canvas);
    opts.touch = new pc.TouchDevice(canvas);
    opts.keyboard = new pc.Keyboard(window);
  }
  const app = new pc.Application(canvas, opts);
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) app.resizeCanvas(w, h);
    app.renderNextFrame = true;
  };
  new ResizeObserver(fit).observe(canvas);
  fit();
  app.start();

  const camera = new pc.Entity("camera");
  camera.addComponent("camera", {
    clearColor: new pc.Color(bg[0], bg[1], bg[2]),
    fov: 32, nearClip: 0.02, farClip: 40,
  });
  app.root.addChild(camera);
  return { app, camera };
}

/** 加载 PLY 并按 meta 摆放;onProgress(0..1) 报告下载进度。 */
export async function addModel(app, meta, base, onProgress, parent = null) {
  const url = new URL(meta.file, base).href;
  const asset = await new Promise((ok, fail) => {
    const a = new pc.Asset("model", "gsplat", { url });
    a.on("error", (e) => fail(new Error(String(e))));
    a.on("progress", (got, total) => total && onProgress && onProgress(got / total));
    a.ready(() => ok(a));
    app.assets.add(a);
    app.assets.load(a);
  });
  const ent = new pc.Entity("splat");
  ent.addComponent("gsplat", { asset });
  const T = meta.transform;
  ent.setLocalScale(T.scale, T.scale, T.scale);
  ent.setLocalRotation(new pc.Quat(T.rotation[0], T.rotation[1], T.rotation[2], T.rotation[3]));
  ent.setLocalPosition(T.position[0], T.position[1], T.position[2]);
  (parent || app.root).addChild(ent);
  app.renderNextFrame = true;
  return { entity: ent, asset, splats: meta.splats };
}

const D2R = Math.PI / 180;

/**
 * 按画面比例调整距离:竖屏(手机)横向视野窄,作品(翼展比高度还宽)会被左右裁掉。
 * 竖直视场角 fovDeg 下,让宽度 width 的作品横向只占画面 fill 比例。
 */
export function fitDistance(base, canvas, fovDeg = 32, width = 1.3, fill = 0.9) {
  const aspect = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
  const need = width / fill / (2 * aspect * Math.tan(fovDeg * D2R / 2));
  return Math.max(base, need);
}

/** 把相机放在以 target 为中心、给定方位角/仰角/距离的位置上。方位角 0 = 拍摄起点。 */
export function placeOrbit(camera, target, azimuthDeg, elevationDeg, distance) {
  const az = azimuthDeg * D2R, el = elevationDeg * D2R;
  const x = target[0] + distance * Math.cos(el) * Math.sin(az);
  const y = target[1] + distance * Math.sin(el);
  const z = target[2] + distance * Math.cos(el) * Math.cos(az);
  camera.setPosition(x, y, z);
  camera.lookAt(target[0], target[1], target[2]);
}

export { pc };
