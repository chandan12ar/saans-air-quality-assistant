import type { NaqiBand } from "@/engine";
import { BAND_ICON, BAND_LABEL, type Language } from "@/lib/labels";
import { BAND_COLOR } from "./airTheme";

/** A band shown as a CPCB-coloured shape plus its name, so colour is never the only signal. */
export function Band({ band, lang }: { band: NaqiBand; lang: Language }) {
  return (
    <span className="band">
      <span className="band-glyph" style={{ color: BAND_COLOR[band] }} aria-hidden="true">
        {BAND_ICON[band]}
      </span>
      {BAND_LABEL[lang][band]}
    </span>
  );
}
