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

type Lang = "en" | "es" | "pt" | "it";

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

/// parsea bien: "1.200" "1.200,50" "1200,50" "1200.50" "2.000" -> 2000
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

// validación simple de email (suficiente para UI)
function isValidEmail(email: string) {
  const e = email.trim();
  if (!e) return true; // si está vacío, lo consideramos ok
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function BoatList({ boats, itineraries = [] }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // propuesta config
  const [language, setLanguage] = useState<Lang>("en");
  const [currency, setCurrency] = useState<string>("EUR");
  const [brokerMessage, setBrokerMessage] = useState<string>("");
  const [selectedItineraries, setSelectedItineraries] = useState<Set<string>>(new Set());

  // ✅ nuevos inputs (cliente)
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");

  // precios por barco
  const [priceById, setPriceById] = useState<Record<string, string>>({});

  // envío
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
    setSelectedItineraries(new Set());
    setSendResult(null);
    // opcional: no limpiar nombre/email para no reescribirlos
    // setClientName("");
    // setClientEmail("");
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

  function validateProposal() {
    if (selectedIds.length === 0) return "No seleccionaste ningún barco.";

    // ✅ valida email si está cargado
    if (!isValidEmail(clientEmail)) return "El email del cliente no es válido.";

    for (const id of selectedIds) {
      const raw = (priceById[id] ?? "").trim();
      if (!raw) return `Faltó el precio para el barco id=${id}.`;
      const n = parseMoney(raw);
      if (!Number.isFinite(n) || n <= 0) return `Precio inválido para el barco id=${id}.`;
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
    }));

    const payload = {
      language,
      boats: boatsPayload,

      // ✅ nuevos datos del cliente
      client: {
        name: clientName.trim() || null,
        email: clientEmail.trim() || null,
      },

      cta: {
        messageFromBroker: brokerMessage,
        clientNoteEnabled: true,
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
      setSendResult({ ok: false, error: e?.message ?? "Error creando propuesta." });
    } finally {
      setSending(false);
    }
  }

  const gridCols = "44px 72px 260px 120px 260px 170px 170px 220px 160px 120px";

  const emailOk = isValidEmail(clientEmail);

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 14 }}>Barcos</h1>
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
          Seleccionar todos
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
          Limpiar
        </button>

        <span style={{ marginLeft: "auto", color: "#6b7280" }}>
          Seleccionados: {selected.size}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, marginTop: 16 }}>
        {/* tabla */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            overflow: "hidden",
            background: "white",
          }}
        >
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh" }}>
            <div style={{ minWidth: 1600 }}>
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
                }}
              >
                <div />
                <div>Foto</div>
                <div>Boat Name</div>
                <div>Rating</div>
                <div>Model</div>
                <div>Service Type</div>
                <div>Boat Type</div>
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
                        <div style={{ width: "100%", height: "100%", background: "#f9fafb" }} />
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
                      {b.name ?? "Sin nombre"}
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
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Crear propuesta</div>

          {/* ✅ nuevos campos */}
          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
            Nombre del cliente (opcional)
          </label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nombre y apellido"
            style={{
              width: "100%",
              padding: "10px 10px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              marginTop: 6,
            }}
          />

          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
            Email del cliente (opcional)
          </label>
          <input
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="cliente@dominio.com"
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
          {!emailOk && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>
              Email inválido.
            </div>
          )}

          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
            Idioma
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Lang)}
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
          </select>

          <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 10 }}>
            Moneda
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
            Mensaje inicial (para la propuesta)
          </label>
          <textarea
            value={brokerMessage}
            onChange={(e) => setBrokerMessage(e.target.value)}
            placeholder="Hola, te comparto una selección de embarcaciones…"
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

          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Precios por barco (obligatorio)
          </div>

          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {selectedBoats.length === 0 ? (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Seleccioná 1+ barcos para cargar precios.
              </div>
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
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                      {b.name ?? id}
                    </div>
                    <input
                      value={priceById[id] ?? ""}
                      onChange={(e) => setPrice(id, e.target.value)}
                      placeholder="Precio"
                      inputMode="decimal"
                      style={{
                        width: "100%",
                        padding: "10px 10px",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>

          {itineraries.length > 0 && (
            <>
              <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
                Itinerarios a incluir (opcional)
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 6, maxHeight: 180, overflow: "auto" }}>
                {itineraries.map((it) => {
                  const checked = selectedItineraries.has(it.id);
                  return (
                    <label key={it.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
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
            {sending ? "Creando..." : "Crear propuesta"}
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
    </main>
  );
}
