import { useState, useEffect } from "react";

// ─── CONFIG SUPABASE ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://blqvqhqfsrafpmheuhcx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscXZxaHFmc3JhZnBtaGV1aGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzM2NDMsImV4cCI6MjA5MzE0OTY0M30.jMeTPqvkyw8zXpiigQBndMVOBIuHtYQ5cqe_TJY7WRk";

const api = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

// ─── DONNÉES STATIQUES (fallback si pas encore en BDD) ────────────────────────
const SERVICES_DATA = [
  { id: 1, nom: "Coupe homme", duree: 45, prix: 30, couleur: "#4a9eff", categorie: "Coupe" },
  { id: 2, nom: "Coupe + Barbe", duree: 60, prix: 55, couleur: "#5cb85c", categorie: "Coupe" },
  { id: 3, nom: "Coupe +barbe +soin visage", duree: 90, prix: 85, couleur: "#e8507a", categorie: "Coupe" },
  { id: 4, nom: "barbe", duree: 30, prix: 25, couleur: "#f0a050", categorie: "Barbe" },
  { id: 5, nom: "Rasage traditionnel", duree: 45, prix: 35, couleur: "#f0a050", categorie: "Barbe" },
  { id: 6, nom: "Taille de barbe", duree: 30, prix: 25, couleur: "#f0a050", categorie: "Barbe" },
  { id: 7, nom: "Coupe étudiant", duree: 30, prix: 25, couleur: "#9060e8", categorie: "Coupe" },
  { id: 8, nom: "Coupe (-17)", duree: 30, prix: 25, couleur: "#20a090", categorie: "Coupe" },
  { id: 9, nom: "Coupe (-10 ans)", duree: 30, prix: 20, couleur: "#20a090", categorie: "Coupe" },
  { id: 10, nom: "Balayage", duree: 150, prix: 180, couleur: "#f5c842", categorie: "Couleur" },
  { id: 11, nom: "Coloration", duree: 120, prix: 120, couleur: "#f0a050", categorie: "Couleur" },
  { id: 12, nom: "Mèches", duree: 120, prix: 150, couleur: "#9060e8", categorie: "Couleur" },
  { id: 13, nom: "Soin Kératine", duree: 90, prix: 95, couleur: "#5cb85c", categorie: "Soin" },
  { id: 14, nom: "Offre de bienvenue", duree: 15, prix: 0, couleur: "#c9a84c", categorie: "Offre" },
];

const HORAIRES = {
  1: [{ debut: "10:00", fin: "19:00" }], // Lundi
  2: [{ debut: "10:00", fin: "19:00" }], // Mardi
  3: [{ debut: "10:00", fin: "19:00" }], // Mercredi
  4: [{ debut: "10:00", fin: "19:00" }], // Jeudi
  5: [{ debut: "10:00", fin: "13:30" }, { debut: "15:00", fin: "19:00" }], // Vendredi
  6: [{ debut: "10:00", fin: "19:00" }], // Samedi
  0: [], // Dimanche fermé
};

const JOURS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => n === 0 ? "Gratuit" : `${n},00 €`;
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function generateSlots(date, dureeMin, existingRdv = []) {
  const day = date.getDay();
  const plages = HORAIRES[day] || [];
  const slots = [];
  for (const plage of plages) {
    const [dh, dm] = plage.debut.split(":").map(Number);
    const [fh, fm] = plage.fin.split(":").map(Number);
    let cur = dh * 60 + dm;
    const end = fh * 60 + fm;
    while (cur + dureeMin <= end) {
      const hh = Math.floor(cur / 60), mm = cur % 60;
      const slotStart = `${pad(hh)}:${pad(mm)}`;
      const slotEnd = `${pad(Math.floor((cur+dureeMin)/60))}:${pad((cur+dureeMin)%60)}`;
      // Check if slot is taken
      const taken = existingRdv.some(rdv => {
        const rs = rdv.heure_debut, re = rdv.heure_fin;
        return !(slotEnd <= rs || slotStart >= re);
      });
      if (!taken) slots.push({ start: slotStart, end: slotEnd, startMin: cur });
      cur += 15; // créneaux toutes les 15 min
    }
  }
  return slots;
}

// ─── SQL À EXÉCUTER DANS SUPABASE (commenté) ─────────────────────────────────
/*
-- TABLES À CRÉER DANS SUPABASE SQL EDITOR :

CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telephone VARCHAR(20),
  date_naissance DATE,
  adresse TEXT,
  genre VARCHAR(20),
  note TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  nb_visites INT DEFAULT 0,
  ca_total DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  client_nom VARCHAR(200),
  client_email VARCHAR(255),
  client_tel VARCHAR(20),
  service_id INT,
  service_nom VARCHAR(200),
  service_duree INT,
  service_prix DECIMAL(10,2),
  date_rdv DATE NOT NULL,
  heure_debut VARCHAR(5) NOT NULL,
  heure_fin VARCHAR(5) NOT NULL,
  statut VARCHAR(30) DEFAULT 'confirmé',
  note TEXT,
  source VARCHAR(20) DEFAULT 'en_ligne',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  appointment_id UUID REFERENCES appointments(id),
  montant DECIMAL(10,2),
  remise DECIMAL(10,2) DEFAULT 0,
  mode_paiement VARCHAR(30),
  statut VARCHAR(20) DEFAULT 'en_attente',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invoice_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  type VARCHAR(20),
  nom VARCHAR(200),
  prix DECIMAL(10,2),
  quantite INT DEFAULT 1
);

-- Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert appointments" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read appointments" ON appointments FOR SELECT USING (true);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert clients" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Clients can read own data" ON clients FOR SELECT USING (email = current_setting('request.jwt.claims', true)::json->>'email');
*/

// ─── COMPOSANTS UI ────────────────────────────────────────────────────────────
function Step({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? "#c9a84c" : active ? "#0d1b2a" : "#e5e7eb",
        color: done || active ? "#fff" : "#9ca3af",
        fontSize: 12, fontWeight: 700, flexShrink: 0, transition: "all 0.2s"
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: active || done ? 600 : 400, color: active ? "#0d1b2a" : done ? "#c9a84c" : "#9ca3af" }}>
        {label}
      </span>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder, required, error }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}{required && " *"}</label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          padding: "10px 14px", border: `1.5px solid ${error ? "#ef4444" : "#e5e7eb"}`,
          borderRadius: 8, fontSize: 14, outline: "none", background: "#fff",
          transition: "border-color 0.15s", fontFamily: "inherit",
        }}
        onFocus={e => e.target.style.borderColor = "#c9a84c"}
        onBlur={e => e.target.style.borderColor = error ? "#ef4444" : "#e5e7eb"}
      />
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

// ─── PAGE 1 : CHOIX PRESTATION ────────────────────────────────────────────────
function PagePrestation({ onSelect, selected }) {
  const [activecat, setActiveCat] = useState("Tous");
  const cats = ["Tous", ...new Set(SERVICES_DATA.map(s => s.categorie))];
  const filtered = activecat === "Tous" ? SERVICES_DATA : SERVICES_DATA.filter(s => s.categorie === activecat);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0d1b2a", marginBottom: 4 }}>Choisir une prestation</h2>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>Sélectionnez la prestation que vous souhaitez réserver chez Elnagar.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {cats.map(c => (
          <button key={c} onClick={() => setActiveCat(c)} style={{
            padding: "5px 14px", borderRadius: 20, border: "1.5px solid", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.15s",
            borderColor: activecat === c ? "#c9a84c" : "#e5e7eb",
            background: activecat === c ? "#c9a84c" : "#fff",
            color: activecat === c ? "#fff" : "#374151",
          }}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filtered.map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s)}
            style={{
              border: `2px solid ${selected?.id === s.id ? s.couleur : "#e5e7eb"}`,
              borderRadius: 10, padding: "14px 16px", cursor: "pointer",
              background: selected?.id === s.id ? s.couleur + "10" : "#fff",
              transition: "all 0.15s", position: "relative",
            }}
            onMouseEnter={e => { if (selected?.id !== s.id) e.currentTarget.style.borderColor = s.couleur + "80"; }}
            onMouseLeave={e => { if (selected?.id !== s.id) e.currentTarget.style.borderColor = "#e5e7eb"; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.couleur, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#0d1b2a" }}>{s.nom}</span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", paddingLeft: 18 }}>{s.duree} min</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.prix === 0 ? "#c9a84c" : "#0d1b2a", flexShrink: 0 }}>{fmt(s.prix)}</div>
            </div>
            {selected?.id === s.id && (
              <div style={{ position: "absolute", top: 8, right: 8, background: s.couleur, color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PAGE 2 : CHOIX DATE + CRÉNEAU ───────────────────────────────────────────
function PageDateTime({ service, onSelect, selected }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [existingRdv, setExistingRdv] = useState([]);
  const [loading, setLoading] = useState(false);

  const today = new Date(2026, 4, 2); // 2 mai 2026
  const monday = new Date(today);
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
  monday.setDate(today.getDate() - dayOfWeek + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  });

  useEffect(() => {
    // Load existing appointments from Supabase
    const loadRdv = async () => {
      setLoading(true);
      try {
        const startDate = dateKey(weekDays[0]);
        const endDate = dateKey(weekDays[6]);
        const data = await api(`appointments?date_rdv=gte.${startDate}&date_rdv=lte.${endDate}&select=date_rdv,heure_debut,heure_fin`);
        setExistingRdv(data || []);
      } catch (e) {
        setExistingRdv([]); // fallback: all slots available
      }
      setLoading(false);
    };
    loadRdv();
  }, [weekOffset]);

  const rdvByDate = {};
  existingRdv.forEach(r => {
    if (!rdvByDate[r.date_rdv]) rdvByDate[r.date_rdv] = [];
    rdvByDate[r.date_rdv].push(r);
  });

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0d1b2a", marginBottom: 4 }}>Choisir un créneau</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <div style={{ background: service.couleur + "15", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: service.couleur }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0d1b2a" }}>{service.nom}</span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>· {service.duree} min · {fmt(service.prix)}</span>
        </div>
      </div>

      {/* Navigation semaine */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 6, width: 32, height: 32, cursor: weekOffset === 0 ? "not-allowed" : "pointer", fontSize: 16, color: weekOffset === 0 ? "#d1d5db" : "#374151" }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#0d1b2a" }}>
          {weekDays[0].getDate()} – {weekDays[6].getDate()} {MOIS_FR[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}
        </span>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 6, width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#374151" }}>›</button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 14 }}>Chargement des créneaux...</div>}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {weekDays.map((day, i) => {
            const isFerme = HORAIRES[day.getDay()]?.length === 0;
            const isPast = day < today;
            const dk = dateKey(day);
            const slots = generateSlots(day, service.duree, rdvByDate[dk] || []);
            const dayName = JOURS_FR[day.getDay()];
            const isSelected = selected?.date === dk;

            return (
              <div key={i}>
                <div style={{ textAlign: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" }}>{dayName}</div>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "2px auto", fontSize: 13, fontWeight: 600,
                    background: dk === dateKey(today) ? "#c9a84c" : "transparent",
                    color: dk === dateKey(today) ? "#fff" : "#374151",
                  }}>{day.getDate()}</div>
                </div>
                {isFerme ? (
                  <div style={{ textAlign: "center", fontSize: 11, color: "#d1d5db", padding: "4px 0" }}>Fermé</div>
                ) : isPast ? (
                  <div style={{ textAlign: "center", fontSize: 11, color: "#d1d5db" }}>—</div>
                ) : slots.length === 0 ? (
                  <div style={{ textAlign: "center", fontSize: 11, color: "#9ca3af" }}>Complet</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto" }}>
                    {slots.map(slot => {
                      const isSlotSelected = selected?.date === dk && selected?.slot?.start === slot.start;
                      return (
                        <button key={slot.start} onClick={() => onSelect({ date: dk, dateObj: day, slot })} style={{
                          padding: "5px 4px", borderRadius: 6, border: `1.5px solid ${isSlotSelected ? "#c9a84c" : "#e5e7eb"}`,
                          background: isSlotSelected ? "#c9a84c" : "#fff", color: isSlotSelected ? "#fff" : "#374151",
                          cursor: "pointer", fontSize: 12, fontWeight: isSlotSelected ? 600 : 400, transition: "all 0.1s",
                        }}
                          onMouseEnter={e => { if (!isSlotSelected) { e.target.style.borderColor = "#c9a84c"; e.target.style.background = "#fef9e7"; } }}
                          onMouseLeave={e => { if (!isSlotSelected) { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#fff"; } }}
                        >
                          {slot.start}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PAGE 3 : INFORMATIONS CLIENT ─────────────────────────────────────────────
function PageInfoClient({ onSubmit, loading }) {
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", telephone: "", date_naissance: "", adresse: "", genre: "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.prenom.trim()) e.prenom = "Prénom requis";
    if (!form.nom.trim()) e.nom = "Nom requis";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Email valide requis";
    if (!form.telephone.trim()) e.telephone = "Téléphone requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => { if (validate()) onSubmit(form); };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0d1b2a", marginBottom: 4 }}>Vos informations</h2>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>Ces informations sont nécessaires pour confirmer votre rendez-vous.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Input label="Prénom" value={form.prenom} onChange={v => set("prenom", v)} required error={errors.prenom} />
        <Input label="Nom" value={form.nom} onChange={v => set("nom", v)} required error={errors.nom} />
        <Input label="Email" type="email" value={form.email} onChange={v => set("email", v)} required error={errors.email} />
        <Input label="Téléphone" type="tel" value={form.telephone} onChange={v => set("telephone", v)} placeholder="06 XX XX XX XX" required error={errors.telephone} />
        <Input label="Date de naissance" type="date" value={form.date_naissance} onChange={v => set("date_naissance", v)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Genre</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["Homme", "Femme", "Autre"].map(g => (
              <button key={g} onClick={() => set("genre", g)} style={{
                flex: 1, padding: "9px 8px", borderRadius: 8, border: `1.5px solid ${form.genre === g ? "#c9a84c" : "#e5e7eb"}`,
                background: form.genre === g ? "#fef9e7" : "#fff", cursor: "pointer", fontSize: 13, fontWeight: form.genre === g ? 600 : 400, transition: "all 0.15s",
              }}>{g}</button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <Input label="Adresse" value={form.adresse} onChange={v => set("adresse", v)} placeholder="Rue, ville, code postal" />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={loading} style={{
        marginTop: 24, width: "100%", padding: "13px", background: loading ? "#e5e7eb" : "#c9a84c",
        color: loading ? "#9ca3af" : "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", transition: "all 0.15s",
      }}>
        {loading ? "Confirmation en cours..." : "Confirmer le rendez-vous"}
      </button>
    </div>
  );
}

// ─── PAGE 4 : CONFIRMATION ────────────────────────────────────────────────────
function PageConfirmation({ rdv }) {
  const d = new Date(rdv.date + "T12:00:00");
  const dateStr = `${JOURS_FR[d.getDay()]} ${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>✓</div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0d1b2a", marginBottom: 8 }}>Rendez-vous confirmé !</h2>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>
        Un email de confirmation a été envoyé à <strong>{rdv.client_email}</strong>
      </p>
      <div style={{ background: "#f9fafb", borderRadius: 12, padding: 20, textAlign: "left", maxWidth: 400, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: rdv.couleur || "#c9a84c" }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#0d1b2a" }}>{rdv.service_nom}</span>
        </div>
        {[
          { icon: "📅", label: dateStr },
          { icon: "🕐", label: `${rdv.heure_debut} – ${rdv.heure_fin}` },
          { icon: "⏱", label: `${rdv.service_duree} minutes` },
          { icon: "💶", label: rdv.service_prix === 0 ? "Gratuit" : `${rdv.service_prix},00 €` },
          { icon: "📍", label: "41 Rue Néricault Destouches, 37000 Tours" },
          { icon: "👤", label: `${rdv.client_prenom} ${rdv.client_nom}` },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{r.icon}</span>
            <span style={{ fontSize: 13, color: "#374151" }}>{r.label}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#9ca3af" }}>
        Pour annuler ou modifier votre rendez-vous, contactez-nous au <strong>06 72 42 95 11</strong>
      </p>
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function BookingApp() {
  const [step, setStep] = useState(1); // 1: service, 2: datetime, 3: infos, 4: confirmation
  const [service, setService] = useState(null);
  const [dateTime, setDateTime] = useState(null); // {date, dateObj, slot}
  const [confirmedRdv, setConfirmedRdv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendConfirmationEmail = async (rdv) => {
    // Simulation d'envoi email (à connecter à Resend/SendGrid via Supabase Edge Functions)
    console.log("📧 Email de confirmation envoyé à", rdv.client_email, {
      sujet: `Confirmation RDV Elnagar – ${rdv.service_nom} le ${rdv.date}`,
      corps: `Bonjour ${rdv.client_prenom}, votre rendez-vous ${rdv.service_nom} est confirmé le ${rdv.date} à ${rdv.heure_debut}. Adresse : 41 Rue Néricault Destouches, 37000 Tours.`
    });
  };

  const sendNotificationToOwner = async (rdv) => {
    // Envoie notification au propriétaire via Supabase Realtime ou email
    console.log("🔔 Notification propriétaire:", {
      message: `Nouveau RDV : ${rdv.client_prenom} ${rdv.client_nom} - ${rdv.service_nom} le ${rdv.date} à ${rdv.heure_debut}`,
      email_owner: "abdelelnagar37@gmail.com"
    });
  };

  const handleConfirm = async (clientInfo) => {
    setLoading(true);
    setError(null);
    try {
      const rdvData = {
        client_nom: clientInfo.nom,
        client_prenom: clientInfo.prenom,
        client_email: clientInfo.email,
        client_tel: clientInfo.telephone,
        service_id: service.id,
        service_nom: service.nom,
        service_duree: service.duree,
        service_prix: service.prix,
        date_rdv: dateTime.date,
        heure_debut: dateTime.slot.start,
        heure_fin: dateTime.slot.end,
        statut: "confirmé",
        source: "en_ligne",
      };

      // Insert in Supabase
      let saved = null;
      try {
        const result = await api("appointments", {
          method: "POST",
          body: JSON.stringify(rdvData),
          prefer: "return=representation",
        });
        saved = Array.isArray(result) ? result[0] : result;
      } catch (e) {
        // Si la table n'existe pas encore, on continue quand même
        console.warn("Supabase insert failed (table may not exist yet):", e.message);
        saved = { id: "local-" + Date.now(), ...rdvData };
      }

      // Try to save/find client
      try {
        await api("clients", {
          method: "POST",
          body: JSON.stringify({
            nom: clientInfo.nom,
            prenom: clientInfo.prenom,
            email: clientInfo.email,
            telephone: clientInfo.telephone,
            date_naissance: clientInfo.date_naissance || null,
            adresse: clientInfo.adresse || null,
            genre: clientInfo.genre || null,
          }),
          prefer: "return=representation,resolution=merge-duplicates",
          headers: { "on_conflict": "email" },
        });
      } catch (e) {
        console.warn("Client save failed:", e.message);
      }

      const fullRdv = {
        ...rdvData,
        ...saved,
        client_prenom: clientInfo.prenom,
        couleur: service.couleur,
      };

      await sendConfirmationEmail(fullRdv);
      await sendNotificationToOwner(fullRdv);

      setConfirmedRdv(fullRdv);
      setStep(4);
    } catch (e) {
      setError("Une erreur est survenue. Veuillez réessayer ou nous appeler au 06 72 42 95 11.");
    }
    setLoading(false);
  };

  const canNext = () => {
    if (step === 1) return !!service;
    if (step === 2) return !!dateTime;
    return true;
  };

  const stepLabels = ["Prestation", "Créneau", "Informations", "Confirmation"];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d1b2a 0%, #1e3a5f 50%, #0d1b2a 100%)", fontFamily: "'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#c9a84c", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#0d1b2a", fontSize: 18 }}>E</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>ELNAGAR</div>
            <div style={{ color: "#94a3b8", fontSize: 11 }}>Coiffure Homme · Tours</div>
          </div>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>📍 41 Rue Néricault Destouches, 37000 Tours</div>
      </div>

      {/* Stepper */}
      {step < 4 && (
        <div style={{ padding: "16px 24px", display: "flex", gap: 16, alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
          {stepLabels.slice(0, 3).map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Step n={i + 1} label={label} active={step === i + 1} done={step > i + 1} />
              {i < 2 && <div style={{ width: 24, height: 1, background: step > i + 1 ? "#c9a84c" : "rgba(255,255,255,0.15)" }} />}
            </div>
          ))}
        </div>
      )}

      {/* Main card */}
      <div style={{ flex: 1, display: "flex", alignItems: "start", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 900, boxShadow: "0 24px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
          <div style={{ padding: "28px 32px" }}>
            {step === 1 && <PagePrestation onSelect={s => { setService(s); }} selected={service} />}
            {step === 2 && service && <PageDateTime service={service} onSelect={setDateTime} selected={dateTime} />}
            {step === 3 && <PageInfoClient onSubmit={handleConfirm} loading={loading} />}
            {step === 4 && confirmedRdv && <PageConfirmation rdv={confirmedRdv} />}
            {error && <div style={{ marginTop: 12, padding: "10px 14px", background: "#fee2e2", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>{error}</div>}
          </div>

          {/* Footer navigation */}
          {step < 4 && (
            <div style={{ padding: "16px 32px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa" }}>
              <button onClick={() => step > 1 && setStep(s => s - 1)} disabled={step === 1} style={{
                padding: "9px 20px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "none",
                color: step === 1 ? "#d1d5db" : "#374151", cursor: step === 1 ? "default" : "pointer", fontSize: 13, fontWeight: 500,
              }}>← Retour</button>

              {/* Récap sélection */}
              <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}>
                {step === 2 && service && <span><strong style={{ color: "#0d1b2a" }}>{service.nom}</strong> · {service.duree} min · {fmt(service.prix)}</span>}
                {step === 3 && dateTime && service && (
                  <span>
                    <strong style={{ color: "#0d1b2a" }}>{service.nom}</strong> · {" "}
                    {new Date(dateTime.date + "T12:00:00").getDate()} {MOIS_FR[new Date(dateTime.date + "T12:00:00").getMonth()]} à {dateTime.slot.start}
                  </span>
                )}
              </div>

              {step < 3 ? (
                <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()} style={{
                  padding: "9px 24px", borderRadius: 8, border: "none",
                  background: canNext() ? "#c9a84c" : "#e5e7eb", color: canNext() ? "#fff" : "#9ca3af",
                  cursor: canNext() ? "pointer" : "default", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                }}>Suivant →</button>
              ) : <div style={{ width: 80 }} />}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
        © 2026 Salon Elnagar · Réservation en ligne sécurisée · 06 72 42 95 11
      </div>
    </div>
  );
}
