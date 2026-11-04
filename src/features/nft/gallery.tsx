import { useEffect, useId, useRef, useState } from "react";
import zoom from "@/assets/nft/zoom.svg";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { NftGalleryImage } from "@/shared/domain/contracts";

type GalleryProps = {
  title: string;
  images: NftGalleryImage[];
};

export function NftGallery({ title, images }: GalleryProps) {
  const [activeId, setActiveId] = useState(images[0]?.id ?? "");
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomTriggerRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const active = images.find((item) => item.id === activeId) ?? images[0];

  useEffect(() => {
    if (!images.some((item) => item.id === activeId) && images[0]) {
      setActiveId(images[0].id);
    }
  }, [images, activeId]);

  if (!active) return null;

  return (
    <div className="relative flex gap-7 lg:h-[448px] lg:w-[573px]">
      <div className="hidden w-[100px] shrink-0 flex-col gap-4 lg:flex" role="group" aria-labelledby={labelId}>
        <p id={labelId} className="sr-only">
          Galeria de imagens
        </p>
        {images.map((item, index) => {
          const selected = active.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Ver imagem ${index + 1}`}
              aria-pressed={selected}
              onClick={() => setActiveId(item.id)}
              className={`size-[100px] overflow-hidden rounded-lg bg-surface-card focus-visible:outline-2 focus-visible:outline-primary ${
                selected ? "border border-primary" : ""
              }`}
            >
              <img src={item.url} alt="" className="size-full object-cover" />
            </button>
          );
        })}
      </div>

      <div className="flex w-full items-center justify-center rounded-[24px] bg-gradient-to-br from-surface-card to-[#2F1D15] p-0 max-lg:h-[356px] lg:size-[444px] lg:rounded-md lg:bg-surface-card lg:bg-none lg:p-4">
        <button
          type="button"
          className="size-full focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`Ampliar ${active.alt || title}`}
          onClick={() => setZoomOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setZoomOpen(true);
            }
          }}
        >
          <img
            src={active.url}
            alt={active.alt || title}
            className="size-full rounded-[24px] object-cover lg:size-[404px]"
          />
        </button>
      </div>

      <button
        ref={zoomTriggerRef}
        type="button"
        aria-label="Ampliar imagem"
        className="absolute right-3 top-3 lg:left-[530px] lg:right-auto lg:top-[15px]"
        onClick={() => setZoomOpen(true)}
      >
        <img src={zoom} alt="" />
      </button>

      <Dialog
        open={zoomOpen}
        onOpenChange={(open) => {
          setZoomOpen(open);
          if (!open) queueMicrotask(() => zoomTriggerRef.current?.focus());
        }}
      >
        <DialogContent className="max-w-[90vw] border-border bg-ink p-3 sm:max-w-[640px]" showClose>
          <DialogTitle className="sr-only">{active.alt || title}</DialogTitle>
          <img src={active.url} alt={active.alt || title} className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
