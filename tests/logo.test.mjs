import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareLogo, MAX_LOGO_BYTES } from "../src/lib/logo.ts";

test("valid logo is decoded, resized and normalised", async () => {
  const bytes = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#444444" } }).png().toBuffer();
  const logo = await prepareLogo(new File([bytes], "logo.png", { type: "image/png" }));
  const metadata = await sharp(logo).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 341);
  assert.equal(metadata.exif, undefined);
});

test("rejects oversized, unsupported and fake images", async () => {
  await assert.rejects(prepareLogo(new File([new Uint8Array(MAX_LOGO_BYTES + 1)], "big.png", {type: "image/png"})), /2 MB/);
  await assert.rejects(prepareLogo(new File(["<svg></svg>"], "logo.svg", {type: "image/svg+xml"})), /JPG, PNG or WebP/);
  await assert.rejects(prepareLogo(new File(["not an image"], "fake.png", {type: "image/png"})), /could not be read/);
});
