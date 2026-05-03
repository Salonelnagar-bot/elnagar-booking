import { useState, useEffect } from "react";

const SUPABASE_URL = "https://blqvqhqfsrafpmheuhcx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscXZxaHFmc3JhZnBtaGV1aGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzM2NDMsImV4cCI6MjA5MzE0OTY0M30.jMeTPqvkyw8zXpiigQBndMVOBIuHtYQ5cqe_TJY7WRk";

const db = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
};

// ─── HORAIRES (miroir de la BDD) ─────────────────────────────────────────────
const HORAIRES = {
  1: [{ debut: "10:00", fin: "19:00" }],
  2: [{ debut: "10:00", fin: "19:00" }],
  3: [{ debut: "10:00", fin: "19:00" }],
  4: [{ debut: "10:00", fin: "19:00" }],
  5: [{ debut: "10:00", fin: "13:30" }, { debut: "15:00", fin: "19:00" }],
  6: [{ debut: "10:00", fin: "19:00" }],
  0: [],
};

const JOURS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const JOURS_LONG = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

const pad = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmt = n => n === 0 ? "Gratuit" : `${n},00 €`;
const hmToMin = hm => { const [h,m] = hm.split(":"); return +h*60 + +m; };
const minToHm = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;

function generateSlots(date, dureeMin, takenRdv = []) {
  const day = date.getDay();
  const plages = HORAIRES[day] || [];
  const slots = [];
  for (const p of plages) {
    let cur = hmToMin(p.debut);
    const end = hmToMin(p.fin);
    while (cur + dureeMin <= end) {
      const start = minToHm(cur);
      const finish = minToHm(cur + dureeMin);
      const taken = takenRdv.some(r => !(finish <= r.heure_debut || start >= r.heure_fin));
      if (!taken) slots.push({ start, end: finish });
      cur += 15;
    }
  }
  return slots;
}

// ─── PRESTATIONS STATIQUES (chargées aussi depuis Supabase si dispo) ──────────
const SERVICES_DEFAUT = [
  { id:1,  nom:"Coupe homme",               duree:45,  prix:30,  couleur:"#4a9eff", categorie:"Coupe" },
  { id:2,  nom:"Coupe + Barbe",             duree:60,  prix:55,  couleur:"#5cb85c", categorie:"Coupe" },
  { id:3,  nom:"Coupe +barbe +soin visage", duree:90,  prix:85,  couleur:"#e8507a", categorie:"Coupe" },
  { id:4,  nom:"barbe",                     duree:30,  prix:25,  couleur:"#f0a050", categorie:"Barbe" },
  { id:5,  nom:"Rasage traditionnel",       duree:45,  prix:35,  couleur:"#f0a050", categorie:"Barbe" },
  { id:6,  nom:"Taille de barbe",           duree:30,  prix:25,  couleur:"#f0a050", categorie:"Barbe" },
  { id:7,  nom:"Coupe étudiant",            duree:30,  prix:25,  couleur:"#9060e8", categorie:"Coupe" },
  { id:8,  nom:"Coupe (-17)",               duree:30,  prix:25,  couleur:"#20a090", categorie:"Coupe" },
  { id:9,  nom:"Coupe (-10 ans)",           duree:30,  prix:20,  couleur:"#20a090", categorie:"Coupe" },
  { id:10, nom:"Balayage",                  duree:150, prix:180, couleur:"#f5c842", categorie:"Couleur" },
  { id:11, nom:"Coloration",                duree:120, prix:120, couleur:"#f0a050", categorie:"Couleur" },
  { id:12, nom:"Mèches",                    duree:120, prix:150, couleur:"#9060e8", categorie:"Couleur" },
  { id:13, nom:"Soin Kératine",             duree:90,  prix:95,  couleur:"#5cb85c", categorie:"Soin" },
  { id:14, nom:"Offre de bienvenue",        duree:15,  prix:0,   couleur:"#c9a84c", categorie:"Offre" },
];

// ─── COMPOSANTS UI ────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
      <div style={{width:32,height:32,border:"3px solid #e5e7eb",borderTop:"3px solid #c9a84c",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Etape({n, label, active, done}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{
        width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
        background:done?"#c9a84c":active?"#0d1b2a":"#e5e7eb",
        color:done||active?"#fff":"#9ca3af",fontSize:12,fontWeight:700,flexShrink:0
      }}>{done?"✓":n}</div>
      <span style={{fontSize:13,fontWeight:active||done?600:400,color:active?"#0d1b2a":done?"#c9a84c":"#9ca3af"}}>{label}</span>
    </div>
  );
}

function Champ({label, type="text", value, onChange, placeholder, required, error, options}) {
  if (options) return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <label style={{fontSize:11,fontWeight:600,color:"#374151",textTransform:"uppercase",letterSpacing:0.5}}>{label}{required?" *":""}</label>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {options.map(o => (
          <button key={o} onClick={()=>onChange(o)} style={{
            padding:"7px 14px",borderRadius:7,border:`1.5px solid ${value===o?"#c9a84c":"#e5e7eb"}`,
            background:value===o?"#fef9e7":"#fff",color:"#374151",cursor:"pointer",fontSize:13,fontWeight:value===o?600:400
          }}>{o}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {label && <label style={{fontSize:11,fontWeight:600,color:"#374151",textTransform:"uppercase",letterSpacing:0.5}}>{label}{required?" *":""}</label>}
      <input
        type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{padding:"10px 14px",border:`1.5px solid ${error?"#ef4444":"#e5e7eb"}`,borderRadius:8,fontSize:14,outline:"none",fontFamily:"inherit"}}
        onFocus={e=>e.target.style.borderColor="#c9a84c"}
        onBlur={e=>e.target.style.borderColor=error?"#ef4444":"#e5e7eb"}
      />
      {error && <span style={{fontSize:11,color:"#ef4444"}}>{error}</span>}
    </div>
  );
}

// ─── ÉTAPE 1 : PRESTATION ────────────────────────────────────────────────────
function EtapePrestation({services, onSelect, selected}) {
  const [cat, setCat] = useState("Tous");
  const cats = ["Tous", ...new Set(services.map(s=>s.categorie))];
  const liste = cat==="Tous" ? services : services.filter(s=>s.categorie===cat);

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,color:"#0d1b2a",marginBottom:4}}>Choisir une prestation</h2>
      <p style={{fontSize:14,color:"#6b7280",marginBottom:20}}>Sélectionnez la prestation que vous souhaitez réserver.</p>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            padding:"5px 14px",borderRadius:20,border:"1.5px solid",cursor:"pointer",fontSize:13,fontWeight:500,
            borderColor:cat===c?"#c9a84c":"#e5e7eb",background:cat===c?"#c9a84c":"#fff",color:cat===c?"#fff":"#374151"
          }}>{c}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12}}>
        {liste.map(s=>(
          <div key={s.id} onClick={()=>onSelect(s)} style={{
            border:`2px solid ${selected?.id===s.id?s.couleur:"#e5e7eb"}`,
            borderRadius:10,padding:"14px 16px",cursor:"pointer",
            background:selected?.id===s.id?s.couleur+"15":"#fff",
            transition:"all 0.15s",position:"relative"
          }}
            onMouseEnter={e=>{if(selected?.id!==s.id)e.currentTarget.style.borderColor=s.couleur+"80";}}
            onMouseLeave={e=>{if(selected?.id!==s.id)e.currentTarget.style.borderColor="#e5e7eb";}}
          >
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:s.couleur}} />
                  <span style={{fontWeight:600,fontSize:14,color:"#0d1b2a"}}>{s.nom}</span>
                </div>
                <div style={{fontSize:12,color:"#6b7280",paddingLeft:18}}>{s.duree} min</div>
              </div>
              <div style={{fontSize:15,fontWeight:700,color:"#0d1b2a",flexShrink:0}}>{fmt(s.prix)}</div>
            </div>
            {selected?.id===s.id && (
              <div style={{position:"absolute",top:8,right:8,background:s.couleur,color:"#fff",borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ÉTAPE 2 : DATE + CRÉNEAU ─────────────────────────────────────────────────
function EtapeCreneau({service, onSelect, selected}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [rdvPris, setRdvPris] = useState({});
  const [loading, setLoading] = useState(true);

  // Aujourd'hui = date réelle du navigateur
  const today = new Date();
  today.setHours(0,0,0,0);

  // Lundi de la semaine courante
  const lundi = new Date(today);
  const jourSemaine = today.getDay()===0 ? 6 : today.getDay()-1;
  lundi.setDate(today.getDate() - jourSemaine + weekOffset*7);

  const jours = Array.from({length:7}, (_,i) => {
    const d = new Date(lundi); d.setDate(lundi.getDate()+i); return d;
  });

  useEffect(()=>{
    const charger = async () => {
      setLoading(true);
      try {
        const debut = dateKey(jours[0]);
        const fin = dateKey(jours[6]);
        // Charger les RDV déjà pris depuis Supabase
        const data = await db(
          `appointments?date_rdv=gte.${debut}&date_rdv=lte.${fin}&statut=neq.annulé&select=date_rdv,heure_debut,heure_fin`
        );
        // Charger aussi les créneaux bloqués
        const bloques = await db(
          `blocked_slots?date_rdv=gte.${debut}&date_rdv=lte.${fin}&select=date_rdv,heure_debut,heure_fin`
        ).catch(()=>[]);

        const tousRdv = [...(data||[]), ...(bloques||[])];
        const parDate = {};
        tousRdv.forEach(r => {
          if (!parDate[r.date_rdv]) parDate[r.date_rdv] = [];
          parDate[r.date_rdv].push({heure_debut:r.heure_debut, heure_fin:r.heure_fin});
        });
        setRdvPris(parDate);
      } catch(e) {
        console.error("Erreur chargement créneaux:", e);
        setRdvPris({});
      }
      setLoading(false);
    };
    charger();
  }, [weekOffset]);

  const dateDebut = jours[0];
  const dateFin = jours[6];

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,color:"#0d1b2a",marginBottom:4}}>Choisir un créneau</h2>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <div style={{background:service.couleur+"15",borderRadius:6,padding:"4px 12px",display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:service.couleur}} />
          <span style={{fontSize:13,fontWeight:600}}>{service.nom}</span>
          <span style={{fontSize:12,color:"#6b7280"}}>· {service.duree} min · {fmt(service.prix)}</span>
        </div>
      </div>

      {/* Navigation semaine */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button
          onClick={()=>setWeekOffset(w=>Math.max(0,w-1))}
          disabled={weekOffset===0}
          style={{background:"none",border:"1.5px solid #e5e7eb",borderRadius:6,width:32,height:32,cursor:weekOffset===0?"not-allowed":"pointer",fontSize:18,color:weekOffset===0?"#d1d5db":"#374151"}}
        >‹</button>
        <span style={{fontSize:14,fontWeight:600,color:"#0d1b2a"}}>
          {dateDebut.getDate()} – {dateFin.getDate()} {MOIS[dateFin.getMonth()]} {dateFin.getFullYear()}
        </span>
        <button
          onClick={()=>setWeekOffset(w=>w+1)}
          style={{background:"none",border:"1.5px solid #e5e7eb",borderRadius:6,width:32,height:32,cursor:"pointer",fontSize:18,color:"#374151"}}
        >›</button>
      </div>

      {loading ? <Spinner /> : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
          {jours.map((jour, i) => {
            const ferme = (HORAIRES[jour.getDay()]||[]).length===0;
            const passe = jour < today;
            const dk = dateKey(jour);
            const slots = generateSlots(jour, service.duree, rdvPris[dk]||[]);
            const estAujdhui = dateKey(jour)===dateKey(today);

            return (
              <div key={i}>
                {/* Header jour */}
                <div style={{textAlign:"center",marginBottom:6}}>
                  <div style={{fontSize:10,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",marginBottom:2}}>
                    {JOURS[jour.getDay()]}
                  </div>
                  <div style={{
                    width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                    margin:"0 auto",fontSize:13,fontWeight:600,
                    background:estAujdhui?"#c9a84c":"transparent",
                    color:estAujdhui?"#fff":"#374151"
                  }}>{jour.getDate()}</div>
                </div>

                {/* Créneaux */}
                {ferme ? (
                  <div style={{textAlign:"center",fontSize:11,color:"#d1d5db",padding:"4px 0"}}>Fermé</div>
                ) : passe ? (
                  <div style={{textAlign:"center",fontSize:11,color:"#d1d5db"}}>—</div>
                ) : slots.length===0 ? (
                  <div style={{textAlign:"center",fontSize:11,color:"#9ca3af",padding:"4px 0"}}>Complet</div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:300,overflowY:"auto"}}>
                    {slots.map(slot => {
                      const actif = selected?.date===dk && selected?.slot?.start===slot.start;
                      return (
                        <button key={slot.start} onClick={()=>onSelect({date:dk, dateObj:jour, slot})} style={{
                          padding:"5px 2px",borderRadius:6,
                          border:`1.5px solid ${actif?"#c9a84c":"#e5e7eb"}`,
                          background:actif?"#c9a84c":"#fff",
                          color:actif?"#fff":"#374151",
                          cursor:"pointer",fontSize:12,fontWeight:actif?600:400,
                          transition:"all 0.1s"
                        }}
                          onMouseEnter={e=>{if(!actif){e.target.style.borderColor="#c9a84c";e.target.style.background="#fef9e7";}}}
                          onMouseLeave={e=>{if(!actif){e.target.style.borderColor="#e5e7eb";e.target.style.background="#fff";}}}
                        >{slot.start}</button>
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

// ─── ÉTAPE 3 : INFOS CLIENT ───────────────────────────────────────────────────
function EtapeInfos({onSubmit, loading}) {
  const [form, setForm] = useState({prenom:"",nom:"",email:"",telephone:"",date_naissance:"",adresse:"",genre:""});
  const [errors, setErrors] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const valider = () => {
    const e = {};
    if (!form.prenom.trim()) e.prenom = "Prénom requis";
    if (!form.nom.trim()) e.nom = "Nom requis";
    if (!form.email.trim()||!/\S+@\S+\.\S+/.test(form.email)) e.email = "Email valide requis";
    if (!form.telephone.trim()) e.telephone = "Téléphone requis";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:700,color:"#0d1b2a",marginBottom:4}}>Vos informations</h2>
      <p style={{fontSize:14,color:"#6b7280",marginBottom:24}}>Ces informations nous permettent de confirmer votre rendez-vous.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Champ label="Prénom" value={form.prenom} onChange={v=>set("prenom",v)} required error={errors.prenom} />
        <Champ label="Nom" value={form.nom} onChange={v=>set("nom",v)} required error={errors.nom} />
        <Champ label="Email" type="email" value={form.email} onChange={v=>set("email",v)} required error={errors.email} />
        <Champ label="Téléphone" type="tel" value={form.telephone} onChange={v=>set("telephone",v)} placeholder="06 XX XX XX XX" required error={errors.telephone} />
        <Champ label="Date de naissance" type="date" value={form.date_naissance} onChange={v=>set("date_naissance",v)} />
        <Champ label="Genre" value={form.genre} onChange={v=>set("genre",v)} options={["Homme","Femme","Autre"]} />
        <div style={{gridColumn:"1/-1"}}>
          <Champ label="Adresse" value={form.adresse} onChange={v=>set("adresse",v)} placeholder="Rue, ville, code postal" />
        </div>
      </div>
      <button
        onClick={()=>{ if(valider()) onSubmit(form); }}
        disabled={loading}
        style={{
          marginTop:24,width:"100%",padding:"13px",
          background:loading?"#e5e7eb":"#c9a84c",
          color:loading?"#9ca3af":"#fff",
          border:"none",borderRadius:10,fontSize:15,fontWeight:700,
          cursor:loading?"default":"pointer"
        }}
      >{loading?"Confirmation en cours...":"Confirmer le rendez-vous →"}</button>
    </div>
  );
}

// ─── ÉTAPE 4 : CONFIRMATION ───────────────────────────────────────────────────
function EtapeConfirmation({rdv}) {
  const d = new Date(rdv.date_rdv+"T12:00:00");
  const dateStr = `${JOURS_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
  return (
    <div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:"#c9a84c",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:32}}>✓</div>
      <h2 style={{fontSize:26,fontWeight:700,color:"#0d1b2a",marginBottom:8}}>Rendez-vous confirmé !</h2>
      <p style={{fontSize:14,color:"#6b7280",marginBottom:28}}>
        Un email de confirmation a été envoyé à <strong>{rdv.client_email}</strong>
      </p>
      <div style={{background:"#f9fafb",borderRadius:12,padding:24,textAlign:"left",maxWidth:420,margin:"0 auto 24px"}}>
        <div style={{fontSize:17,fontWeight:700,color:"#0d1b2a",marginBottom:16,paddingBottom:12,borderBottom:"1px solid #e5e7eb"}}>
          {rdv.service_nom}
        </div>
        {[
          ["📅", dateStr],
          ["🕐", `${rdv.heure_debut} – ${rdv.heure_fin}`],
          ["⏱", `${rdv.service_duree} minutes`],
          ["💶", rdv.service_prix===0?"Gratuit":`${rdv.service_prix},00 €`],
          ["📍", "41 Rue Néricault Destouches, 37000 Tours"],
          ["📞", "06 72 42 95 11"],
          ["👤", `${rdv.client_prenom} ${rdv.client_nom}`],
        ].map(([icon,text],i) => (
          <div key={i} style={{display:"flex",gap:10,marginBottom:9,alignItems:"center"}}>
            <span style={{fontSize:16,width:24,textAlign:"center"}}>{icon}</span>
            <span style={{fontSize:13,color:"#374151"}}>{text}</span>
          </div>
        ))}
      </div>
      <p style={{fontSize:12,color:"#9ca3af"}}>Pour annuler, appelez-nous au <strong>06 72 42 95 11</strong> au moins 6h avant.</p>
      <button onClick={()=>window.location.reload()} style={{marginTop:20,padding:"10px 24px",background:"#0d1b2a",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600}}>
        Faire une nouvelle réservation
      </button>
    </div>
  );
}

// ─── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [dateTime, setDateTime] = useState(null);
  const [rdvConfirme, setRdvConfirme] = useState(null);
  const [services, setServices] = useState(SERVICES_DEFAUT);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(null);

  // Charger les prestations depuis Supabase
  useEffect(()=>{
    db("services?actif=eq.true&supprime=eq.false&select=id,nom,duree,prix,couleur,categorie_id")
      .then(data => {
        if (data && data.length > 0) {
          // Mapper categorie_id vers nom de catégorie
          const cats = {1:"Coupe",2:"Barbe",3:"Couleur",4:"Soin",5:"Autre"};
          setServices(data.map(s=>({...s, categorie: cats[s.categorie_id]||"Autre"})));
        }
      })
      .catch(()=>{}); // garde les données statiques si erreur
  },[]);

  const confirmer = async (infosClient) => {
    setLoading(true);
    setErreur(null);
    try {
      const rdvData = {
        client_nom:     infosClient.nom,
        client_prenom:  infosClient.prenom,
        client_email:   infosClient.email,
        client_tel:     infosClient.telephone,
        service_nom:    service.nom,
        service_duree:  service.duree,
        service_prix:   service.prix,
        date_rdv:       dateTime.date,
        heure_debut:    dateTime.slot.start,
        heure_fin:      dateTime.slot.end,
        statut:         "confirmé",
        source:         "en_ligne",
        agenda:         "Elnagar",
      };

      // Sauvegarder le RDV dans Supabase
      const resultat = await db("appointments", {
        method: "POST",
        body: JSON.stringify(rdvData),
      });

      const rdvSauvegarde = Array.isArray(resultat) ? resultat[0] : resultat;

      // Sauvegarder / mettre à jour le client
      try {
        await db("clients", {
          method: "POST",
          body: JSON.stringify({
            nom:            infosClient.nom,
            prenom:         infosClient.prenom,
            email:          infosClient.email,
            telephone:      infosClient.telephone,
            date_naissance: infosClient.date_naissance||null,
            adresse:        infosClient.adresse||null,
            genre:          infosClient.genre||null,
            source:         "en_ligne",
          }),
          headers: { "Prefer": "return=representation,resolution=merge-duplicates" },
        });
      } catch(e) { /* client peut déjà exister */ }

      setRdvConfirme({
        ...rdvSauvegarde,
        ...rdvData,
        client_prenom: infosClient.prenom,
        client_nom:    infosClient.nom,
      });
      setStep(4);

    } catch(e) {
      console.error(e);
      setErreur("Une erreur est survenue. Veuillez réessayer ou nous appeler au 06 72 42 95 11.");
    }
    setLoading(false);
  };

  const peutContinuer = step===1?!!service : step===2?!!dateTime : true;

  const recapBar = () => {
    if (step===2 && service) return `${service.nom} · ${service.duree} min · ${fmt(service.prix)}`;
    if (step===3 && service && dateTime) {
      const d = new Date(dateTime.date+"T12:00:00");
      return `${service.nom} · ${d.getDate()} ${MOIS[d.getMonth()]} à ${dateTime.slot.start}`;
    }
    return "";
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d1b2a 0%,#1a3050 50%,#0d1b2a 100%)",fontFamily:"'Helvetica Neue',Arial,sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,background:"#c9a84c",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#0d1b2a",fontSize:20}}>E</div>
          <div>
            <div style={{color:"#fff",fontWeight:700,fontSize:16,letterSpacing:2}}>ELNAGAR</div>
            <div style={{color:"#94a3b8",fontSize:11}}>Coiffure Homme · Tours</div>
          </div>
        </div>
        <div style={{color:"#94a3b8",fontSize:12,display:"flex",gap:4,alignItems:"center"}}>
          <span>📍</span> 41 Rue Néricault Destouches, 37000 Tours
        </div>
      </div>

      {/* Stepper */}
      {step<4 && (
        <div style={{padding:"14px 24px",display:"flex",gap:16,alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          {["Prestation","Créneau","Informations"].map((label,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
              <Etape n={i+1} label={label} active={step===i+1} done={step>i+1} />
              {i<2 && <div style={{width:20,height:1,background:step>i+1?"#c9a84c":"rgba(255,255,255,0.15)"}} />}
            </div>
          ))}
        </div>
      )}

      {/* Carte principale */}
      <div style={{flex:1,display:"flex",alignItems:"start",justifyContent:"center",padding:"24px 16px"}}>
        <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:920,boxShadow:"0 24px 60px rgba(0,0,0,0.35)",overflow:"hidden"}}>
          <div style={{padding:"28px 32px"}}>
            {step===1 && <EtapePrestation services={services} onSelect={s=>{setService(s);}} selected={service} />}
            {step===2 && service && <EtapeCreneau service={service} onSelect={setDateTime} selected={dateTime} />}
            {step===3 && <EtapeInfos onSubmit={confirmer} loading={loading} />}
            {step===4 && rdvConfirme && <EtapeConfirmation rdv={rdvConfirme} />}
            {erreur && (
              <div style={{marginTop:12,padding:"10px 14px",background:"#fee2e2",borderRadius:8,color:"#991b1b",fontSize:13}}>
                {erreur}
              </div>
            )}
          </div>

          {/* Navigation bas */}
          {step<4 && (
            <div style={{padding:"14px 32px",borderTop:"1px solid #f3f4f6",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fafafa"}}>
              <button
                onClick={()=>step>1&&setStep(s=>s-1)}
                disabled={step===1}
                style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #e5e7eb",background:"none",color:step===1?"#d1d5db":"#374151",cursor:step===1?"default":"pointer",fontSize:13,fontWeight:500}}
              >← Retour</button>

              <span style={{fontSize:12,color:"#6b7280",textAlign:"center",maxWidth:300}}>{recapBar()}</span>

              {step<3 ? (
                <button
                  onClick={()=>peutContinuer&&setStep(s=>s+1)}
                  disabled={!peutContinuer}
                  style={{padding:"8px 22px",borderRadius:8,border:"none",background:peutContinuer?"#c9a84c":"#e5e7eb",color:peutContinuer?"#fff":"#9ca3af",cursor:peutContinuer?"pointer":"default",fontSize:13,fontWeight:600}}
                >Suivant →</button>
              ) : <div style={{width:80}} />}
            </div>
          )}
        </div>
      </div>

      <div style={{padding:"14px",textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:11}}>
        © {new Date().getFullYear()} Salon Elnagar · Réservation en ligne · 06 72 42 95 11
      </div>
    </div>
  );
}
