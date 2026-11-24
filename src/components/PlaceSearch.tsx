"use client";

import { useId, useState } from "react";
import type { PlaceChoice } from "./formState";
import type { Translate } from "./i18n";

interface Props {
  t: Translate;
  place: PlaceChoice | null;
  onPick: (place: PlaceChoice) => void;
}

type Status = "idle" | "searching" | "locating" | "empty" | "error" | "denied" | "unsupported";

export function PlaceSearch({ t, place, onPick }: Props) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceChoice[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");

  async function search() {
    const q = query.trim();
    if (q.length < 2) return;
    setStatus("searching");
    setResults([]);
    try {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: PlaceChoice[]; error?: { message: string } };
      if (!res.ok) {
        setErrorText(json.error?.message ?? t("networkError"));
        setStatus("error");
        return;
      }
      const found = json.results ?? [];
      setResults(found);
      setStatus(found.length ? "idle" : "empty");
    } catch {
      setErrorText(t("networkError"));
      setStatus("error");
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to ~1 km: the air data is regional model output, so more precision adds nothing.
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        onPick({ label: `${t("myLocation")} (${lat}, ${lon})`, lat, lon });
        setResults([]);
        setStatus("idle");
      },
      () => setStatus("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  const message =
    status === "searching"
      ? t("searching")
      : status === "locating"
        ? t("locating")
        : status === "empty"
          ? t("noPlaces")
          : status === "error"
            ? errorText
            : status === "denied"
              ? t("geoDenied")
              : status === "unsupported"
                ? t("geoUnsupported")
                : "";

  return (
    <div className="place">
      <label htmlFor={inputId}>{t("placeSearch")}</label>
      <div className="row">
        <input
          id={inputId}
          type="search"
          value={query}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button type="button" className="btn secondary" onClick={() => void search()} disabled={query.trim().length < 2 || status === "searching"}>
          {t("search")}
        </button>
      </div>
      <button type="button" className="btn link" onClick={locate} disabled={status === "locating"}>
        {t("useLocation")}
      </button>
      <p role="status" className="hint">
        {message}
      </p>
      {results.length > 0 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon},${r.label}`}>
              <button
                type="button"
                className="pick"
                onClick={() => {
                  onPick(r);
                  setResults([]);
                  setQuery("");
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {place && (
        <p className="selected">
          <span className="sr-label">{t("placeSelected")}: </span>
          <strong>{place.label}</strong>
        </p>
      )}
    </div>
  );
}
