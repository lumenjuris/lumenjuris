import { useState, useCallback, useEffect, useRef } from "react";

import { fetchProxy } from "../utils/fetchProxy";

const CC_DB = {
  "1486":{label:"Syntec — Bureaux d'études, numérique, conseil",short:"Syntec",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Position 1.1","Position 1.2","Position 2.1","Position 2.2","Position 2.3","Position 3.1","Position 3.2","Position 3.3"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "3248":{label:"Métallurgie",short:"Métallurgie",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Groupe A","Groupe B","Groupe C","Groupe D","Groupe E","Groupe F","Groupe G","Groupe H","Groupe I"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "1979":{label:"HCR — Hôtels, Cafés, Restaurants",short:"HCR",trialCadre:3,trialNonCadre:1,renewable:false,classifications:["Niveau I - Éch.1","Niveau I - Éch.2","Niveau II - Éch.1","Niveau II - Éch.2","Niveau III","Niveau IV","Niveau V - Éch.1","Niveau V - Éch.2"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "573":{label:"Commerce de gros",short:"Commerce gros",trialCadre:3,trialNonCadre:2,renewable:true,classifications:["Niveau I","Niveau II","Niveau III","Niveau IV","Niveau V","Niveau VI","Niveau VII","Niveau VIII"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "1597":{label:"Bâtiment (+ de 10 salariés)",short:"Bâtiment",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Niveau I","Niveau II","Niveau III","Niveau IV","Cadre A","Cadre B","Cadre C"],noticeCadre:"3 mois",noticeNonCadre:"2 mois"},
  "16":{label:"Transports routiers",short:"Transports",trialCadre:3,trialNonCadre:2,renewable:true,classifications:["Groupe 1","Groupe 2","Groupe 3","Groupe 4","Groupe 5","Groupe 6","Groupe 7"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "3043":{label:"Propreté et services associés",short:"Propreté",trialCadre:4,trialNonCadre:1,renewable:true,classifications:["AS 1","AS 2","AS 3","AQS 1","AQS 2","AQS 3","CE 1","CE 2","CE 3","Cadre 1","Cadre 2","Cadre 3"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "86":{label:"Publicité",short:"Publicité",trialCadre:3,trialNonCadre:1,renewable:true,classifications:["Employé 1","Employé 2","Employé 3","AM 1","AM 2","Cadre 1","Cadre 2","Cadre 3"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "2120":{label:"Banque",short:"Banque",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Technicien A","Technicien B","Technicien C","Technicien D","Cadre E","Cadre F","Cadre G","Cadre H"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "176":{label:"Industrie pharmaceutique",short:"Pharma",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Groupe 1","Groupe 2","Groupe 3","Groupe 4","Groupe 5","Groupe 6","Groupe 7","Groupe 8","Groupe 9","Groupe 10","Groupe 11"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "1672":{label:"Assurances",short:"Assurances",trialCadre:4,trialNonCadre:3,renewable:true,classifications:["Classe 1","Classe 2","Classe 3","Classe 4","Classe 5","Classe 6","Classe 7"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "1527":{label:"Immobilier",short:"Immobilier",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["E1","E2","E3","AM1","AM2","C1","C2","C3","C4"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "2098":{label:"Prestataires de services secteur tertiaire",short:"Presta. services",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Niveau I","Niveau II","Niveau III","Niveau IV","Niveau V","Niveau VI","Niveau VII"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "44":{label:"Industries chimiques",short:"Chimie",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["Coeff. 130","Coeff. 175","Coeff. 205","Coeff. 250","Coeff. 300","Coeff. 350","Coeff. 400","Coeff. 550"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "1516":{label:"Organismes de formation",short:"Formation",trialCadre:4,trialNonCadre:2,renewable:true,classifications:["A","B","C","D","E","F","G","H"],noticeCadre:"3 mois",noticeNonCadre:"1 mois"},
  "1501":{label:"Restauration rapide",short:"Restauration rapide",trialCadre:3,trialNonCadre:1,renewable:false,classifications:["Niveau I","Niveau II","Niveau III","Niveau IV"],noticeCadre:"2 mois",noticeNonCadre:"1 mois"},
};


const LIBRARY_MODELS = [
  {id:"cdi",name:"CDI — Contrat à durée indéterminée",desc:"Le contrat standard pour un emploi stable.",icon:"📋",popular:true},
  {id:"cdd",name:"CDD — Contrat à durée déterminée",desc:"Contrat temporaire avec motif obligatoire.",icon:"⏱️",soon:true},
  {id:"avenant",name:"Avenant au contrat de travail",desc:"Modification d'un contrat existant.",icon:"📝",soon:true},
  {id:"stage",name:"Convention de stage",desc:"Encadrement d'un stage en entreprise.",icon:"🎓",soon:true},
  {id:"rupture",name:"Rupture conventionnelle",desc:"Rupture amiable du contrat de travail.",icon:"🤝",soon:true},
  {id:"nda",name:"Accord de confidentialité (NDA)",desc:"Protection des informations sensibles.",icon:"🔒",soon:true},
];


const CLAUSES = [
  {id:"period",label:"Période d'essai",icon:"⏳",critical:true,desc:"Durée encadrée par la CC et la loi.",
    getFields:(cc,st)=>{const m=st==="Cadre"?cc?.trialCadre||4:cc?.trialNonCadre||2;const o=Array.from({length:m},(_,i)=>`${i+1} mois`);return[{id:"period_duration",label:`Durée (max ${m} mois)`,type:"select",options:o},{id:"period_renew",label:"Renouvelable ?",type:"select",options:cc?.renewable===false?["Non"]:["Non","Oui — 1 fois même durée"]}];},
    alert:"Art. L1221-19 à L1221-24. Le renouvellement nécessite un accord de branche + accord écrit du salarié."},
  {id:"non_compete",label:"Non-concurrence",icon:"🛡️",critical:true,desc:"Interdit au salarié de travailler chez un concurrent.",
    getFields:()=>[{id:"nc_dur",label:"Durée",type:"select",options:["6 mois","12 mois","18 mois","24 mois"]},{id:"nc_zone",label:"Zone géo.",placeholder:"Île-de-France",type:"text"},{id:"nc_comp",label:"Contrepartie",placeholder:"30% du brut mensuel",type:"text"}],
    alert:"4 conditions cumulatives (Cass. soc. 10/07/2002) : limitation temps + espace + activité + contrepartie."},
  {id:"confidentiality",label:"Confidentialité",icon:"🔒",critical:false,desc:"Protection des informations sensibles.",
    getFields:()=>[{id:"conf_dur",label:"Durée après départ",type:"select",options:["1 an","2 ans","3 ans","5 ans","Illimitée"]},{id:"conf_scope",label:"Périmètre",placeholder:"données clients, code source…",type:"text"}],alert:null},
  {id:"ip",label:"Propriété intellectuelle",icon:"💡",critical:true,desc:"Cession des droits sur les créations du salarié.",
    getFields:()=>[{id:"ip_scope",label:"Créations",placeholder:"logiciels, designs…",type:"text"},{id:"ip_terr",label:"Territoire",type:"select",options:["France","UE","Monde entier"]}],
    alert:"Logiciels : dévolution auto (art. L113-9 CPI). Autres œuvres : cession explicite (art. L131-3 CPI)."},
  {id:"remote",label:"Télétravail",icon:"🏠",critical:false,desc:"Conditions du travail à distance.",
    getFields:()=>[{id:"rem_days",label:"Jours/sem.",type:"select",options:["1 jour","2 jours","3 jours","4 jours","100%","Flexible"]},{id:"rem_allow",label:"Indemnité",placeholder:"50€/mois",type:"text"},{id:"rem_equip",label:"Équipement",placeholder:"PC, écran…",type:"text"}],
    alert:"ANI 26/11/2020 + prise en charge frais obligatoire (Cass. soc. 14/09/2022)."},
  {id:"mobility",label:"Mobilité",icon:"📍",critical:false,desc:"Modifier le lieu de travail.",
    getFields:()=>[{id:"mob_zone",label:"Zone",placeholder:"Région IDF",type:"text"},{id:"mob_notice",label:"Délai prévenance",type:"select",options:["15 jours","1 mois","2 mois","3 mois"]}],
    alert:"Zone précise obligatoire (Cass. soc. 12/01/2016)."},
  {id:"bonus",label:"Rémunération variable",icon:"💰",critical:false,desc:"Bonus, commissions, primes.",
    getFields:()=>[{id:"bon_type",label:"Type",type:"select",options:["Prime objectifs","Commission ventes","Bonus annuel","Intéressement"]},{id:"bon_amt",label:"Montant/%",placeholder:"10% brut annuel",type:"text"},{id:"bon_crit",label:"Critères",placeholder:"100% objectifs",type:"text"}],
    alert:"Objectifs réalistes communiqués en début de période (Cass. soc. 10/07/2013)."},
  {id:"exclusivity",label:"Exclusivité",icon:"🎯",critical:false,desc:"Interdit toute autre activité.",
    getFields:()=>[{id:"excl_scope",label:"Périmètre",type:"select",options:["Toute activité","Concurrente","Même secteur"]}],
    alert:"Proportionnalité requise (Cass. soc. 11/07/2000)."},
];

const CUSTOM_CLAUSE_SYS = `Tu es un expert en droit du travail français. Rédige une clause contractuelle à partir de la demande.
Réponds UNIQUEMENT en JSON: {"title":"...","article":"...","warnings":"... ou null","legal_refs":"..."}`;

const SYS_PROMPT = `Tu es un expert en droit du travail français, spécialisé CDI, à jour 2025-2026.
RÈGLES: 1. ENTRE LES SOUSSIGNÉS → Articles numérotés → Signatures. 2. Mentions obligatoires. 3. Chaque clause activée = article dédié détaillé avec réf. légales. 4. Adapte à la CC. 5. Français juridique pro. 6. Avertissement final.
Génère UNIQUEMENT le contrat.`;

const STEPS = ["Entreprise","Salarié & Poste","Clauses","Génération"];

const FONT = "'Quicksand', sans-serif";
const C = {
  bg: "#F7F5F0", card: "#FFFFFF", primary: "#1B2A4A", gold: "#C9A84C", goldLight: "#F5EFD7",
  goldDark: "#9A7B2F", text: "#1B2A4A", muted: "#6B7280", light: "#9CA3AF",
  border: "#E5E1D8", success: "#2D6A4F", successBg: "#ECFDF5", successBorder: "#A7F3D0",
  warning: "#B45309", warningBg: "#FFFBEB", warningBorder: "#FDE68A",
  danger: "#DC2626", dangerBg: "#FEF2F2",
  infoBg: "#EFF6FF", infoBorder: "#BFDBFE", info: "#1D4ED8",
};

// ── Shared styles ──
const inputStyle = {
  width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:10,
  border:`1.5px solid ${C.border}`,background:C.card,color:C.text,
  fontSize:14,fontFamily:FONT,outline:"none",transition:"border 0.2s",
};
const cardStyle = {
  background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:20,marginBottom:16,
};
const btnPrimary = {
  padding:"12px 28px",borderRadius:12,border:"none",
  background:`linear-gradient(135deg, ${C.primary}, #2A3F6A)`,color:"#fff",
  cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:FONT,
};
const btnGold = {
  padding:"12px 28px",borderRadius:12,border:"none",
  background:`linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,color:"#fff",
  cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:FONT,
};
const btnSecondary = {
  padding:"8px 16px",borderRadius:8,border:`1.5px solid ${C.border}`,
  background:C.card,color:C.muted,cursor:"pointer",fontSize:12,fontFamily:FONT,
};

// ── Components ──
function Pill({ children, color = "gold" }) {
  const styles = {
    gold: { bg: C.goldLight, fg: C.goldDark },
    green: { bg: C.successBg, fg: C.success },
    blue: { bg: C.infoBg, fg: C.info },
    amber: { bg: C.warningBg, fg: C.warning },
  };
  const s = styles[color] || styles.gold;
  return (
    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: s.bg, color: s.fg, fontWeight: 700, fontFamily: FONT }}>
      {children}
    </span>
  );
}

function ProgressBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28, padding: "0 4px" }}>
      {STEPS.map((l, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: i <= step ? C.gold : C.border, transition: "all 0.4s" }} />}
            <div style={{
              width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0, fontFamily: FONT, transition: "all 0.3s",
              background: i < step ? C.gold : i === step ? C.primary : C.card,
              color: i <= step ? "#fff" : C.muted, border: i === step ? "none" : `1.5px solid ${i < step ? C.gold : C.border}`,
            }}>{i < step ? "✓" : i + 1}</div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? C.gold : C.border, transition: "all 0.4s" }} />}
          </div>
          <span style={{ fontSize: 10, color: i <= step ? C.primary : C.light, marginTop: 6, textAlign: "center", fontWeight: i === step ? 700 : 500, fontFamily: FONT }}>{l}</span>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", options, required, half }) {
  return (
    <div style={{ flex: half ? "1 1 48%" : "1 1 100%", minWidth: half ? 170 : undefined }}>
      <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 4, display: "flex", gap: 3, fontFamily: FONT }}>
        {label}{required && <span style={{ color: C.danger }}>*</span>}
      </label>
      {type === "select" ? (
        <select value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
          <option value="">— Sélectionner —</option>
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
      ) : (
        <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

function ClauseCard({ clause, active, onToggle, data, onFieldChange, cc, status }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const fields = clause.getFields(cc, status);
  return (
    <div style={{
      borderRadius: 14, border: active ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
      background: active ? C.goldLight : C.card, transition: "all 0.3s", overflow: "hidden",
    }}>
      <div onClick={() => { onToggle(); if (!active) setOpen(true); }} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, border: active ? `2px solid ${C.gold}` : `2px solid ${C.border}`,
          background: active ? C.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "#fff", flexShrink: 0,
        }}>{active ? "✓" : ""}</div>
        <span style={{ fontSize: 20 }}>{clause.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT }}>
            {clause.label}{clause.critical && <Pill color="amber">CLÉ</Pill>}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: FONT }}>{clause.desc}</div>
        </div>
        <span style={{ color: C.light, fontSize: 16, transform: open && active ? "rotate(180deg)" : "", transition: "transform 0.2s" }}>▾</span>
      </div>
      {active && open && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
          {clause.alert && (
            <div style={{ margin: "10px 0", padding: "10px 14px", borderRadius: 10, background: C.infoBg, border: `1px solid ${C.infoBorder}`, fontSize: 12, lineHeight: 1.6, color: C.info, fontFamily: FONT }}>
              ⚖️ {clause.alert}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {fields.map(fld => (
              <Field key={fld.id} label={fld.label} value={data[fld.id]} onChange={v => onFieldChange(fld.id, v)} placeholder={fld.placeholder} type={fld.type || "text"} options={fld.options} half={fields.length > 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──
export function GenerationContract() {
  const [page, setPage] = useState("home"); // home | modelSelect | wizard
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    siret:"",companyName:"",companyForm:"SAS",companyAddress:"",companyRep:"",companyRepTitle:"Président",
    ccIdcc:"",ccLabel:"",ccUrl:"",searchQ:"",
    employeeName:"",employeeAddress:"",employeeSS:"",
    jobTitle:"",jobStatus:"Cadre",jobClassification:"",workLocation:"",workTime:"35h/semaine",
    salary:"",salaryMonthly:"",startDate:"",
    activeClauses:["period"],clauseData:{period_duration:"2 mois",period_renew:"Non"},
    extraNotes:"",
  });
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [siretLoading, setSiretLoading] = useState(false);
  const [siretStatus, setSiretStatus] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customClauses, setCustomClauses] = useState([]);
  const [genClause, setGenClause] = useState(false);
  const [savedProfile, setSavedProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const cc = f.ccIdcc ? (CC_DB[f.ccIdcc] || { label: f.ccLabel, short: f.ccLabel, trialCadre: 4, trialNonCadre: 2, renewable: true, classifications: [], noticeCadre: "3 mois", noticeNonCadre: "1 mois" }) : null;
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const uC = (id, v) => setF(p => ({ ...p, clauseData: { ...p.clauseData, [id]: v } }));
  const toggleCl = id => setF(p => ({ ...p, activeClauses: p.activeClauses.includes(id) ? p.activeClauses.filter(c => c !== id) : [...p.activeClauses, id] }));

  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("company_profile"); if (r?.value) setSavedProfile(JSON.parse(r.value)); } catch {}
      setProfileLoaded(true);
    })();
  }, []);
  const applyProfile = () => { if (savedProfile) { setF(p => ({ ...p, ...savedProfile })); setSiretStatus({ type: "saved" }); } };
  const saveProfile = async () => {
    setSaving(true);
    const pr = { siret: f.siret, companyName: f.companyName, companyForm: f.companyForm, companyAddress: f.companyAddress, companyRep: f.companyRep, companyRepTitle: f.companyRepTitle, ccIdcc: f.ccIdcc, ccLabel: f.ccLabel, ccUrl: f.ccUrl };
    try { await window.storage.set("company_profile", JSON.stringify(pr)); setSavedProfile(pr); } catch {}
    setTimeout(() => setSaving(false), 1200);
  };
  const clearProfile = async () => { try { await window.storage.delete("company_profile"); } catch {} setSavedProfile(null); };

  const lookupSiret = useCallback(async (siret) => {
    const clean = siret.replace(/\s/g, "");
    if (clean.length !== 14 || !/^\d+$/.test(clean)) return;
    setSiretLoading(true); setSiretStatus(null);
    try {
      const res = await fetchProxy(`https://siret2idcc.fabrique.social.gouv.fr/api/v2/${clean}`);
      const data = await res.json();
      if (data?.[0]?.conventions?.length) {
        const cv = data[0].conventions[0];
        u("ccIdcc", cv.num); u("ccLabel", cv.title); u("ccUrl", cv.url || "");
        setSiretStatus({ type: "success", title: cv.shortTitle || cv.title, idcc: cv.num, effectif: cv.effectif });
      } else { setSiretStatus({ type: "notfound" }); }
    } catch { setSiretStatus({ type: "error" }); }
    finally { setSiretLoading(false); }
  }, []);

  const searchCompany = useCallback(async (q) => {
    if (q.length < 3) return;
    setSearchLoading(true);
    try {
      const res = await fetchProxy(`https://recherche-entreprises.fabrique.social.gouv.fr/api/v1/search?query=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setSearchResults(data?.entreprises || []); setShowSearch(true);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, []);

  const selectCompany = (ent) => {
    u("siret", ent.firstMatchingEtablissement?.siret || "");
    u("companyName", ent.simpleLabel || ent.label || "");
    u("companyAddress", ent.firstMatchingEtablissement?.address || "");
    setShowSearch(false);
    if (ent.conventions?.length) {
      const cv = ent.conventions[0];
      u("ccIdcc", String(cv.idcc)); u("ccLabel", cv.shortTitle || cv.title || "");
      setSiretStatus({ type: "success", title: cv.shortTitle || "", idcc: String(cv.idcc) });
    } else if (ent.firstMatchingEtablissement?.siret) { lookupSiret(ent.firstMatchingEtablissement.siret); }
  };

  const genCustomClause = async () => {
    if (!customInput.trim()) return; setGenClause(true);
    try {
      const ctx = `CC: ${cc?.label || "?"}. Statut: ${f.jobStatus}. Poste: ${f.jobTitle}.`;
      const res = await fetchProxy("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: CUSTOM_CLAUSE_SYS, messages: [{ role: "user", content: `${ctx}\n\nDemande: ${customInput}` }], tools: [{ type: "web_search_20250305", name: "web_search" }] }) });
      const data = await res.json();
      const txt = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      let parsed; try { parsed = JSON.parse(txt.replace(/```json|```/g, "").trim()); } catch { parsed = { title: "Clause", article: txt, warnings: null, legal_refs: "" }; }
      setCustomClauses(p => [...p, { ...parsed, id: Date.now(), request: customInput }]); setCustomInput("");
    } catch {} finally { setGenClause(false); }
  };

  const generate = useCallback(async () => {
    setLoading(true); setOutput(""); setStep(3);
    let clTxt = ""; f.activeClauses.forEach(id => { const cl = CLAUSES.find(c => c.id === id); if (!cl) return; const fds = cl.getFields(cc, f.jobStatus); clTxt += `\n- ${cl.label} : ${fds.map(fd => `${fd.label}: ${f.clauseData[fd.id] || "[?]"}`).join(", ")}`; });
    let custTxt = ""; if (customClauses.length) custTxt = "\n\nCLAUSES PERSONNALISÉES:\n" + customClauses.map(c => `--- ${c.title} ---\n${c.article}`).join("\n\n");
    const prompt = `CDI conforme CC ${cc?.label || "?"} (IDCC ${f.ccIdcc || "?"}).\nENTREPRISE: ${f.companyName||"?"} (${f.companyForm}) SIRET ${f.siret||"?"} — ${f.companyAddress||"?"} — Rep: ${f.companyRep||"?"} (${f.companyRepTitle})\nSALARIÉ: ${f.employeeName||"?"} — ${f.employeeAddress||"?"} — SS: ${f.employeeSS||"?"}\nPOSTE: ${f.jobTitle||"?"} — ${f.jobStatus} — Classif: ${f.jobClassification||"?"} — Lieu: ${f.workLocation||"?"} — Temps: ${f.workTime}\nRÉMUN: Annuel ${f.salary||"?"} — Mensuel ${f.salaryMonthly||"?"}\nDÉBUT: ${f.startDate||"?"}\nCLAUSES:${clTxt||"\nStandards."}${custTxt}\n${f.extraNotes?`INSTRUCTIONS: ${f.extraNotes}`:""}`;
    try {
      const res = await fetchProxy("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4096, system: SYS_PROMPT, messages: [{ role: "user", content: prompt }] }) });
      const data = await res.json(); setOutput(data.content?.map(b => b.text || "").join("\n") || "Erreur.");
    } catch { setOutput("Erreur de connexion."); } finally { setLoading(false); }
  }, [f, cc, customClauses]);


  
  // ══════════════════════════════════════
  // PAGES
  // ══════════════════════════════════════
  // ── HOME ──
  if (page === "home") {
    return (
      <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚖️</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.primary, margin: "0 0 8px", fontFamily: FONT }}>Lumen Juris</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: "0 0 40px", fontFamily: FONT }}>Générez vos contrats RH en quelques minutes, conformes et à jour.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 500, margin: "0 auto 40px" }}>
            <button onClick={() => setPage("modelSelect")} style={{ ...cardStyle, cursor: "pointer", padding: "32px 20px", textAlign: "center", border: `2px solid ${C.gold}`, marginBottom: 0 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Générer un contrat</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontFamily: FONT }}>CDI, CDD, avenant…</div>
            </button>
            <button onClick={() => {}} style={{ ...cardStyle, cursor: "pointer", padding: "32px 20px", textAlign: "center", opacity: 0.5, marginBottom: 0 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Analyser un contrat</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontFamily: FONT }}>Bientôt disponible</div>
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 12, color: C.muted, fontFamily: FONT }}>
            <span>✓ Hébergé en France</span>
            <span>✓ IA + Légifrance</span>
            <span>✓ Conforme RGPD</span>
          </div>
        </div>
      </div>
    );
  }

  // ── MODEL SELECT ──
  if (page === "modelSelect") {
    return (
      <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ borderBottom: `1px solid ${C.border}`, background: C.card, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setPage("home")} style={{ ...btnSecondary, fontSize: 13, padding: "6px 12px" }}>← Retour</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Choisir un modèle</h1>
          </div>
        </div>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
          {/* Upload own */}
          <div style={{ ...cardStyle, border: `2px dashed ${C.gold}`, textAlign: "center", padding: 28, cursor: "pointer", marginBottom: 20 }} onClick={() => {}}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Importer votre modèle</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontFamily: FONT }}>Téléversez un Word ou PDF — bientôt disponible</div>
          </div>

          {/* Saved models */}
          {savedProfile && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 10, fontFamily: FONT }}>Modèles enregistrés</h2>
              <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", marginBottom: 0 }} onClick={() => { applyProfile(); setPage("wizard"); }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.goldLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.primary, fontFamily: FONT }}>CDI — {savedProfile.companyName}</div>
                  <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Profil entreprise sauvegardé · IDCC {savedProfile.ccIdcc || "—"}</div>
                </div>
                <Pill color="green">Prêt</Pill>
              </div>
            </div>
          )}

          {/* Library */}
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 10, fontFamily: FONT }}>Bibliothèque de modèles</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {LIBRARY_MODELS.map(m => (
              <div key={m.id} onClick={() => { if (!m.soon) { setPage("wizard"); } }} style={{
                ...cardStyle, display: "flex", alignItems: "center", gap: 14,
                cursor: m.soon ? "default" : "pointer", opacity: m.soon ? 0.5 : 1, marginBottom: 0,
                border: m.popular ? `2px solid ${C.gold}` : `1px solid ${C.border}`,
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: m.popular ? C.goldLight : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: FONT, display: "flex", alignItems: "center", gap: 8 }}>
                    {m.name}
                    {m.popular && <Pill color="gold">Disponible</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: FONT }}>{m.desc}</div>
                </div>
                {m.soon && <span style={{ fontSize: 11, color: C.light, fontFamily: FONT }}>Bientôt</span>}
                {!m.soon && <span style={{ fontSize: 16, color: C.gold }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── WIZARD ──
  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => { if (step === 0) setPage("modelSelect"); else setStep(s => s - 1); }} style={{ ...btnSecondary, fontSize: 13, padding: "6px 12px" }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Nouveau CDI</h1>
          <p style={{ margin: 0, fontSize: 11, color: C.muted, fontFamily: FONT }}>Conforme Code du travail · Droit français 2025-2026</p>
        </div>
        <Pill color="green">Légifrance</Pill>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>
        {step < 3 && <ProgressBar step={step} />}

        {/* ═══ STEP 0 ═══ */}
        {step === 0 && (
          <div>
            {profileLoaded && savedProfile && !f.companyName && (
              <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12, background: C.goldLight, border: `1px solid ${C.gold}`, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 22 }}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, fontFamily: FONT }}>Profil trouvé : {savedProfile.companyName}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>Pré-remplir automatiquement ?</div>
                </div>
                <button onClick={applyProfile} style={{ ...btnGold, padding: "8px 18px", fontSize: 12 }}>Utiliser</button>
              </div>
            )}

            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT }}>
                🏢 Entreprise <Pill color="green">Auto-détection CC</Pill>
              </h2>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted, fontFamily: FONT }}>Entrez votre SIRET ou cherchez par nom pour remplir automatiquement la convention collective.</p>

              <div style={{ position: "relative", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={f.searchQ || ""} onChange={e => u("searchQ", e.target.value)} placeholder="Rechercher par nom d'entreprise…" style={{ ...inputStyle, flex: 1, border: `1.5px solid ${C.gold}40` }} />
                  <button onClick={() => searchCompany(f.searchQ)} disabled={searchLoading || (f.searchQ || "").length < 3} style={{ ...btnGold, padding: "10px 18px", fontSize: 12, opacity: (f.searchQ || "").length >= 3 ? 1 : 0.4 }}>
                    {searchLoading ? "…" : "Chercher"}
                  </button>
                </div>
                {showSearch && searchResults.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4, borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, maxHeight: 220, overflowY: "auto", boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
                    {searchResults.map((ent, i) => (
                      <button key={i} onClick={() => selectCompany(ent)} style={{ width: "100%", padding: "12px 16px", border: "none", borderBottom: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: "pointer", textAlign: "left", fontSize: 13, fontFamily: FONT }}>
                        <div style={{ fontWeight: 600 }}>{ent.simpleLabel || ent.label}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{ent.firstMatchingEtablissement?.address || ""}{ent.conventions?.length ? ` · CC: ${ent.conventions[0].shortTitle || ent.conventions[0].idcc}` : ""}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: "1 1 48%", minWidth: 170 }}>
                  <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 4, display: "flex", gap: 3, fontFamily: FONT }}>SIRET <span style={{ color: C.danger }}>*</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={f.siret} onChange={e => { u("siret", e.target.value); setSiretStatus(null); }} placeholder="123 456 789 00012" style={{ ...inputStyle, flex: 1, border: siretStatus?.type === "success" ? `1.5px solid ${C.success}` : `1.5px solid ${C.border}` }} />
                    <button onClick={() => lookupSiret(f.siret)} disabled={siretLoading} style={{ ...btnPrimary, padding: "10px 16px", fontSize: 12 }}>
                      {siretLoading ? "⏳" : "Détecter"}
                    </button>
                  </div>
                  {siretStatus?.type === "success" && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: C.successBg, border: `1px solid ${C.successBorder}`, fontSize: 12, color: C.success, fontFamily: FONT }}>
                      ✓ <strong>{siretStatus.title}</strong> — IDCC {siretStatus.idcc}{siretStatus.effectif ? ` · ${Math.round(siretStatus.effectif / 1000)}k salariés` : ""}
                    </div>
                  )}
                  {siretStatus?.type === "notfound" && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: C.warningBg, border: `1px solid ${C.warningBorder}`, fontSize: 12, color: C.warning, fontFamily: FONT }}>Aucune CC trouvée. Sélectionnez manuellement.</div>
                  )}
                </div>
                <Field label="Raison sociale" value={f.companyName} onChange={v => u("companyName", v)} placeholder="TechCorp" required half />
                <Field label="Forme juridique" value={f.companyForm} onChange={v => u("companyForm", v)} type="select" options={["SAS", "SARL", "SA", "EURL", "SCI", "Association"]} half />
                <Field label="Adresse siège" value={f.companyAddress} onChange={v => u("companyAddress", v)} placeholder="15 rue Tech, 75009 Paris" half />
                <Field label="Représentant légal" value={f.companyRep} onChange={v => u("companyRep", v)} placeholder="Marie Martin" required half />
                <Field label="Qualité" value={f.companyRepTitle} onChange={v => u("companyRepTitle", v)} type="select" options={["Président", "Gérant", "DG", "DRH"]} half />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button onClick={saveProfile} disabled={saving} style={{ ...btnSecondary, fontSize: 11, color: saving ? C.success : C.muted }}>
                  {saving ? "✓ Sauvegardé !" : "💾 Sauvegarder ce profil"}
                </button>
              </div>
            </div>

            {/* CC */}
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT }}>
                📜 Convention collective {f.ccIdcc && <Pill color="green">IDCC {f.ccIdcc}</Pill>}
              </h2>
              {cc ? (
                <div style={{ padding: "14px 16px", borderRadius: 12, background: C.successBg, border: `1px solid ${C.successBorder}` }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.success, fontFamily: FONT }}>{cc.label || f.ccLabel}</div>
                  <div style={{ fontSize: 12, color: C.success, marginTop: 4, fontFamily: FONT, opacity: 0.8 }}>Période essai max : {cc.trialCadre}m (cadre) / {cc.trialNonCadre}m (non-cadre) · Préavis : {cc.noticeCadre} (cadre)</div>
                  {f.ccUrl && <a href={f.ccUrl} target="_blank" rel="noopener" style={{ fontSize: 12, color: C.info, marginTop: 4, display: "inline-block", fontFamily: FONT }}>Voir sur Légifrance →</a>}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 12, color: C.muted, margin: "0 0 10px", fontFamily: FONT }}>Sélectionnez manuellement :</p>
                  <select value={f.ccIdcc} onChange={e => { u("ccIdcc", e.target.value); u("ccLabel", CC_DB[e.target.value]?.label || ""); u("jobClassification", ""); }} style={{ ...inputStyle, appearance: "auto" }}>
                    <option value="">— Choisir —</option>
                    {Object.entries(CC_DB).map(([id, c]) => <option key={id} value={id}>{c.label} (IDCC {id})</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ STEP 1 ═══ */}
        {step === 1 && (
          <div>
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.primary, fontFamily: FONT }}>👤 Salarié(e)</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Field label="Nom complet" value={f.employeeName} onChange={v => u("employeeName", v)} placeholder="Jean Dupont" required half />
                <Field label="Adresse" value={f.employeeAddress} onChange={v => u("employeeAddress", v)} placeholder="12 rue de Rivoli, 75001 Paris" half />
                <Field label="N° Sécurité sociale" value={f.employeeSS} onChange={v => u("employeeSS", v)} placeholder="1 85 12 75 108 042 36" half />
              </div>
            </div>
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.primary, fontFamily: FONT }}>💼 Poste</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Field label="Intitulé" value={f.jobTitle} onChange={v => u("jobTitle", v)} placeholder="Développeur Full-Stack" required half />
                <Field label="Statut" value={f.jobStatus} onChange={v => u("jobStatus", v)} type="select" options={["Cadre", "Non-cadre (ETAM)", "Agent de maîtrise", "Ouvrier/Employé"]} required half />
                <Field label="Classification" value={f.jobClassification} onChange={v => u("jobClassification", v)} type={cc?.classifications?.length ? "select" : "text"} options={cc?.classifications} placeholder={cc?.classifications?.length ? undefined : "Ex : Position 2.1"} half />
                <Field label="Lieu de travail" value={f.workLocation} onChange={v => u("workLocation", v)} placeholder="Paris 9e" half />
                <Field label="Temps de travail" value={f.workTime} onChange={v => u("workTime", v)} type="select" options={["35h/semaine", "39h/semaine", "Forfait jours (218j)", "Temps partiel"]} half />
              </div>
            </div>
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: C.primary, fontFamily: FONT }}>💶 Rémunération & Démarrage</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Field label="Salaire brut annuel" value={f.salary} onChange={v => u("salary", v)} placeholder="45 000 €" required half />
                <Field label="Salaire brut mensuel" value={f.salaryMonthly} onChange={v => u("salaryMonthly", v)} placeholder="3 750 €" half />
                <Field label="Date de début" value={f.startDate} onChange={v => u("startDate", v)} type="date" required half />
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2 ═══ */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, background: C.goldLight, border: `1px solid ${C.gold}` }}>
              <p style={{ margin: 0, fontSize: 13, color: C.goldDark, lineHeight: 1.6, fontFamily: FONT }}>
                <strong>🎯 Clauses sur mesure</strong> — Adaptées à la CC {cc?.short || ""}. Les alertes juridiques citent le Code du travail.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CLAUSES.map(cl => (
                <ClauseCard key={cl.id} clause={cl} active={f.activeClauses.includes(cl.id)} onToggle={() => toggleCl(cl.id)} data={f.clauseData} onFieldChange={uC} cc={cc} status={f.jobStatus} />
              ))}
            </div>
            <div style={{ ...cardStyle, marginTop: 14 }}>
              <Field label="Instructions supplémentaires" value={f.extraNotes} onChange={v => u("extraNotes", v)} type="textarea" placeholder="Véhicule de fonction, tickets restaurant, mutuelle…" />
            </div>

            {/* Custom clause */}
            <div style={{ marginTop: 14, borderRadius: 14, border: `2px solid ${C.primary}20`, background: `${C.primary}08`, padding: 18 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 8, fontFamily: FONT }}>
                ✨ Clause sur mesure IA <Pill color="blue">Recherche web</Pill>
              </h3>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: C.muted, fontFamily: FONT }}>Décrivez ce que vous souhaitez. L'IA génère une clause avec références légales.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={customInput} onChange={e => setCustomInput(e.target.value)} rows={2} placeholder="Ex : empêcher le salarié de débaucher mes clients pendant 1 an…" style={{ ...inputStyle, flex: 1, resize: "vertical" }} />
                <button onClick={genCustomClause} disabled={genClause || !customInput.trim()} style={{ ...btnPrimary, padding: "10px 18px", fontSize: 12, alignSelf: "flex-end", minHeight: 44, opacity: customInput.trim() ? 1 : 0.4 }}>
                  {genClause ? "⏳" : "⚡ Générer"}
                </button>
              </div>
              {customClauses.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {customClauses.map(cl => (
                    <div key={cl.id} style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, overflow: "hidden" }}>
                      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${C.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: FONT }}>📎 {cl.title}</div>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: FONT }}>« {cl.request} »</div>
                        </div>
                        <button onClick={() => setCustomClauses(p => p.filter(c => c.id !== cl.id))} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.danger}30`, background: C.dangerBg, color: C.danger, cursor: "pointer", fontSize: 10, fontWeight: 600, fontFamily: FONT }}>✕</button>
                      </div>
                      <div style={{ padding: "12px 16px", fontSize: 12, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap", fontFamily: FONT }}>{cl.article}</div>
                      {cl.warnings && <div style={{ margin: "0 16px 12px", padding: "8px 12px", borderRadius: 8, background: C.warningBg, border: `1px solid ${C.warningBorder}`, fontSize: 11, color: C.warning, fontFamily: FONT }}>⚠️ {cl.warnings}</div>}
                      {cl.legal_refs && <div style={{ margin: "0 16px 12px", padding: "8px 12px", borderRadius: 8, background: C.infoBg, border: `1px solid ${C.infoBorder}`, fontSize: 10, color: C.info, fontFamily: FONT }}>📚 {cl.legal_refs}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ STEP 3 ═══ */}
        {step === 3 && (
          <div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "70px 0" }}>
                <div style={{ width: 48, height: 48, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: "50%", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
                <p style={{ color: C.primary, fontSize: 15, fontWeight: 600, fontFamily: FONT }}>Rédaction du CDI…</p>
                <p style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>Adaptation à la CC {cc?.short || ""} (IDCC {f.ccIdcc})</p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.primary, fontFamily: FONT }}>📄 Votre CDI</h2>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStep(2)} style={btnSecondary}>← Modifier</button>
                    <button onClick={() => navigator.clipboard.writeText(output)} style={{ ...btnGold, padding: "8px 16px", fontSize: 12 }}>📋 Copier</button>
                  </div>
                </div>
                <div style={{ ...cardStyle, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.85, color: C.text, fontFamily: FONT }}>{output}</div>
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: C.warningBg, border: `1px solid ${C.warningBorder}`, fontSize: 12, color: C.warning, fontFamily: FONT }}>
                  ⚠️ Ce modèle est généré par IA. Il doit être relu et validé par un professionnel du droit avant toute signature.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        {step < 3 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            {step > 0 ? <button onClick={() => setStep(s => s - 1)} style={btnSecondary}>← Précédent</button> : <div />}
            {step < 2 ? (
              <button onClick={() => setStep(s => s + 1)} style={btnPrimary}>Suivant →</button>
            ) : (
              <button onClick={generate} style={btnGold}>⚡ Générer le CDI</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
