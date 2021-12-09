import fs from "fs/promises";
import path from "path";
import { ArgumentParser } from "argparse";
import nc from "canvas";
import * as d3 from "d3";

function improveLayout(words) {
  const simulation = d3
    .forceSimulation(words)
    .force("charge", d3.forceManyBody().strength(10))
    .force(
      "collide",
      d3
        .forceCollide()
        .radius(({ r }) => r + 1)
        .iterations(30)
    )
    .force("x", d3.forceX(0))
    .force("y", d3.forceY(0));
  simulation.tick(300).stop();
}

function visualize(words, { minR, maxR, screenSize }) {
  const rScale = d3
    .scaleLinear()
    .domain(d3.extent(words, ({ score }) => score))
    .range([minR, maxR]);
  for (const word of words) {
    word.x *= 500000;
    word.y *= 500000;
    word.r = rScale(word.score);
  }

  improveLayout(words);

  const left = d3.min(words, (word) => word.x - word.r);
  const right = d3.max(words, (word) => word.x + word.r);
  const top = d3.min(words, (word) => word.y - word.r);
  const bottom = d3.max(words, (word) => word.y + word.r);
  const width = right - left;
  const height = bottom - top;
  const contentSize = Math.max(width, height);
  const scale = screenSize / contentSize;

  for (const word of words) {
    word.x -= left + width / 2;
    word.x *= scale;
    word.y -= top + height / 2;
    word.y *= scale;
    word.r *= scale;
  }
}

function optimalFontSize(word, r, fontFamily, fontWeight) {
  const canvas = nc.createCanvas();
  const ctx = canvas.getContext("2d");
  let ok = 0;
  let ng = 100;
  for (let iter = 0; iter < 10; ++iter) {
    let m = (ok + ng) / 2;
    ctx.font = `${fontWeight} ${m}px ${fontFamily}`;
    const d = Math.sqrt(ctx.measureText(word).width ** 2 + m ** 2) / 2;
    if (d <= r) {
      ok = m;
    } else {
      ng = m;
    }
  }
  return ok;
}

function renderChart(data) {
  const contentSize = 1980;
  const margin = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  };
  const width = contentSize + margin.left + margin.right;
  const height = contentSize + margin.top + margin.bottom;
  const fontFamily = `'Sawarabi Gothic', sans-serif`;
  const fontWeight = "normal";

  const canvas = nc.createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const words = [...data];
  visualize(words, { minR: 3, maxR: 30, screenSize: contentSize });

  const color = d3.scaleOrdinal(d3.schemeCategory10);
  for (const word of words) {
    word.fontSize = optimalFontSize(word.word, word.r);
    word.color = color(word.group);
  }

  ctx.translate(margin.left, margin.top);
  ctx.translate(contentSize / 2, contentSize / 2);
  for (const word of words) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(word.x, word.y);
    ctx.fillStyle = word.color;
    ctx.arc(0, 0, word.r, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "ghostwhite";
    ctx.font = `${fontWeight} ${word.fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(word.word, 0, 0);
    ctx.restore();
  }

  return { canvas, words };
}

nc.registerFont("./SawarabiGothic-Regular.ttf", {
  family: "Sawarabi Gothic",
});
const parser = new ArgumentParser();
parser.add_argument("--dest", { default: "." });
parser.add_argument("filenames", { nargs: "+" });
const { filenames, dest } = parser.parse_args();
await fs.mkdir(dest, { recursive: true });
for (const filename of filenames) {
  const basename = path.basename(filename, ".json");
  const data = JSON.parse(await fs.readFile(filename));
  const { canvas, words } = renderChart(data);
  fs.writeFile(
    path.join(dest, `${basename}.output.png`),
    canvas.toBuffer("image/png")
  );
  fs.writeFile(
    path.join(dest, `${basename}.output.json`),
    JSON.stringify(words)
  );
}
