import type { TileData } from "@/components/VideoTile";
import { formatPrice } from "./format";
import { priceFor } from "./geo";
import { videoTitle, type Locale } from "./i18n";
import type { Currency, Video } from "./types";

export function toTile(v: Video, locale: Locale, opts: { currency?: Currency; href?: string } = {}): TileData {
  return {
    href: opts.href ?? `/v/${v.slug}`,
    title: videoTitle(v, locale),
    meta: opts.currency ? formatPrice(priceFor(v, opts.currency), opts.currency) : "",
    cover: v.cover_url,
    trailer: v.trailer_url,
    width: v.width || 16,
    height: v.height || 9,
  };
}
