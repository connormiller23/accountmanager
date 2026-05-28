import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ACCTS, WEBSITES } from '../accounts_data.js';

function parseTimeline(s){
  if(!s||!s.trim())return null;
  const q=s.toLowerCase().trim();
  // YYYY-MM-DD or YYYY/MM/DD (check FIRST because it would conflict with MM/DD/YYYY)
  const iso=q.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if(iso)return new Date(+iso[1],(+iso[2])-1,+iso[3]).getTime();
  // MM/DD/YYYY or MM/DD/YY or MM-DD-YYYY
  const md=q.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if(md){const yr=+md[3];const fullYr=yr<100?2000+yr:yr;return new Date(fullYr,(+md[1])-1,+md[2]).getTime();}
  // Q1-Q4 with year
  const qm=q.match(/q([1-4])[\s\/,\-\.]*(\d{2,4})/);
  if(qm){const yr=+qm[2];const fullYr=yr<100?2000+yr:yr;return new Date(fullYr,(+qm[1]-1)*3).getTime();}
  // H1/H2 halves
  const hm=q.match(/h([12])[\s\/,\-\.]*(\d{2,4})/);
  if(hm){const yr=+hm[2];const fullYr=yr<100?2000+yr:yr;return new Date(fullYr,(+hm[1]-1)*6).getTime();}
  // EOY / End of Year
  const eoy=q.match(/(eoy|end of(?:\s+the)?\s+year|year[\s\-]?end)[\s\/,\-\.]*(\d{2,4})?/);
  if(eoy){const yr=eoy[2]?+eoy[2]:2026;const fullYr=yr<100?2000+yr:yr;return new Date(fullYr,11).getTime();}
  // Month name (with optional day and year)
  const MONS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,january:0,february:1,march:2,april:3,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
  for(const[k,v]of Object.entries(MONS)){
    if(q.includes(k)){
      // Find 4-digit year first
      const ym4=q.match(/\b(\d{4})\b/);
      let yr=ym4?+ym4[1]:2026;
      // Find day: 1-2 digits NOT followed by more digits (to avoid grabbing "20" from "2026")
      const dayRe=new RegExp(k+"[\\s,]+(\\d{1,2})(?!\\d)");
      const dm=q.match(dayRe);
      const day=dm?+dm[1]:1;
      return new Date(yr,v,day).getTime();
    }
  }
  // Just a year
  const yr=q.match(/^(\d{4})$/);
  if(yr)return new Date(+yr[1],0).getTime();
  return null;
}

const TIER_STYLE={A:{bg:"#dcfce7",c:"#15803d",border:"#86efac"},B:{bg:"#dbeafe",c:"#1d4ed8",border:"#93c5fd"},C:{bg:"#f3f4f6",c:"#6b7280",border:"#d1d5db"}};

const FLAG_OPTS=[
  {val:"",     label:"—",         word:"—",       bg:"transparent",                        c:"var(--color-text-tertiary)"},
  {val:"hot",  label:"Hot",       word:"Hot",     bg:"rgba(255,80,0,0.08)",                c:"var(--color-text-danger)"},
  {val:"med",  label:"Medium",    word:"Medium",  bg:"rgba(234,179,8,0.08)",               c:"var(--color-text-warning)"},
  {val:"low",  label:"Low",       word:"Low",     bg:"var(--color-background-secondary)",  c:"var(--color-text-secondary)"},
  {val:"nurt", label:"Nurture",   word:"Nurture", bg:"rgba(34,197,94,0.08)",               c:"var(--color-text-success)"},
];

const EMPTY_ACCT={name:"",location:"",tier:"A",industry:"",employees:"",techPersonas:"",hiringPersonas:"",hiringUrl:"",sfUrl:"",sfOppUrl:"",acctPlanName:"",pastOpp:"",description:"",statusNote:"",howTheyMakeMoney:"",whyAnything:"",whyNow:"",whyDatadog:"",timeline:"",notes:""};


// ============================================================
// MAIN COMPONENT
// ============================================================
function EditCell({id, field, val, ph, multiline, accent, linkHref, edit, tmp, setTmp, commit, setEdit, startEdit}) {
  const isE = edit && edit[0] === id && edit[1] === field;
  if (isE) {
    const props = {
      autoFocus: true,
      value: tmp,
      onChange: e => setTmp(e.target.value),
      onBlur: commit,
      onKeyDown: e => {
        if (!multiline && e.key === "Enter") commit();
        if (e.key === "Escape") { setEdit(null); setTmp(""); }
      },
      onClick: e => e.stopPropagation(),
      style: {
        width: "100%",
        fontSize: 12,
        padding: "3px 5px",
        boxSizing: "border-box",
        fontFamily: "var(--font-sans)",
        resize: multiline ? "vertical" : "none"
      }
    };
    return multiline ? <textarea {...props} rows={3} /> : <input {...props} />;
  }
  const inner = (
    <div onClick={e => startEdit(id, field, val, e)} style={{
      fontSize: 12,
      color: val ? (accent || "var(--color-text-primary)") : "var(--color-text-tertiary)",
      cursor: "text",
      minHeight: 18,
      fontStyle: val ? "normal" : "italic",
      lineHeight: 1.4,
      padding: "1px 0",
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: multiline ? 3 : 1,
      WebkitBoxOrient: "vertical"
    }}>
      {val || <span style={{ fontSize: 11 }}>{ph}</span>}
    </div>
  );
  if (linkHref && val) return <a href={val} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--color-text-info)", textDecoration: "none" }}>{val}</a>;
  return inner;
}

export default function AccountTracker(){
  const [tls,setTls]=useState({});  // legacy plain strings
  const [tlv,setTlv]=useState({});  // new structured {date,contact,reason}
  const [tlEdit,setTlEdit]=useState(null);
  const [tlTmp,setTlTmp]=useState({date:"",contact:"",reason:""});
  const [nts,setNts]=useState({});
  const [aps,setAps]=useState({});
  const [info,setInfo]=useState({});
  const [web,setWeb]=useState({});
  const [hyp,setHyp]=useState({}); // hypothesis overrides per id
  const [flags,setFlags]=useState({});
  const [flagPos,setFlagPos]=useState({top:0,left:0});
  const [names,setNames]=useState({}); // editable account name overrides
  const [sn,setSn]=useState({});       // editable status note overrides
  const [locs,setLocs]=useState({});    // location overrides
  const [tiers,setTiers]=useState({});  // tier overrides
  const [inds,setInds]=useState({});    // industry overrides
  const [emps,setEmps]=useState({});    // employee count overrides
  const [hps,setHps]=useState({});      // hiring persona text overrides
  const [hpUrls,setHpUrls]=useState({}); // hiring URL overrides
  const [sfUrls,setSfUrls]=useState({}); // Salesforce URL overrides
  const [descs,setDescs]=useState({});   // description overrides
  const [highlights,setHighlights]=useState({}); // {accountId: 'red'|'yellow'|'blue'}
  const [highlightLabels,setHighlightLabels]=useState({red:"Red",yellow:"Yellow",blue:"Blue"});
  const [editingLabel,setEditingLabel]=useState(null);
  const [pos,setPos]=useState({});      // past opp overrides
  const [customAccts,setCustomAccts]=useState([]);
  const [deletedIds,setDeletedIds]=useState(new Set());
  const [search,setSearch]=useState("");
  const [tierF,setTierF]=useState("All");
  const [sc,setSc]=useState("tier");
  const [sd,setSd]=useState("asc");
  const [exp,setExp]=useState(null);
  const [edit,setEdit]=useState(null);
  const [tmp,setTmp]=useState("");
  const [addOpen,setAddOpen]=useState(false);
  const [newAcct,setNewAcct]=useState(EMPTY_ACCT);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [flagMenu,setFlagMenu]=useState(null);

  const stateRef=useRef({tls,nts,aps,hyp,flags,customAccts,deletedIds,edit,tmp});
  useEffect(()=>{stateRef.current={tls,nts,aps,hyp,flags,customAccts,deletedIds,edit,tmp};},[tls,nts,aps,hyp,flags,customAccts,deletedIds,edit,tmp]);

  const persist=useCallback(async(key,val)=>{try{await window.storage.set(key,JSON.stringify(val));}catch{}},[]);

  useEffect(()=>{(async()=>{
    try{const r=await window.storage.get("tl");if(r)setTls(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("tlv2");if(r)setTlv(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("nt");if(r)setNts(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("ap2");if(r)setAps(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("info");if(r)setInfo(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("web");if(r)setWeb(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("hyp");if(r)setHyp(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("flags");if(r)setFlags(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("names");if(r)setNames(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("sn");if(r)setSn(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("locs");if(r)setLocs(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("tiers");if(r)setTiers(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("inds");if(r)setInds(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("emps");if(r)setEmps(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("hps");if(r)setHps(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("hpUrls");if(r)setHpUrls(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("sfUrls");if(r)setSfUrls(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("descs");if(r)setDescs(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("highlights");if(r)setHighlights(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("highlightLabels");if(r)setHighlightLabels(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("pos");if(r)setPos(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("custom");if(r)setCustomAccts(JSON.parse(r.value));}catch{}
    try{const r=await window.storage.get("deleted");if(r)setDeletedIds(new Set(JSON.parse(r.value)));}catch{}
  })();},[]);

  const setAndPersist=(setter,key,updater)=>setter(prev=>{const next=updater(prev);persist(key,next);return next;});

  const commit=useCallback((arg)=>{
    // Smart arg handling: accepts event objects, explicit strings, or undefined
    let v;
    if(typeof arg==='string') v=arg;
    else if(arg&&arg.target&&typeof arg.target.value==='string') v=arg.target.value;
    else v=stateRef.current.tmp;
    const ed=stateRef.current.edit;
    if(!ed)return;
    const[id,field]=ed;
    if(field==="tl")setAndPersist(setTls,"tl",p=>({...p,[id]:v}));
    else if(field==="nt")setAndPersist(setNts,"nt",p=>({...p,[id]:v}));
    else if(field==="ap")setAndPersist(setAps,"ap2",p=>({...p,[id]:v}));
    else if(field==="info")setAndPersist(setInfo,"info",p=>({...p,[id]:v}));
    else if(field==="web")setAndPersist(setWeb,"web",p=>({...p,[id]:v}));
    else if(field==="name")setAndPersist(setNames,"names",p=>({...p,[id]:v}));
    else if(field==="sn")setAndPersist(setSn,"sn",p=>({...p,[id]:v}));
    else if(field==="loc")setAndPersist(setLocs,"locs",p=>({...p,[id]:v}));
    else if(field==="tier2")setAndPersist(setTiers,"tiers",p=>({...p,[id]:v}));
    else if(field==="ind")setAndPersist(setInds,"inds",p=>({...p,[id]:v}));
    else if(field==="emp")setAndPersist(setEmps,"emps",p=>({...p,[id]:v}));
    else if(field==="hp")setAndPersist(setHps,"hps",p=>({...p,[id]:v}));
    else if(field==="sf")setAndPersist(setSfUrls,"sfUrls",p=>({...p,[id]:v}));
    else if(field==="desc")setAndPersist(setDescs,"descs",p=>({...p,[id]:v}));
    else if(field==="po")setAndPersist(setPos,"pos",p=>({...p,[id]:v}));
    else if(["howTheyMakeMoney","whyAnything","whyNow","whyDatadog"].includes(field))
      setAndPersist(setHyp,"hyp",p=>({...p,[id]:{...(p[id]||{}),[field]:v}}));
    setEdit(null);setTmp("");
  },[]);

  const startEdit=(id,field,cur,e)=>{if(e)e.stopPropagation();setEdit([id,field]);setTmp(cur);};

  const allAccts=useMemo(()=>[...ACCTS,...customAccts].filter(a=>!deletedIds.has(a.id)),[customAccts,deletedIds]);

  const rows=useMemo(()=>{
    let list=allAccts.map(a=>({...a,
      displayName: names[a.id]??a.name,
      displaySn: sn[a.id]??a.statusNote,
      tl:tls[a.id]??a.timeline,
      displayLoc: locs[a.id]??a.location,
      displayTier: tiers[a.id]??a.tier,
      displayInd: inds[a.id]??a.industry,
      displayEmp: emps[a.id]??a.employees,
      displayHp: hps[a.id]??a.hiringPersonas,
      hiringUrl: hpUrls[a.id]??a.hiringUrl,
      displayPo: pos[a.id]??a.pastOpp,
      tlData:tlv[a.id]||{date:tls[a.id]??a.timeline??"",contact:"",reason:""},
      nt:nts[a.id]??a.notes,
      createdAt: a.createdAt || null,
      apUrl:aps[a.id]??a.apUrl??"",
      infoUrl:info[a.id]??"",
      webUrl:web[a.id]??(WEBSITES[a.id]??""),
      sfUrlEff:sfUrls[a.id]??a.sfUrl??"",
      description:descs[a.id]??a.description??"",
      hyp:{...{howTheyMakeMoney:a.howTheyMakeMoney,whyAnything:a.whyAnything,whyNow:a.whyNow,whyDatadog:a.whyDatadog},...(hyp[a.id]||{})},
      flag:flags[a.id]||"",
    }));
    if(search){const q=search.toLowerCase();list=list.filter(a=>[a.name,a.location,a.industry,a.description,a.statusNote,a.pastOpp,a.hiringPersonas,a.tl,a.nt].some(f=>(f||"").toLowerCase().includes(q)));}
    if(tierF!=="All"){list=tierF==="—"?list.filter(a=>!a.displayTier):list.filter(a=>a.displayTier===tierF);}
    list.sort((a,b)=>{
      let av,bv;
      if(sc==="tl"){
        const ap=parseTimeline(a.tlData.date),bp=parseTimeline(b.tlData.date);
        // Push null/unparseable to the end in both directions
        if(ap===null&&bp===null)return 0;
        if(ap===null)return 1;
        if(bp===null)return -1;
        return sd==="asc"?ap-bp:bp-ap;
      }
      if(sc==="employees"){av=+a.employees||0;bv=+b.employees||0;return sd==="asc"?av-bv:bv-av;}
      if(sc==="tier"){const ord={A:0,B:1,C:2};const ai=ord[a.displayTier]!==undefined?ord[a.displayTier]:3;const bi=ord[b.displayTier]!==undefined?ord[b.displayTier]:3;return sd==="asc"?ai-bi:bi-ai;}
      if(sc==="po"){const yr=s=>{if(!s)return 0;const m=s.match(/20\d{2}/g);if(!m)return 0;return Math.max(...m.map(Number));};av=yr(a.displayPo||a.pastOpp||"");bv=yr(b.displayPo||b.pastOpp||"");return sd==="asc"?av-bv:bv-av;}
      if(sc==="createdAt"){const av=a.createdAt||0,bv=b.createdAt||0;return sd==="desc"?bv-av:av-bv;}
      if(sc==="flag"){const ord={hot:0,med:1,low:2,nurt:3};const ai=ord[a.flag]!==undefined?ord[a.flag]:4;const bi=ord[b.flag]!==undefined?ord[b.flag]:4;return sd==="asc"?ai-bi:bi-ai;}
      av=(a[sc]||"").toLowerCase();bv=(b[sc]||"").toLowerCase();
      return sd==="asc"?av<bv?-1:av>bv?1:0:av<bv?1:av>bv?-1:0;
    });
    return list;
  },[allAccts,search,tierF,sc,sd,tls,tlv,nts,aps,info,web,hyp,flags,names,sn,locs,tiers,inds,emps,hps,hpUrls,sfUrls,descs,pos]);

  const doSort=c=>{if(sc===c)setSd(d=>d==="asc"?"desc":"asc");else{setSc(c);setSd(c==="createdAt"?"desc":"asc");}};

  const deleteAcct=(id)=>{setDeletedIds(prev=>{const s=new Set(prev);s.add(id);persist("deleted",[...s]);return s;});setDeleteConfirm(null);setExp(null);};

  const toggleHighlight=(id,color)=>{
    setHighlights(prev=>{
      const next={...prev};
      if(next[id]===color)delete next[id]; // toggle off
      else next[id]=color;
      persist("highlights",next);
      return next;
    });
  };

  const updateHighlightLabel=(color,label)=>{
    setHighlightLabels(prev=>{
      const next={...prev,[color]:label};
      persist("highlightLabels",next);
      return next;
    });
  };

  const addAcct=()=>{
    if(!newAcct.name.trim())return;
    // Compute next ID as max of all existing IDs + 1 (prevents collisions across sessions)
    const baseIds=ACCTS.map(a=>a.id||0);
    const customIds=customAccts.map(a=>a.id||0);
    const newId=Math.max(199,...baseIds,...customIds)+1;
    const a={...EMPTY_ACCT,...newAcct,id:newId,createdAt:Date.now()};
    setCustomAccts(prev=>{const n=[...prev,a];persist("custom",n);return n;});
    setNewAcct(EMPTY_ACCT);setAddOpen(false);
  };

  // Export all data to JSON file
  const exportData=()=>{
    const data={
      version:"1.1",
      exportedAt:new Date().toISOString(),
      tls:tls,
      tlv:tlv,
      nts:nts,
      aps:aps,
      info:info,
      web:web,
      hyp:hyp,
      flags:flags,
      names:names,
      sn:sn,
      locs:locs,
      tiers:tiers,
      inds:inds,
      emps:emps,
      hps:hps,
      hpUrls:hpUrls,
      sfUrls:sfUrls,
      descs:descs,
      highlights:highlights,
      highlightLabels:highlightLabels,
      pos:pos,
      customAccts:customAccts,
      deletedIds:Array.from(deletedIds)
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    const date=new Date().toISOString().split("T")[0];
    a.download=`account_tracker_backup_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import data from JSON file
  const importData=(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(evt)=>{
      try{
        const data=JSON.parse(evt.target.result);
        if(!data.version){alert("Not a valid backup file");return;}
        if(!confirm("This will replace ALL your current edits with the backup. Continue?"))return;
        // Handle both new v1.1 format and old v1.0 keys for safety
        const t=data.tls||data.timelines;if(t){setTls(t);persist("tl",t);}
        if(data.tlv){setTlv(data.tlv);persist("tlv2",data.tlv);}
        const n=data.nts||data.notes;if(n){setNts(n);persist("nt",n);}
        const a=data.aps||data.acctPlans;if(a){setAps(a);persist("ap2",a);}
        if(data.info){setInfo(data.info);persist("info",data.info);}
        if(data.web){setWeb(data.web);persist("web",data.web);}
        if(data.hyp){setHyp(data.hyp);persist("hyp",data.hyp);}
        if(data.flags){setFlags(data.flags);persist("flags",data.flags);}
        if(data.names){setNames(data.names);persist("names",data.names);}
        const s=data.sn||data.statusNotes;if(s){setSn(s);persist("sn",s);}
        if(data.locs){setLocs(data.locs);persist("locs",data.locs);}
        if(data.tiers){setTiers(data.tiers);persist("tiers",data.tiers);}
        if(data.inds){setInds(data.inds);persist("inds",data.inds);}
        if(data.emps){setEmps(data.emps);persist("emps",data.emps);}
        if(data.hps){setHps(data.hps);persist("hps",data.hps);}
        if(data.hpUrls){setHpUrls(data.hpUrls);persist("hpUrls",data.hpUrls);}
        if(data.sfUrls){setSfUrls(data.sfUrls);persist("sfUrls",data.sfUrls);}
        if(data.descs){setDescs(data.descs);persist("descs",data.descs);}
        if(data.highlights){setHighlights(data.highlights);persist("highlights",data.highlights);}
        if(data.highlightLabels){setHighlightLabels(data.highlightLabels);persist("highlightLabels",data.highlightLabels);}
        if(data.pos){setPos(data.pos);persist("pos",data.pos);}
        if(data.customAccts){setCustomAccts(data.customAccts);persist("custom",data.customAccts);}
        const d=data.deletedIds||data.deleted;if(d){const set=new Set(d);setDeletedIds(set);persist("deleted",Array.from(set));}
        alert("Backup restored successfully!");
      }catch(err){alert("Failed to import: "+err.message);}
    };
    reader.readAsText(file);
    e.target.value=""; // reset so same file can be imported again
  };

  useEffect(()=>{
    const h=()=>{if(flagMenu)setFlagMenu(null);};
    document.addEventListener("click",h);
    return()=>document.removeEventListener("click",h);
  },[flagMenu]);

  const setFlag=(id,val)=>{if(id!=null)setAndPersist(setFlags,"flags",p=>({...p,[id]:val}));setFlagMenu(null);};

  const tA=rows.filter(r=>r.displayTier==="A").length,tB=rows.filter(r=>r.displayTier==="B").length,tC=rows.filter(r=>r.displayTier==="C").length;
  const hotCount=rows.filter(r=>r.flag==="hot").length;
  const flaggedCount=rows.filter(r=>r.flag).length;

  const Hdr=({col,label,w})=>(
    <th onClick={()=>doSort(col)} style={{width:w,minWidth:w,padding:"7px 8px",fontSize:11,fontWeight:500,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",background:"#f8f9fa",borderBottom:"2px solid #e5e7eb",color:sc===col?"#111827":"#6b7280",letterSpacing:"0.07em",textTransform:"uppercase"}}>
      {label}{sc===col?(sd==="asc"?" ↑":" ↓"):""}
    </th>
  );
  const SHdr=({label,w})=>(
    <th style={{width:w,minWidth:w,padding:"8px 8px",fontSize:10,fontWeight:700,background:"#f8f9fa",borderBottom:"2px solid #e5e7eb",color:"#6b7280",letterSpacing:"0.07em",textTransform:"uppercase"}}>{label}</th>
  );



  const HypoCard=({id,field,title,content,accent,tint})=>{
    const isE=edit&&edit[0]===id&&edit[1]===field;
    return(
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 12px",borderLeft:`4px solid ${accent}`,cursor:"text"}} onClick={e=>!isE&&startEdit(id,field,content,e)}>
        <div style={{fontSize:10,fontWeight:500,color:accent,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {title}
          <span style={{fontSize:10,color:"var(--color-text-tertiary)",fontWeight:400,textTransform:"none",letterSpacing:0}}>click to edit</span>
        </div>
        {isE?(
          <textarea autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
            onKeyDown={e=>{if(e.key==="Escape"){setEdit(null);setTmp("");}}}
            rows={4} style={{width:"100%",fontSize:12,padding:"4px 6px",boxSizing:"border-box",resize:"vertical",fontFamily:"var(--font-sans)"}} onClick={e=>e.stopPropagation()}/>
        ):<div style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{content||<em style={{color:"var(--color-text-tertiary)"}}>No data — click to add</em>}</div>}
      </div>
    );
  };

  const flagInfo=id=>{const v=flags[id]||"";return FLAG_OPTS.find(f=>f.val===v)||FLAG_OPTS[0];};

  return(
    <React.Fragment>
      {/* ===== App bar ===== */}
      <header className="app-bar">
        <div className="app-brand">
          <div className="app-logo">📊</div>
          <div>
            <div className="app-title">Connor's Account Tracker</div>
            <div className="app-sub">Pipeline intelligence · {allAccts.length} accounts</div>
          </div>
        </div>
        <div className="app-bar-meta">
          <span className="app-chip"><span className="dot" style={{background:"#ef4444"}}></span>{hotCount} hot</span>
          <span className="app-chip"><b>{rows.length}</b> shown</span>
          <span className="app-chip"><b>{allAccts.length}</b> total</span>
        </div>
      </header>

      <div className="page" style={{fontFamily:"var(--font-sans)",fontSize:13,color:"var(--color-text-primary)"}}>

        {/* ===== KPI cards ===== */}
        <div className="kpi-row">
          <div className="kpi-card" style={{"--accent":"var(--brand)"}}>
            <div className="kpi-top"><span className="kpi-label">Total accounts</span><span className="kpi-ico">🏢</span></div>
            <div className="kpi-value">{allAccts.length}</div>
            <div className="kpi-sub">{rows.length} matching current view</div>
          </div>
          <div className="kpi-card" style={{"--accent":"#16a34a"}}>
            <div className="kpi-top"><span className="kpi-label">Tier A</span><span className="kpi-ico">🟢</span></div>
            <div className="kpi-value">{tA}</div>
            <div className="kpi-sub">top priority</div>
          </div>
          <div className="kpi-card" style={{"--accent":"#2563eb"}}>
            <div className="kpi-top"><span className="kpi-label">Tier B</span><span className="kpi-ico">🔵</span></div>
            <div className="kpi-value">{tB}</div>
            <div className="kpi-sub">developing</div>
          </div>
          <div className="kpi-card" style={{"--accent":"#9ca3af"}}>
            <div className="kpi-top"><span className="kpi-label">Tier C</span><span className="kpi-ico">⚪</span></div>
            <div className="kpi-value">{tC}</div>
            <div className="kpi-sub">nurture / long-term</div>
          </div>
          <div className="kpi-card" style={{"--accent":"#ef4444"}}>
            <div className="kpi-top"><span className="kpi-label">Hot accounts</span><span className="kpi-ico">🔥</span></div>
            <div className="kpi-value">{hotCount}</div>
            <div className="kpi-sub">{flaggedCount} flagged in total</div>
          </div>
        </div>

      {/* Toolbar */}
      <div className="toolbar-card" style={{marginBottom:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
          <div style={{position:"relative",flex:1,minWidth:200}}>
            <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"var(--color-text-tertiary)",pointerEvents:"none"}}>🔍</span>
            <input type="text" placeholder="Search accounts, industry, hiring, notes, location..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",paddingLeft:28,boxSizing:"border-box",fontSize:13}}/>
          </div>
          {["All","A","B","C","—"].map(t=>(
            <button key={t} onClick={()=>setTierF(t)} style={{padding:"5px 11px",fontSize:12,fontWeight:500,borderRadius:"var(--border-radius-md)",cursor:"pointer",background:tierF===t?(t==="A"?"var(--color-background-success)":t==="B"?"var(--color-background-warning)":"var(--color-background-secondary)"):"transparent",color:tierF===t?(t==="A"?"var(--color-text-success)":t==="B"?"var(--color-text-warning)":"var(--color-text-primary)"):"var(--color-text-secondary)",border:`0.5px solid ${tierF===t?(t==="A"?"var(--color-border-success)":t==="B"?"var(--color-border-warning)":"var(--color-border-secondary)"):"var(--color-border-tertiary)"}`}}>
              {t==="—"?"No Tier":t==="All"?"All Tiers":`Tier ${t}`}
            </button>
          ))}
          {/* Highlight color buttons */}
          {[["red","#fecaca","#991b1b","#fee2e2"],["yellow","#fde68a","#92400e","#fef3c7"],["blue","#bfdbfe","#1e40af","#dbeafe"]].map(([color,border,text,bg])=>{
            const isEditing=editingLabel===color;
            const label=highlightLabels[color]||color;
            if(isEditing){
              return (
                <input key={color} autoFocus defaultValue={label}
                  onBlur={e=>{updateHighlightLabel(color,e.target.value||color);setEditingLabel(null);}}
                  onKeyDown={e=>{if(e.key==="Enter"){updateHighlightLabel(color,e.target.value||color);setEditingLabel(null);}if(e.key==="Escape"){setEditingLabel(null);}}}
                  style={{padding:"4px 8px",fontSize:11,borderRadius:"var(--border-radius-md)",border:`1px solid ${border}`,background:bg,color:text,width:120,outline:"none"}}
                />
              );
            }
            return (
              <div key={color} style={{display:"inline-flex",alignItems:"center",borderRadius:"var(--border-radius-md)",background:bg,border:`0.5px solid ${border}`,overflow:"hidden"}}>
                <button title={`Apply ${label} highlight to expanded account`}
                  onClick={()=>{if(exp){toggleHighlight(exp,color);}else{alert("Click an account row first to expand it, then apply a highlight.");}}}
                  style={{padding:"5px 9px",fontSize:12,fontWeight:500,cursor:"pointer",background:"transparent",color:text,border:"none"}}>
                  ● {label}
                </button>
                <button title={`Edit label for ${color}`} onClick={()=>setEditingLabel(color)}
                  style={{padding:"5px 6px",fontSize:10,cursor:"pointer",background:"transparent",color:text,border:"none",borderLeft:`0.5px solid ${border}`,opacity:0.7}}>
                  ✎
                </button>
              </div>
            );
          })}
          <button onClick={()=>setAddOpen(true)} style={{padding:"5px 11px",fontSize:12,fontWeight:500,borderRadius:"var(--border-radius-md)",cursor:"pointer",background:"var(--color-background-info)",color:"var(--color-text-info)",border:"0.5px solid var(--color-border-info)"}}>
            + Add Account
          </button>
          <button onClick={exportData} title="Download backup as JSON file" style={{padding:"5px 11px",fontSize:12,fontWeight:500,borderRadius:"var(--border-radius-md)",cursor:"pointer",background:"var(--color-bg-success,#f0fdf4)",color:"var(--color-text-success,#166534)",border:"0.5px solid var(--color-border-success,#bbf7d0)"}}>
            ⬇ Export
          </button>
          <label style={{padding:"5px 11px",fontSize:12,fontWeight:500,borderRadius:"var(--border-radius-md)",cursor:"pointer",background:"var(--color-bg-warning,#fffbeb)",color:"var(--color-text-warning,#92400e)",border:"0.5px solid var(--color-border-warning,#fde68a)",display:"inline-block"}} title="Restore from backup JSON file">
            ⬆ Import
            <input type="file" accept=".json,application/json" onChange={importData} style={{display:"none"}}/>
          </label>
        </div>
        <div style={{display:"flex",gap:16,fontSize:11,color:"var(--color-text-secondary)"}}>
          <span><strong style={{color:"var(--color-text-primary)",fontWeight:500}}>{rows.length}</strong> of {allAccts.length} accounts</span>
          <span style={{color:"var(--color-text-success)"}}>A: {tA}</span>
          <span style={{color:"var(--color-text-warning)"}}>B: {tB}</span>
          <span style={{color:"var(--color-text-secondary)"}}>C: {tC}</span>
        </div>
      </div>

      {/* Add Account Form */}
      {addOpen&&(
        <div style={{background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-lg)",padding:"16px",marginBottom:12}}>
          <div style={{fontWeight:500,marginBottom:12,fontSize:13}}>Add New Account</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px 1fr 80px",gap:8,marginBottom:8}}>
            {[["name","Account Name *"],["location","Location"],["tier","Tier"],["industry","Industry"],["employees","Employees"]].map(([k,ph])=>(
              <div key={k}>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:2}}>{ph}</div>
                {k==="tier"?<select value={newAcct.tier} onChange={e=>setNewAcct(p=>({...p,tier:e.target.value}))} style={{width:"100%",fontSize:12}}>
                  {["A","B","C",""].map(v=><option key={v} value={v}>{v||"—"}</option>)}
                </select>:<input value={newAcct[k]} onChange={e=>setNewAcct(p=>({...p,[k]:e.target.value}))} style={{width:"100%",fontSize:12,boxSizing:"border-box"}} placeholder={ph}/>}
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[["sfUrl","Salesforce URL"],["hiringUrl","Hiring URL"]].map(([k,ph])=>(
              <div key={k}>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:2}}>{ph}</div>
                <input value={newAcct[k]} onChange={e=>setNewAcct(p=>({...p,[k]:e.target.value}))} style={{width:"100%",fontSize:12,boxSizing:"border-box"}} placeholder={ph}/>
              </div>
            ))}
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:2}}>Description</div>
            <textarea value={newAcct.description} onChange={e=>setNewAcct(p=>({...p,description:e.target.value}))} rows={2} style={{width:"100%",fontSize:12,boxSizing:"border-box",resize:"vertical"}} placeholder="Brief description..."/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={addAcct} disabled={!newAcct.name.trim()} style={{padding:"5px 14px",fontSize:12,fontWeight:500,cursor:"pointer",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-md)",opacity:newAcct.name.trim()?1:0.5}}>Save Account</button>
            <button onClick={()=>{setAddOpen(false);setNewAcct(EMPTY_ACCT);}} style={{padding:"5px 14px",fontSize:12,cursor:"pointer",background:"transparent",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)"}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm&&(
        <div style={{background:"var(--color-background-danger)",border:"0.5px solid var(--color-border-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:12,color:"var(--color-text-danger)",flex:1}}>Delete <strong>{deleteConfirm.name}</strong>? This hides it from your tracker (can't be undone).</span>
          <button onClick={()=>deleteAcct(deleteConfirm.id)} style={{padding:"4px 12px",fontSize:12,cursor:"pointer",background:"var(--color-background-danger)",color:"var(--color-text-danger)",border:"0.5px solid var(--color-border-danger)",borderRadius:"var(--border-radius-md)",fontWeight:600}}>Delete</button>
          <button onClick={()=>setDeleteConfirm(null)} style={{padding:"4px 12px",fontSize:12,cursor:"pointer",background:"transparent",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)"}}>Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">📇 Accounts</div>
          <div style={{fontSize:12,color:"var(--shell-muted)",fontWeight:500}}>{rows.length} of {allAccts.length} shown</div>
        </div>
        <div className="panel-scroll">
        <table style={{width:"100%",minWidth:1100,borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <SHdr label="" w={26}/>
              <Hdr col="flag" label="⚑" w={52}/>
              <Hdr col="name" label="Account" w={168}/>
              <Hdr col="tl" label="📅 Timeline" w={170}/>
              <Hdr col="location" label="Location" w={82}/>
              <SHdr label="Info Sheet" w={70}/>
              <SHdr label="🌐" w={36}/>
              <Hdr col="tier" label="Tier" w={44}/>
              <Hdr col="industry" label="Industry" w={95}/>
              <Hdr col="employees" label="Emp" w={50}/>
              <SHdr label="Hiring" w={132}/>
              <Hdr col="po" label="Past Opp" w={75}/>
              <SHdr label="Notes" w={191}/>
              <Hdr col="createdAt" label="Added" w={60}/>
            </tr>
          </thead>
          <tbody>
            {rows.length===0?(
              <tr><td colSpan={14} style={{textAlign:"center",padding:32,color:"var(--color-text-tertiary)",fontSize:13}}>
                No accounts match. <button onClick={()=>{setSearch("");setTierF("All");}} style={{background:"none",border:"none",color:"var(--color-text-info)",cursor:"pointer",fontSize:13}}>Clear filters</button>
              </td></tr>
            ):rows.map((acc,rowIdx)=>{
              const isExp=exp===acc.id;
              const fi=flagInfo(acc.id);
              const ts=TIER_STYLE[acc.tier];
              const hl=highlights[acc.id];
              const hlBg=hl==="red"?"rgba(239,68,68,0.12)":hl==="yellow"?"rgba(234,179,8,0.15)":hl==="blue"?"rgba(59,130,246,0.12)":"";
              const rowBg=hlBg||(fi.val?fi.bg:rowIdx%2===1?"rgba(0,0,0,0.025)":"");
              return [
                <tr key={acc.id} style={{borderBottom:isExp?"none":"0.5px solid var(--color-border-tertiary)",background:rowBg||"transparent",cursor:"pointer",transition:"background 0.1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=fi.val?fi.bg:"rgba(59,130,246,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.background=rowBg||"transparent"}>
                  {/* Expand */}
                  <td style={{padding:"0 0 0 8px",width:26}} onClick={()=>setExp(isExp?null:acc.id)}>
                    <span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>{isExp?"▾":"▸"}</span>
                  </td>
                  {/* Flag — inline word selector */}
                  <td style={{padding:"0 3px",width:90,textAlign:"center"}}>
                    {flagMenu===acc.id?(
                      <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"stretch",padding:"2px"}} onClick={e=>e.stopPropagation()}>
                        {FLAG_OPTS.filter(f=>f.val).map(f=>(
                          <button key={f.val} onClick={e=>{e.stopPropagation();setFlag(acc.id,f.val);}} title={`Set to ${f.label}`}
                            style={{fontSize:10,padding:"2px 4px",border:`0.5px solid ${fi.val===f.val?f.c:"var(--color-border-tertiary)"}`,borderRadius:3,background:fi.val===f.val?f.bg:"transparent",color:f.c,cursor:"pointer",lineHeight:1.2,fontWeight:fi.val===f.val?600:400}}>
                            {f.word}
                          </button>
                        ))}
                        <button onClick={e=>{e.stopPropagation();setFlag(acc.id,"");}} title="Clear" style={{fontSize:9,padding:"1px 3px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:3,background:"transparent",color:"var(--color-text-tertiary)",cursor:"pointer",lineHeight:1}}>Clear</button>
                      </div>
                    ):(
                      <button onClick={e=>{e.stopPropagation();setFlagMenu(flagMenu===acc.id?null:acc.id);}}
                        style={{background:fi.val?fi.bg:"transparent",border:fi.val?`0.5px solid ${fi.c}`:"0.5px dashed var(--color-border-tertiary)",cursor:"pointer",fontSize:11,padding:"2px 6px",lineHeight:1.2,color:fi.val?fi.c:"var(--color-text-tertiary)",borderRadius:3,fontWeight:fi.val?600:400,minWidth:64}}
                        title={fi.val?`Priority: ${fi.label}`:"Set priority"}>
                        {fi.val?fi.word:"+ Set"}
                      </button>
                    )}
                  </td>
                  {/* Account name — editable */}
                  <td style={{padding:"6px 8px"}} onClick={()=>setExp(isExp?null:acc.id)}>
                    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                      {edit&&edit[0]===acc.id&&edit[1]==="name"?(
                        <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                          onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                          onClick={e=>e.stopPropagation()} style={{fontSize:13,fontWeight:500,padding:"1px 4px",width:150,boxSizing:"border-box"}}/>
                      ):acc.sfUrlEff?(
                        <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                          <span onClick={e=>e.stopPropagation()}
                            onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"name",acc.displayName,e);}}
                            style={{fontWeight:600,fontSize:13,color:"var(--color-text-primary)",lineHeight:1.3,cursor:"text"}}
                            title="Double-click to edit name">
                            {acc.displayName}
                          </span>
                          <a href={acc.sfUrlEff} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                            style={{fontSize:10,color:"#1d4ed8",textDecoration:"none",padding:"0 3px",borderRadius:3,background:"#eff6ff"}}
                            title="Open in Salesforce">↗</a>
                        </span>
                      ):<span style={{fontWeight:600,fontSize:13,lineHeight:1.3,cursor:"text"}}
                          onClick={e=>e.stopPropagation()}
                          onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"name",acc.displayName,e);}}
                          title="Double-click to edit name">
                          {acc.displayName}
                        </span>}
                      {acc.sfOppUrl&&acc.pastOpp&&(
                        <a href={acc.sfOppUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                          style={{fontSize:9,color:"var(--color-text-secondary)",textDecoration:"underline",background:"var(--color-background-secondary)",padding:"1px 4px",borderRadius:3,flexShrink:0}}>opp ↗</a>
                      )}
                      {acc.apUrl&&(
                        <a href={acc.apUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                          style={{fontSize:9,color:"var(--color-text-secondary)",textDecoration:"underline",background:"var(--color-background-secondary)",padding:"1px 4px",borderRadius:3,flexShrink:0}}>plan ↗</a>
                      )}
                    </div>
                    {/* Status note — editable */}
                    {edit&&edit[0]===acc.id&&edit[1]==="sn"?(
                      <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                        onClick={e=>e.stopPropagation()} style={{fontSize:10,padding:"1px 4px",width:"100%",marginTop:2,boxSizing:"border-box"}}/>
                    ):acc.displaySn?(
                      <div onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"sn",acc.displaySn,e);}}
                        style={{fontSize:10,lineHeight:1.3,marginTop:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",maxWidth:160,color:fi.val?fi.c:"var(--color-text-tertiary)",cursor:"text"}}
                        title="Double-click to edit">
                        {acc.displaySn}
                      </div>
                    ):(
                      <div onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"sn","",e);}}
                        style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:2,cursor:"text",opacity:0.5}}
                        title="Double-click to add status note">
                        + status note
                      </div>
                    )}
                  </td>
                  {/* Timeline — date + contact + reason */}
                  <td style={{padding:"5px 8px",verticalAlign:"top"}} onClick={e=>e.stopPropagation()}>
                    {tlEdit===acc.id?(
                      <div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",gap:4}}>
                        <input autoFocus placeholder="Date (e.g. Q3 2026)" value={tlTmp.date} onChange={e=>setTlTmp(p=>({...p,date:e.target.value}))}
                          style={{fontSize:11,padding:"3px 5px",width:"100%",boxSizing:"border-box"}}/>
                        <input placeholder="Contact (e.g. Prat · CIO)" value={tlTmp.contact} onChange={e=>setTlTmp(p=>({...p,contact:e.target.value}))}
                          style={{fontSize:11,padding:"3px 5px",width:"100%",boxSizing:"border-box"}}/>
                        <input placeholder="Reason / context" value={tlTmp.reason} onChange={e=>setTlTmp(p=>({...p,reason:e.target.value}))}
                          style={{fontSize:11,padding:"3px 5px",width:"100%",boxSizing:"border-box"}}
                          onKeyDown={e=>{if(e.key==="Escape"){setTlEdit(null);}}}/>
                        <div style={{display:"flex",gap:5,marginTop:2}}>
                          <button onClick={e=>{e.stopPropagation();const v={...tlTmp};setTlv(prev=>{const n={...prev,[acc.id]:v};persist("tlv2",n);return n;});setTlEdit(null);}}
                            style={{fontSize:10,padding:"2px 8px",cursor:"pointer",background:"var(--color-background-success)",color:"var(--color-text-success)",border:"0.5px solid var(--color-border-success)",borderRadius:"var(--border-radius-sm)"}}>Save</button>
                          <button onClick={e=>{e.stopPropagation();setTlEdit(null);}}
                            style={{fontSize:10,padding:"2px 8px",cursor:"pointer",background:"transparent",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-sm)"}}>Cancel</button>
                        </div>
                      </div>
                    ):(
                      <div onClick={e=>{e.stopPropagation();setTlTmp({date:acc.tlData.date||"",contact:acc.tlData.contact||"",reason:acc.tlData.reason||""});setTlEdit(acc.id);}}
                        style={{cursor:"text",minHeight:18}}>
                        {acc.tlData.date?(
                          <div>
                            <div style={{fontSize:12,color:"#1d4ed8",fontWeight:600,lineHeight:1.3}}>{acc.tlData.date}</div>
                            {acc.tlData.contact&&<div style={{fontSize:10,color:"var(--color-text-secondary)",lineHeight:1.3,marginTop:2}}>{acc.tlData.contact}</div>}
                            {acc.tlData.reason&&<div style={{fontSize:10,color:"var(--color-text-tertiary)",lineHeight:1.3,marginTop:1,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{acc.tlData.reason}</div>}
                          </div>
                        ):<span style={{fontSize:11,color:"var(--color-text-tertiary)",fontStyle:"italic"}}>+ add timeline</span>}
                      </div>
                    )}
                  </td>
                  <td style={{padding:"6px 8px"}} onClick={()=>setExp(isExp?null:acc.id)}>
                    {edit&&edit[0]===acc.id&&edit[1]==="loc"?(
                      <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                        onClick={e=>e.stopPropagation()} style={{fontSize:11,width:70,padding:"1px 3px",boxSizing:"border-box"}}/>
                    ):<span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"loc",acc.displayLoc||"",e);}}
                        style={{fontSize:11,color:acc.displayLoc?"var(--color-text-secondary)":"var(--color-text-tertiary)",cursor:"text"}}
                        title="Double-click to edit">{acc.displayLoc||"—"}</span>}
                  </td>
                  {/* Info Doc */}
                  <td style={{padding:"4px 6px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                    {acc.infoUrl?(
                      <a href={acc.infoUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:14,textDecoration:"none"}} title="Open Info Doc">📄</a>
                    ):(
                      <div onClick={e=>{e.stopPropagation();startEdit(acc.id,"info","",e);}} style={{fontSize:12,color:"var(--color-text-tertiary)",cursor:"text",textAlign:"center"}} title="Add Info Doc link">
                        {edit&&edit[0]===acc.id&&edit[1]==="info"?(
                          <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}} style={{width:42,fontSize:10,padding:"2px 3px",boxSizing:"border-box"}} placeholder="URL"/>
                        ):<span>+</span>}
                      </div>
                    )}
                  </td>
                  {/* Website */}
                  <td style={{padding:"4px 6px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                    {acc.webUrl?(
                      <a href={acc.webUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:14,textDecoration:"none"}} title="Open Website">🌐</a>
                    ):(
                      <div onClick={e=>{e.stopPropagation();startEdit(acc.id,"web","",e);}} style={{fontSize:12,color:"var(--color-text-tertiary)",cursor:"text",textAlign:"center"}} title="Add website URL">
                        {edit&&edit[0]===acc.id&&edit[1]==="web"?(
                          <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}} style={{width:42,fontSize:10,padding:"2px 3px",boxSizing:"border-box"}} placeholder="URL"/>
                        ):<span>+</span>}
                      </div>
                    )}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
                    {edit&&edit[0]===acc.id&&edit[1]==="tier2"?(
                      <select autoFocus value={tmp} onChange={e=>{setTmp(e.target.value);commit(e.target.value);}}
                        onBlur={commit} onClick={e=>e.stopPropagation()}
                        style={{fontSize:11,padding:"1px 2px",width:46}}>
                        {["A","B","C",""].map(v=><option key={v} value={v}>{v||"—"}</option>)}
                      </select>
                    ):<span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"tier2",acc.displayTier||"",e);}}
                        title="Double-click to change tier" style={{cursor:"pointer"}}>
                        {acc.displayTier
                          ?<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:20,borderRadius:5,fontSize:11,fontWeight:800,background:TIER_STYLE[acc.displayTier]?.bg,color:TIER_STYLE[acc.displayTier]?.c,border:`1.5px solid ${TIER_STYLE[acc.displayTier]?.border||"transparent"}`}}>{acc.displayTier}</span>
                          :<span style={{color:"var(--color-text-tertiary)",fontSize:11}}>—</span>}
                      </span>}
                  </td>
                  <td style={{padding:"6px 8px"}} onClick={()=>setExp(isExp?null:acc.id)}>
                    {edit&&edit[0]===acc.id&&edit[1]==="ind"?(
                      <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                        onClick={e=>e.stopPropagation()} style={{fontSize:11,width:82,padding:"1px 3px",boxSizing:"border-box"}}/>
                    ):<span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"ind",acc.displayInd||"",e);}}
                        style={{fontSize:11,color:acc.displayInd?"var(--color-text-secondary)":"var(--color-text-tertiary)",cursor:"text",lineHeight:1.3,display:"block"}}
                        title="Double-click to edit">{acc.displayInd||"—"}</span>}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"right"}} onClick={()=>setExp(isExp?null:acc.id)}>
                    {edit&&edit[0]===acc.id&&edit[1]==="emp"?(
                      <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                        onClick={e=>e.stopPropagation()} style={{fontSize:11,width:42,padding:"1px 3px",textAlign:"right",boxSizing:"border-box"}}/>
                    ):<span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"emp",String(acc.displayEmp||""),e);}}
                        style={{fontSize:11,color:acc.displayEmp?"var(--color-text-secondary)":"var(--color-text-tertiary)",cursor:"text",fontVariantNumeric:"tabular-nums"}}
                        title="Double-click to edit">{acc.displayEmp>0?Number(acc.displayEmp).toLocaleString():"—"}</span>}
                  </td>
                  {/* Hiring Personas */}
                  <td style={{padding:"6px 8px"}} onClick={()=>setExp(isExp?null:acc.id)}>
                    {edit&&edit[0]===acc.id&&edit[1]==="hp"?(
                      <div onClick={e=>e.stopPropagation()} style={{display:"flex",flexDirection:"column",gap:3,minWidth:160}}>
                        <input autoFocus placeholder="Hiring personas text" value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                          onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                          style={{fontSize:10,width:"100%",padding:"2px 4px",boxSizing:"border-box"}}/>
                        <input placeholder="Hiring URL (optional)" defaultValue={acc.hiringUrl||""}
                          onBlur={e=>{setAndPersist(setHpUrls,"hpUrls",p=>({...p,[acc.id]:e.target.value}));}}
                          onKeyDown={e=>{if(e.key==="Enter"){setAndPersist(setHpUrls,"hpUrls",p=>({...p,[acc.id]:e.target.value}));commit();}if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                          onClick={e=>e.stopPropagation()} style={{fontSize:9,width:"100%",padding:"2px 4px",boxSizing:"border-box",color:"#1d4ed8"}}/>
                      </div>
                    ):acc.displayHp?(
                      <div style={{display:"flex",alignItems:"flex-start",gap:4}}>
                        <div onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"hp",acc.displayHp,e);}}
                          title="Double-click to edit"
                          style={{fontSize:10,color:"var(--color-text-secondary)",lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",cursor:"text",flex:1}}>
                          {acc.displayHp}
                        </div>
                        {acc.hiringUrl&&<a href={acc.hiringUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                          style={{fontSize:10,color:"#1d4ed8",textDecoration:"none",padding:"0 3px",borderRadius:3,background:"#eff6ff",flexShrink:0}}
                          title="Open hiring page">↗</a>}
                      </div>
                    ):<span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"hp","",e);}} style={{color:"var(--color-text-tertiary)",fontSize:11,cursor:"text"}} title="Double-click to add">—</span>}
                  </td>
                  {/* Past Opp */}
                  <td style={{padding:"6px 8px",fontSize:10,lineHeight:1.3}} onClick={()=>setExp(isExp?null:acc.id)}>
                    {edit&&edit[0]===acc.id&&edit[1]==="po"?(
                      <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                        onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                        onClick={e=>e.stopPropagation()} style={{fontSize:10,width:65,padding:"1px 3px",boxSizing:"border-box"}}/>
                    ):acc.displayPo?(
                      <span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"po",acc.displayPo,e);}} title="Double-click to edit">
                        {acc.sfOppUrl?<a href={acc.sfOppUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:"var(--color-text-info)",textDecoration:"underline"}}>{acc.displayPo}</a>:
                        <span style={{color:"var(--color-text-secondary)"}}>{acc.displayPo}</span>}
                      </span>
                    ):<span onDoubleClick={e=>{e.stopPropagation();startEdit(acc.id,"po","",e);}} style={{color:"var(--color-text-tertiary)",cursor:"text"}} title="Double-click to add">—</span>}
                  </td>
                  {/* Notes */}
                  <td style={{padding:"5px 8px"}} onClick={e=>e.stopPropagation()}>
                    <EditCell id={acc.id} field="nt" val={acc.nt} ph="+ add notes" multiline edit={edit} tmp={tmp} setTmp={setTmp} commit={commit} setEdit={setEdit} startEdit={startEdit} />
                  </td>
                  {/* Date Added */}
                  <td style={{padding:"6px 4px",fontSize:10,color:"var(--color-text-tertiary)",textAlign:"center"}} onClick={()=>setExp(isExp?null:acc.id)}>
                    {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—"}
                  </td>
                </tr>,

                // Expanded
                isExp&&(
                  <tr key={`${acc.id}-x`} style={{background:"var(--color-background-secondary)",borderBottom:"1px solid var(--color-border-secondary)"}}>
                    <td colSpan={2}/>
                    <td colSpan={12} style={{padding:"10px 12px 20px 4px"}}>

                      {/* Top row */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                        <div>
                          <div style={{fontSize:10,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Overview</div>
                          <div style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.6}}>
                            <EditCell id={acc.id} field="desc" val={acc.description} ph="Add description..." multiline edit={edit} tmp={tmp} setTmp={setTmp} commit={commit} setEdit={setEdit} startEdit={startEdit} />
                          </div>
                          {acc.techPersonas&&acc.techPersonas!=="0"&&<div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:4}}>Tech personas: {acc.techPersonas}</div>}
                          {acc.hiringPersonas&&<div style={{fontSize:11,marginTop:4}}>{acc.hiringUrl?<a href={acc.hiringUrl} target="_blank" rel="noopener noreferrer" style={{color:"var(--color-text-info)",textDecoration:"underline"}}>🔍 Hiring: {acc.hiringPersonas}</a>:<span style={{color:"var(--color-text-secondary)"}}>🔍 Hiring: {acc.hiringPersonas}</span>}</div>}
                        </div>
                        {/* Links & Actions */}
                        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"10px 12px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <div style={{fontSize:10,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Quick Links & Actions</div>
                            <button onClick={e=>{e.stopPropagation();if(window.confirm(`Delete ${acc.displayName||acc.name}? This hides it from your tracker (can't be undone).`)){deleteAcct(acc.id);}}} style={{fontSize:10,padding:"3px 8px",cursor:"pointer",background:"var(--color-background-danger)",color:"var(--color-text-danger)",border:"0.5px solid var(--color-border-danger)",borderRadius:"var(--border-radius-sm)"}}>
                              🗑 Delete
                            </button>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                            {acc.sfUrlEff&&<a href={acc.sfUrlEff} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--color-text-info)",textDecoration:"underline",padding:"5px 8px",background:"var(--color-background-info)",borderRadius:"var(--border-radius-sm)",textAlign:"center"}}>☁ Open in Salesforce ↗</a>}
                            {acc.sfOppUrl&&<a href={acc.sfOppUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--color-text-secondary)",textDecoration:"underline",padding:"5px 8px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-sm)",textAlign:"center"}}>View Opportunity ↗</a>}
                            {acc.hiringUrl&&<a href={acc.hiringUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--color-text-success)",textDecoration:"underline",padding:"5px 8px",background:"var(--color-background-success)",borderRadius:"var(--border-radius-sm)",textAlign:"center"}}>View Job Postings ↗</a>}
                            {acc.webUrl&&<a href={acc.webUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--color-text-secondary)",textDecoration:"underline",padding:"5px 8px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-sm)",textAlign:"center"}}>🌐 Website ↗</a>}
                            {acc.infoUrl&&<a href={acc.infoUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--color-text-secondary)",textDecoration:"underline",padding:"5px 8px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-sm)",textAlign:"center"}}>📄 Info Doc ↗</a>}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                            <div>
                              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:3,fontWeight:500}}>📄 Info Doc URL</div>
                              <EditCell id={acc.id} field="info" val={acc.infoUrl} ph="Paste Google Doc URL..." accent="var(--color-text-secondary)" edit={edit} tmp={tmp} setTmp={setTmp} commit={commit} setEdit={setEdit} startEdit={startEdit} />
                            </div>
                            <div>
                              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:3,fontWeight:500}}>☁️ Salesforce URL</div>
                              <EditCell id={acc.id} field="sf" val={acc.sfUrlEff} ph="Paste Salesforce URL..." accent="var(--color-text-secondary)" edit={edit} tmp={tmp} setTmp={setTmp} commit={commit} setEdit={setEdit} startEdit={startEdit} />
                            </div>
                            <div>
                              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:3,fontWeight:500}}>🌐 Website URL</div>
                              <EditCell id={acc.id} field="web" val={acc.webUrl} ph="Paste website URL..." accent="var(--color-text-secondary)" edit={edit} tmp={tmp} setTmp={setTmp} commit={commit} setEdit={setEdit} startEdit={startEdit} />
                            </div>
                          </div>
                          <div style={{marginTop:8}}>
                            <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:3,fontWeight:500}}>Account Plan Link{acc.acctPlanName?` (${acc.acctPlanName})`:""}</div>
                            <EditCell id={acc.id} field="ap" val={acc.apUrl} ph="Paste Google Doc / Slides URL..." accent="var(--color-text-secondary)" edit={edit} tmp={tmp} setTmp={setTmp} commit={commit} setEdit={setEdit} startEdit={startEdit} />
                          </div>
                        </div>
                      </div>

                      {/* Status note */}
                      {acc.statusNote&&(
                        <div style={{background:fi.val?fi.bg:"var(--color-background-secondary)",borderLeft:`3px solid ${fi.val?fi.c:"var(--color-border-secondary)"}`,border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"8px 12px",marginBottom:12}}>
                          <div style={{fontSize:10,fontWeight:500,color:fi.val?fi.c:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>Activity / Status</div>
                          <div style={{fontSize:12,color:fi.val?fi.c:"var(--color-text-secondary)",lineHeight:1.6}}>{acc.statusNote}</div>
                        </div>
                      )}
                      {/* Timeline detail card */}
                      {(acc.tlData.date||acc.tlData.contact||acc.tlData.reason)&&(
                        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-info)",borderLeft:"3px solid var(--color-border-info)",borderRadius:"var(--border-radius-md)",padding:"8px 12px",marginBottom:12}}>
                          <div style={{fontSize:10,fontWeight:500,color:"var(--color-text-info)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>📅 Timeline</div>
                          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                            {acc.tlData.date&&<div><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>Date</span><div style={{fontSize:13,fontWeight:500,color:"var(--color-text-info)"}}>{acc.tlData.date}</div></div>}
                            {acc.tlData.contact&&<div><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>Contact</span><div style={{fontSize:12,color:"var(--color-text-primary)"}}>{acc.tlData.contact}</div></div>}
                            {acc.tlData.reason&&<div style={{flex:1}}><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>Context</span><div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{acc.tlData.reason}</div></div>}
                          </div>
                        </div>
                      )}

                      {/* Hypothesis 2x2 */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                        <HypoCard id={acc.id} field="howTheyMakeMoney" title="💰 How They Make Money" content={acc.hyp.howTheyMakeMoney} accent="#16a34a" tint="rgba(34,197,94,0.07)"/>
                        <HypoCard id={acc.id} field="whyAnything" title="❓ Why Do Anything" content={acc.hyp.whyAnything} accent="#2563eb" tint="rgba(59,130,246,0.07)"/>
                        <HypoCard id={acc.id} field="whyNow" title="🔥 Why Now" content={acc.hyp.whyNow} accent="#d97706" tint="rgba(234,179,8,0.08)"/>
                        <HypoCard id={acc.id} field="whyDatadog" title="🐶 Why Datadog" content={acc.hyp.whyDatadog} accent="#7c3aed" tint="rgba(124,58,237,0.07)"/>
                      </div>

                      {/* Notes */}
                      <div>
                        <div style={{fontSize:10,fontWeight:500,color:"var(--color-text-tertiary)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>Notes (click to edit)</div>
                        {edit&&edit[0]===acc.id&&edit[1]==="nt"?(
                          <textarea autoFocus value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={commit}
                            onKeyDown={e=>{if(e.key==="Escape"){setEdit(null);setTmp("");}}}
                            ref={el=>{if(el){el.style.height="auto";el.style.height=Math.max(80,el.scrollHeight+4)+"px";}}}
                            onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.max(80,e.target.scrollHeight+4)+"px";}}
                            style={{width:"100%",fontSize:12,padding:"6px 8px",boxSizing:"border-box",resize:"vertical",fontFamily:"var(--font-sans)",minHeight:80,overflow:"hidden"}}/>
                        ):(
                          <div onClick={e=>{e.stopPropagation();startEdit(acc.id,"nt",acc.nt,e);}}
                            style={{fontSize:12,color:acc.nt?"var(--color-text-primary)":"var(--color-text-tertiary)",cursor:"text",lineHeight:1.6,minHeight:24,fontStyle:acc.nt?"normal":"italic",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"6px 8px",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                            {acc.nt||"+ click to add notes"}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              ];
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div style={{marginTop:8,fontSize:11,color:"var(--color-text-tertiary)",lineHeight:1.8}}>
        <strong style={{fontWeight:500}}>Underlined blue names</strong> = click to open Salesforce &nbsp;·&nbsp;
        <strong style={{fontWeight:500}}>Double-click name or status note</strong> = edit inline &nbsp;·&nbsp;
        <strong style={{fontWeight:500}}>Underlined hiring personas</strong> = click to view job postings &nbsp;·&nbsp;
        <strong style={{fontWeight:500}}>📄 / 🌐</strong> = click to open, + to add URL &nbsp;·&nbsp;
        <strong style={{fontWeight:500}}>⚐ flag</strong> = mark accounts 🚫 blocked, ⬇ low priority, or 🔥 hot &nbsp;·&nbsp;
        Bookmark this conversation URL — all edits persist automatically
      </div>

      </div>
    </React.Fragment>
  );
}
