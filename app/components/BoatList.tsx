"use client";

import { useMemo, useState } from "react";

export type Boat = {
  id?: string | number;
  name?: string;
  rating?: number | string;
  model?: string;
  serviceType?: string;
  boatType?: string;
  base?: string;
  country?: string;
  lengthFt?: number | string;

  image?: string;

  pdfPhotosUrl?: string;
  webUrl?: string;

  defaultCurrency?: string;
  defaultPrice?: number;
};

type Props = {
  boats: Boat[];
  itineraries?: { id: string; title: string }[];
};

type Lang = "en" | "es" | "pt" | "it" | "fr" | "de";

const DEFAULT_FINAL_NOTES: Record<Lang, string> = {
  en: `Please note:

For some yachts, port fees in Capri of €100 - €200 (for 60 feet vessels) are not included.
Availabilities might change from the moment we send the quote to the moment you actually confirm. We will need to set a date to fully confirm availability.
We will be more than happy to assist you by booking your preferred restaurant for the day.`,
  es: `Nota:

Para algunos yates, las tasas de puerto en Capri de €100 - €200 (para embarcaciones de 60 pies) no están incluidas.
La disponibilidad puede cambiar entre el envío del presupuesto y la confirmación. Necesitaremos fijar una fecha para confirmarla.
Estaremos encantados de ayudarte reservando tu restaurante preferido para ese día.`,
  pt: `Nota:

Para alguns iates, as taxas de porto em Capri de €100 - €200 (para embarcações de 60 pés) não estão incluídas.
A disponibilidade pode mudar entre o envio do orçamento e a confirmação. Precisaremos definir uma data para confirmar.
Teremos todo o prazer em ajudar reservando o seu restaurante preferido para o dia.`,
  it: `Nota:

Per alcuni yacht, le tasse portuali a Capri di €100 - €200 (per imbarcazioni di 60 piedi) non sono incluse.
La disponibilità può cambiare tra l’invio del preventivo e la conferma. Dovremo fissare una data per confermare.
Saremo felici di aiutarti prenotando il tuo ristorante preferito per la giornata.`,
  fr: `Veuillez noter :

Pour certains yachts, les frais de port à Capri de 100 € à 200 € (pour des bateaux d’environ 60 pieds) ne sont pas inclus.
Les disponibilités peuvent changer entre l’envoi du devis et votre confirmation. Nous devrons fixer une date pour confirmer définitivement la disponibilité.
Nous serons ravis de vous aider en réservant votre restaurant préféré pour la journée.`,
  de: `Bitte beachten:

Für einige Yachten sind die Hafen-/Liegegebühren in Capri von 100–200 € (für Boote um 60 Fuß) nicht inbegriffen.
Verfügbarkeiten können sich zwischen Versand des Angebots und Ihrer Bestätigung ändern. Wir müssen ein Datum festlegen, um die Verfügbarkeit final zu bestätigen.
Gerne unterstützen wir Sie dabei, Ihr bevorzugtes Restaurant für den Tag zu reservieren.`,
};

function Stars({ rating }: { rating?: number | string }) {
  const n = Number(rating ?? 0);
  const full = Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0;
  return (
    <span style={{ letterSpacing: 2, whiteSpace: "nowrap" }}>
      {"★".repeat(full)}
      <span style={{ opacity: 0.25 }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

function Pill({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <span
      title={text}
      style={{
        display: "inline-block",
        maxWidth: "100%",
        padding: "4px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        fontSize: 12,
        lineHeight: "16px",
        color: "#111827",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {text}
    </span>
  );
}

function toKey(b: Boat, idx: number) {
  return String(b.id ?? `idx-${idx}`);
}

/// parses: "1.200" "1.200,50" "1200,50" "1200.50" "2.000" -> 2000
function parseMoney(input: string): number {
  let s = String(input ?? "").trim();
  if (!s) return NaN;

  s = s.replace(/[^\d.,-]/g, "").replace(/\s/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      return Number(s.replace(/\./g, "").replace(",", "."));
    } else {
      return Number(s.replace(/,/g, ""));
    }
  }

  if (hasComma) return Number(s.replace(/\./g, "").replace(",", "."));

  if (hasDot) {
    const thousandsLike = /^-?\d{1,3}(\.\d{3})+$/;
    if (thousandsLike.test(s)) return Number(s.replace(/\./g, ""));
    return Number(s);
  }

  return Number(s);
}

// simple email validation (enough for UI)
function isValidEmail(email: string) {
  const e = email.trim();
  if (!e) return true; // empty is ok (optional)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ---- scroll clamp helpers (horizontal) ----
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function BoatList({ boats, itineraries = [] }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // proposal config
  const [language, setLanguage] = useState<Lang>("en");
  const [currency, setCurrency] = useState<string>("EUR");
  const [brokerMessage, setBrokerMessage] = useState<string>("");
  const [selectedItineraries, setSelectedItineraries] = useState<Set<string>>(new Set());

  // client
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");

  // prices per boat
  const [priceById, setPriceById] = useState<Record<string, string>>({});

  // note per boat
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  // final notes per language
  const [finalNotesEnabled, setFinalNotesEnabled] = useState<boolean>(true);
  const [finalNotesByLang, setFinalNotesByLang] = useState<Record<Lang, string>>(
    () => ({ ...DEFAULT_FINAL_NOTES })
  );
  const [finalNotesTouchedByLang, setFinalNotesTouchedByLang] = useState<Record<Lang, boolean>>(
    () => ({ en: false, es: false, pt: false, it: false, fr: false, de: false })
  );

  const finalNotes = finalNotesByLang[language] ?? DEFAULT_FINAL_NOTES[language];

  // send
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  const selectedBoats = useMemo(() => {
    return boats.filter((b, idx) => selected.has(toKey(b, idx)));
  }, [boats, selected]);

  const selectedIds = useMemo(() => {
    return selectedBoats
      .map((b) => b.id)
      .filter((id): id is string | number => id !== undefined && id !== null)
      .map(String);
  }, [selectedBoats]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(boats.map(toKey)));
  }

  function clearAll() {
    setSelected(new Set());
    setPriceById({});
    setNoteById({});
    setSelectedItineraries(new Set());
    setSendResult(null);

    setFinalNotesEnabled(true);
    setFinalNotesByLang({ ...DEFAULT_FINAL_NOTES });
    setFinalNotesTouchedByLang({ en: false, es: false, pt: false, it: false, fr: false, de: false });
  }

  function setPrice(id: string, value: string) {
    setPriceById((prev) => ({ ...prev, [id]: value }));
  }

  function toggleItinerary(id: string) {
    setSelectedItineraries((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function onChangeLanguage(nextLang: Lang) {
    setLanguage(nextLang);

    setFinalNotesByLang((prev) => {
      if (prev[nextLang] != null) return prev;
      return { ...prev, [nextLang]: DEFAULT_FINAL_NOTES[nextLang] ?? "" };
    });
  }

  function validateProposal() {
    if (selectedIds.length === 0) return "You haven't selected any boats.";
    if (!isValidEmail(clientEmail)) return "Client email is not valid.";

    for (const id of selectedIds) {
      const raw = (priceById[id] ?? "").trim();
      if (!raw) return `Missing price for boat id=${id}.`;
      const n = parseMoney(raw);
      if (!Number.isFinite(n) || n <= 0) return `Invalid price for boat id=${id}.`;
    }

    return null;
  }

  async function createProposal() {
    const err = validateProposal();
    if (err) {
      setSendResult({ ok: false, error: err });
      return;
    }

    const boatsPayload = selectedIds.map((id) => ({
      id,
      price: parseMoney(priceById[id]),
      currency,
      priceNote: (noteById[id] ?? "").trim() || null,
    }));

    const payload = {
      language,
      boats: boatsPayload,
      client: {
        name: clientName.trim() || null,
        email: clientEmail.trim() || null,
      },
      cta: {
        messageFromBroker: brokerMessage,
        clientNoteEnabled: true,
        finalNotes: finalNotesEnabled ? (finalNotes.trim() || null) : null,
      },
      itineraries: Array.from(selectedItineraries).map((id) => ({ id })),
      meta: {
        source: "next-ui",
        proposalId: (globalThis.crypto as any)?.randomUUID?.() ?? String(Date.now()),
        timestamp: new Date().toISOString(),
      },
    };

    try {
      setSending(true);
      setSendResult(null);

      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      setSendResult(data);
    } catch (e: any) {
      setSendResult({ ok: false, error: e?.message ?? "Error creating proposal." });
    } finally {
      setSending(false);
    }
  }

  // ---- wheel clamp for horizontal scroll so it has a hard stop and doesn't "escape" ----
  function onTableWheelCapture(e: any) {
    const el = e.currentTarget as HTMLDivElement;

    const dx = Number(e.deltaX ?? 0);
    const dy = Number(e.deltaY ?? 0);

    // some devices use shift+vertical wheel to mean horizontal
    const intendedX =
      Math.abs(dx) > Math.abs(dy) ? dx : e.shiftKey ? dy : 0;

    if (Math.abs(intendedX) < 0.5) return;

    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextLeft = clamp(el.scrollLeft + intendedX, 0, maxLeft);

    // hard clamp + block chaining always for horizontal gestures
    if (nextLeft !== el.scrollLeft) el.scrollLeft = nextLeft;

    e.preventDefault?.();
    e.stopPropagation?.();
  }

  const gridCols = "44px 72px 260px 120px 260px 170px 170px 220px 160px 120px";
  const emailOk = isValidEmail(clientEmail);

  // layout tuning
  const PANEL_W = "clamp(320px, 26vw, 380px)";
  const CONTAINER_MAX = 2000;

  return (
    <main
      style={{
        padding: 24,
        minHeight: "100dvh",
        width: "100%",
        background: "#f6f7f9",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <div style={{ width: "100%", maxWidth: CONTAINER_MAX, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 14 }}>Boats</h1>
          <span style={{ color: "#6b7280" }}>({boats.length})</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={selectAll}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            Select all
          </button>

          <button
            onClick={clearAll}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            Clear
          </button>

          <span style={{ marginLeft: "auto", color: "#6b7280" }}>Selected: {selected.size}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `minmax(0, 1fr) ${PANEL_W}`,
            gap: 16,
            marginTop: 16,
            alignItems: "start",
          }}
        >
          {/* table */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              overflow: "hidden",
              background: "white",
              minWidth: 0,
            }}
          >
            <div
              onWheelCapture={onTableWheelCapture}
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: "calc(100dvh - 24px - 44px - 16px - 16px)",
                WebkitOverflowScrolling: "touch",
                overscrollBehaviorX: "contain",
                overscrollBehaviorY: "contain",
              }}
            >
              <div style={{ width: "max-content", minWidth: "100%" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    padding: "10px 12px",
                    background: "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: 12,
                    color: "#6b7280",
                    fontWeight: 700,
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                  }}
                >
                  <div />
                  <div>Photo</div>
                  <div>Boat name</div>
                  <div>Rating</div>
                  <div>Model</div>
                  <div>Service type</div>
                  <div>Boat type</div>
                  <div>Base</div>
                  <div>Country</div>
                  <div>Length</div>
                </div>

                {boats.map((b, idx) => {
                  const key = toKey(b, idx);
                  const checked = selected.has(key);

                  return (
                    <div
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: gridCols,
                        padding: "10px 12px",
                        borderBottom: "1px solid #f3f4f6",
                        alignItems: "center",
                        background: checked ? "#f0f9ff" : "white",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(key)}
                          style={{ width: 18, height: 18 }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div
                          style={{
                            width: 56,
                            height: 40,
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            overflow: "hidden",
                            background: "#f9fafb",
                          }}
                        >
                          {b.image ? (
                            <img
                              src={b.image}
                              alt={b.name ?? "boat"}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "#f9fafb" }} />
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontWeight: 800,
                          color: "#2563eb",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          minWidth: 0,
                        }}
                        title={b.name ?? ""}
                      >
                        {b.name ?? "Untitled"}
                      </div>

                      <div style={{ color: "#f59e0b" }}>
                        <Stars rating={b.rating} />
                      </div>

                      <div style={{ minWidth: 0 }} title={b.model ?? ""}>
                        <span
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                          }}
                        >
                          {b.model ?? "-"}
                        </span>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <Pill text={b.serviceType} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <Pill text={b.boatType} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <Pill text={b.base} />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <Pill text={b.country} />
                      </div>

                      <div style={{ color: "#111827", whiteSpace: "nowrap" }}>
                        {b.lengthFt ? `${b.lengthFt} ft` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* panel */}
          <aside
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
              background: "white",
              height: "fit-content",
              position: "sticky",
              top: 16,
              minWidth: 0,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Create proposal</div>

            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
              Client name (optional)
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Full name"
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                marginTop: 6,
              }}
            />

            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
              Client email (optional)
            </label>
            <input
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@domain.com"
              inputMode="email"
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: `1px solid ${emailOk ? "#e5e7eb" : "#fecaca"}`,
                marginTop: 6,
                outline: "none",
              }}
            />
            {!emailOk && <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>Invalid email.</div>}

            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
              Language
            </label>
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as Lang)}
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                marginTop: 6,
              }}
            >
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="pt">PT</option>
              <option value="it">IT</option>
              <option value="fr">FR</option>
              <option value="de">DE</option>
            </select>

            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
              Currency
            </label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="EUR"
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                marginTop: 6,
              }}
            />

            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
              Initial message (for the proposal)
            </label>
            <textarea
              value={brokerMessage}
              onChange={(e) => setBrokerMessage(e.target.value)}
              placeholder="Hi, here is a curated selection of yachts…"
              rows={4}
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                resize: "vertical",
              }}
            />

            <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>Prices per boat (required)</div>

            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {selectedBoats.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>Select 1+ boats to enter prices.</div>
              ) : (
                selectedBoats.map((b) => {
                  const id = String(b.id);
                  return (
                    <div
                      key={id}
                      style={{
                        border: "1px solid #f3f4f6",
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{b.name ?? id}</div>

                      <input
                        value={priceById[id] ?? ""}
                        onChange={(e) => setPrice(id, e.target.value)}
                        placeholder="Price"
                        inputMode="decimal"
                        style={{
                          width: "100%",
                          padding: "10px 10px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <textarea
                        value={noteById[id] ?? ""}
                        onChange={(e) => setNoteById((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder="Price notes (e.g. fuel included / not included, skipper, port fees, etc.)"
                        rows={3}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          padding: "10px 10px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>Final notes (optional)</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={finalNotesEnabled}
                onChange={(e) => setFinalNotesEnabled(e.target.checked)}
              />
              Include “please note”
            </label>

            <textarea
              value={finalNotes}
              onChange={(e) => {
                const v = e.target.value;
                setFinalNotesTouchedByLang((prev) => ({ ...prev, [language]: true }));
                setFinalNotesByLang((prev) => ({ ...prev, [language]: v }));
              }}
              disabled={!finalNotesEnabled}
              rows={6}
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                marginTop: 6,
                resize: "vertical",
                opacity: finalNotesEnabled ? 1 : 0.6,
              }}
            />

            <button
              type="button"
              onClick={() => {
                setFinalNotesTouchedByLang((prev) => ({ ...prev, [language]: false }));
                setFinalNotesByLang((prev) => ({ ...prev, [language]: DEFAULT_FINAL_NOTES[language] ?? "" }));
              }}
              disabled={!finalNotesEnabled}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#111827",
                cursor: finalNotesEnabled ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              Reset final notes to default ({language.toUpperCase()})
            </button>

            {itineraries.length > 0 && (
              <>
                <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
                  Itineraries to include (optional)
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 6, maxHeight: 180, overflow: "auto" }}>
                  {itineraries.map((it) => {
                    const checked = selectedItineraries.has(it.id);
                    return (
                      <label
                        key={it.id}
                        style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleItinerary(it.id)} />
                        <span>{it.title}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <button
              onClick={createProposal}
              disabled={sending || selectedIds.length === 0 || !emailOk}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: sending || selectedIds.length === 0 || !emailOk ? "#f3f4f6" : "#111827",
                color: sending || selectedIds.length === 0 || !emailOk ? "#6b7280" : "white",
                cursor: sending || selectedIds.length === 0 || !emailOk ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {sending ? "Creating..." : "Create proposal"}
            </button>

            {sendResult && (
              <pre
                style={{
                  marginTop: 12,
                  background: "#0b1020",
                  color: "#e5e7eb",
                  padding: 12,
                  borderRadius: 12,
                  overflow: "auto",
                  maxHeight: 220,
                }}
              >
                {JSON.stringify(sendResult, null, 2)}
              </pre>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
