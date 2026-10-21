import ffprobe from "@ffprobe-installer/ffprobe";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

export async function prepareVideo(file: File) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Each video must be 10 MB or smaller.");
  if (!["video/mp4", "video/webm"].includes(file.type)) throw new Error("Choose an MP4 or WebM video.");
  const folder = await mkdtemp(join(tmpdir(), "business-collab-video-"));
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = join(folder, "upload");
    await writeFile(path, bytes);
    const { stdout } = await run(process.env.FFPROBE_PATH || ffprobe.path, [
      "-v", "error", "-protocol_whitelist", "file", "-show_streams", "-show_format", "-of", "json", path,
    ], { timeout: 10_000, maxBuffer: 256 * 1024 });
    const info = JSON.parse(stdout);
    const stream = info.streams?.find((item: { codec_type: string }) => item.codec_type === "video");
    const duration = Number(info.format?.duration ?? stream?.duration);
    const compatible = file.type === "video/mp4"
      ? info.format?.format_name?.includes("mp4") && stream?.codec_name === "h264"
      : info.format?.format_name?.includes("webm") && ["vp8", "vp9"].includes(stream?.codec_name);
    if (!compatible || !stream?.width || !stream?.height || !Number.isFinite(duration) || duration <= 0 || duration > 120) {
      throw new Error("Invalid video");
    }
    return { data: bytes, contentType: file.type };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("Video processing is unavailable. Please try again later.");
    throw new Error("Choose a playable MP4 (H.264) or WebM (VP8/VP9) video, up to 2 minutes long.");
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
