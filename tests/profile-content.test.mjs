import { test } from "node:test";
import assert from "node:assert/strict";
import { missingProfileContent, readByteRange } from "../src/lib/profile-content.ts";
import { prepareVideo } from "../src/lib/video.ts";

test("publishing requires logo, both video types and two to five work photos", () => {
  assert.equal(missingProfileContent(true, ["INTRODUCTION", "SHOWCASE", "PHOTO", "PHOTO"]).length, 0);
  assert.equal(missingProfileContent(true, ["INTRODUCTION", "SHOWCASE", ...Array(5).fill("PHOTO")]).length, 0);
  assert.ok(missingProfileContent(false, ["INTRODUCTION", "SHOWCASE", "PHOTO", "PHOTO"]).length);
  assert.ok(missingProfileContent(true, ["INTRODUCTION", "PHOTO", "PHOTO"]).length);
  assert.ok(missingProfileContent(true, ["INTRODUCTION", "SHOWCASE", "PHOTO"]).length);
  assert.ok(missingProfileContent(true, ["INTRODUCTION", "SHOWCASE", ...Array(6).fill("PHOTO")]).length);
});

test("video range requests support bounded, open-ended and suffix ranges", () => {
  assert.deepEqual(readByteRange("bytes=0-99", 1000), {start: 0, end: 99});
  assert.deepEqual(readByteRange("bytes=900-", 1000), {start: 900, end: 999});
  assert.deepEqual(readByteRange("bytes=-100", 1000), {start: 900, end: 999});
  for (const value of ["bytes=1000-", "bytes=9-2", "bytes=0-1,3-4", "bytes=-0", "bytes=-"]) assert.equal(readByteRange(value, 1000), null);
});

test("rejects fake, oversized and unsupported videos", async () => {
  await assert.rejects(prepareVideo(new File(["not video"], "fake.mp4", {type:"video/mp4"})), /playable/);
  await assert.rejects(prepareVideo(new File(["fake"], "other.mov", {type:"video/quicktime"})), /MP4 or WebM/);
  await assert.rejects(prepareVideo(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.mp4", {type:"video/mp4"})), /10 MB/);
});
