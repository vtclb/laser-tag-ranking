const canvas = document.getElementById("snow-canvas");
if (canvas) {
  const ctx = canvas.getContext("2d");
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const flakes = Array.from({ length: 60 }).map(() => ({
    x: Math.random() * w,
    y: Math.random() * h,
    s: Math.random() * 2 + 1,
    v: Math.random() * 0.5 + 0.3,
  }));

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";

    for (const f of flakes) {
      ctx.fillRect(f.x, f.y, 2, 2); // Піксельна сніжинка
      f.y += f.v;
      if (f.y > h) {
        f.y = -2;
        f.x = Math.random() * w;
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}
