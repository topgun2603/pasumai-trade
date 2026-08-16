"use client";

import { ImagePlusIcon, VideoIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { MAX_IMAGES, MAX_VIDEO_SECONDS } from "@/lib/domain/listing-draft";

export interface PickedFile {
  readonly file: File;
  /** Object URL for the thumbnail. Revoked when the file is dropped. */
  readonly preview: string;
}

/**
 * Reads a video's length without uploading it.
 *
 * The only place the thirty-second rule can actually be enforced: the server
 * would need ffmpeg to know, and by then the bytes have already crossed a
 * village connection. Resolves `null` when the browser cannot read the
 * metadata — some phone codecs — and the caller lets those through rather than
 * refusing a video it simply could not measure.
 */
function durationOf(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };

    video.onloadedmetadata = () =>
      done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    // A codec the browser cannot decode would otherwise hang the form.
    setTimeout(() => done(null), 5000);

    video.src = url;
  });
}

export function MediaPicker({
  images,
  video,
  onImages,
  onVideo,
  onError,
  disabled,
}: {
  images: PickedFile[];
  video: PickedFile | null;
  onImages: (next: PickedFile[]) => void;
  onVideo: (next: PickedFile | null) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  function addImages(list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      onError(`That is ${MAX_IMAGES} photos already.`);
      return;
    }

    const taken = Array.from(list).slice(0, room);
    if (taken.length < list.length) {
      // Said rather than silently dropped: somebody who selected eight photos
      // needs to know which five they got.
      onError(`Only the first ${room} were added — ${MAX_IMAGES} is the limit.`);
    }

    onImages([
      ...images,
      ...taken.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  }

  async function addVideo(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;

    setReading(true);
    const seconds = await durationOf(file);
    setReading(false);

    if (seconds !== null && seconds > MAX_VIDEO_SECONDS + 1) {
      onError(
        `That video is ${Math.round(seconds)} seconds. Keep it to ${MAX_VIDEO_SECONDS} or trim it first.`,
      );
      return;
    }

    onVideo({ file, preview: URL.createObjectURL(file) });
  }

  function dropImage(index: number) {
    URL.revokeObjectURL(images[index].preview);
    onImages(images.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">Photos</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {images.length} of {MAX_IMAGES}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {images.map((picked, index) => (
            <div
              key={picked.preview}
              className="border-border relative aspect-square overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a local
                  object URL, not a remote asset; next/image cannot optimise it
                  and would only add a loader in front of a blob. */}
              <img
                src={picked.preview}
                alt={`Photo ${index + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => dropImage(index)}
                aria-label={`Remove photo ${index + 1}`}
                className="bg-background/85 hover:bg-background absolute top-1 right-1 rounded-full p-1"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}

          {images.length < MAX_IMAGES ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => imageInput.current?.click()}
              className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs transition-colors disabled:opacity-50"
            >
              <ImagePlusIcon className="size-5" />
              Add
            </button>
          ) : null}
        </div>

        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          multiple
          // `capture` is deliberately absent: on a phone this keeps both the
          // camera and the gallery available, and most farmers photograph the
          // crop before they think to list it.
          className="hidden"
          onChange={(e) => {
            addImages(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-muted-foreground text-xs">
          Buyers decide on these. Show the crop close up, and the whole lot.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Video <span className="text-muted-foreground font-normal">— optional</span>
        </span>

        {video ? (
          <div className="border-border flex items-center gap-3 rounded-md border p-2">
            <video
              src={video.preview}
              className="bg-secondary h-16 w-24 rounded object-cover"
              muted
              playsInline
            />
            <span className="min-w-0 flex-1 truncate text-sm">{video.file.name}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                URL.revokeObjectURL(video.preview);
                onVideo(null);
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || reading}
            onClick={() => videoInput.current?.click()}
            className="justify-start"
          >
            <VideoIcon className="size-4" />
            {reading ? "Checking length…" : `Add a ${MAX_VIDEO_SECONDS}-second video`}
          </Button>
        )}

        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            void addVideo(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
