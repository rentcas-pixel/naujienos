import type { RelatedImage } from "@/lib/types";

interface ResponseImageProps {
  image: RelatedImage;
}

export function ResponseImage({ image }: ResponseImageProps) {
  return (
    <figure className="my-3 rounded-lg overflow-hidden border border-black/5 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.caption}
        className="w-full max-h-64 object-cover"
        loading="lazy"
      />
      <figcaption className="px-3 py-2 text-xs text-gray-500 flex justify-between gap-2">
        <span>{image.caption}</span>
        {image.sourceUrl && (
          <a
            href={image.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-blue-600 hover:underline"
          >
            Šaltinis
          </a>
        )}
      </figcaption>
    </figure>
  );
}
