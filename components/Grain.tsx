"use client";
import { useEffect } from "react";

/** 128px of monochrome noise, generated in the browser. Nothing is downloaded. */
export default function Grain() {
  useEffect(() => {
    const el = document.getElementById("grain");
    if (!el) return;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const img = x.createImageData(128, 128);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    el.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
  }, []);
  return <div id="grain" aria-hidden="true" />;
}
