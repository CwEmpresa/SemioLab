"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Trophy, UserRound } from "lucide-react";

type RankUser={displayName:string;xp:number};
type LearningData={profile?:RankUser&{email?:string};ranking?:RankUser[]};
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"U";

function useRanking(){const[data,setData]=useState<LearningData|null>(null),[loading,setLoading]=useState(true);useEffect(()=>{fetch("/api/learning").then(r=>r.ok?r.json():null).then(value=>setData(value)).catch(()=>setData(null)).finally(()=>setLoading(false))},[]);return{data,loading}}

export function HomeRankCard({open}:{open:()=>void}){const{data,loading}=useRanking(),list=data?.ranking||[],me=data?.profile,position=me?list.findIndex(user=>user.displayName===me.displayName)+1:0;return <section className="rank-card live-rank"><header className="section-title"><span><small>RANKING REAL</small><h3>{loading?"Carregando classificação...":position?`Sua posição: ${position}º`:"Ranking ainda sem participantes"}</h3></span><button onClick={open}>Ver ranking</button></header>{list.length?<div>{list.slice(0,3).map((user,index)=><span key={`${user.displayName}-${index}`} className={user.displayName===me?.displayName?"me":""}><b>{index+1}</b><i>{initials(user.displayName)}</i><small>{user.xp.toLocaleString()} XP</small></span>)}</div>:!loading&&<div className="mini-empty"><UserRound/><p>O ranking será formado somente por usuários que realmente acessarem e pontuarem no app.</p></div>}</section>}

type RankRow = { rank: number; user_id: string; display_name: string; xp: number; weeklyChange?: number | null; distanceToPrevious?: number | null };
type RankingV2 = { podium: RankRow[]; list: RankRow[]; me: RankRow | null; outsideTop10: (RankRow & { distanceToPrevious: number | null }) | null };
type PublicProfile = { displayName: string; rank: number; xp: number; level: number; levelProgress: number; streak: number; avatarUrl: string | null; coverUrl: string | null };

function useRankingV2() {
  const [data, setData] = useState<RankingV2 | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/ranking").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

function ChangeBadge({ change }: { change?: number | null }) {
  if (change === undefined || change === null) return <small className="rank-change none">—</small>;
  if (change === 0) return <small className="rank-change flat">＝</small>;
  return <small className={`rank-change ${change > 0 ? "up" : "down"}`}>{change > 0 ? "▲" : "▼"} {Math.abs(change)}</small>;
}

function ProfileOverlay({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    fetch(`/api/ranking/profile?userId=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setDenied(true));
  }, [userId]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="clinical-modal public-profile-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        {denied ? (
          <p>Este perfil não está disponível.</p>
        ) : !profile ? (
          <p>Carregando perfil…</p>
        ) : (
          <>
            <div className="public-profile-cover" style={profile.coverUrl ? { backgroundImage: `url(${profile.coverUrl})` } : undefined} />
            <div className="public-profile-avatar">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.displayName} /> : <i>{initials(profile.displayName)}</i>}
            </div>
            <h2>{profile.displayName}</h2>
            <strong className="public-profile-xp">{profile.xp.toLocaleString("pt-BR")} XP</strong>
            <div className="public-profile-stats">
              <span><b>Nível {profile.level}</b><small>{profile.levelProgress}% para o próximo</small></span>
              <span><b>#{profile.rank}</b><small>posição global</small></span>
              <span><b>{profile.streak}</b><small>dias em sequência</small></span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function RankingExperience({ go }: { go: (screen: "profile" | "home") => void }) {
  const { data, loading } = useRankingV2();
  const [tab, setTab] = useState<"geral" | "amigos">("geral");
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  return (
    <div className="page ranking-v2-page">
      <header className="top">
        <div><small>{"RANKING SEMIOLAB"}</small><h2>Evolua, conquiste XP e suba de posição.</h2></div>
        <div><button className="avatar" onClick={() => go("profile")}>{data?.me ? initials(data.me.display_name) : "—"}</button></div>
      </header>

      <div className="ranking-tabs">
        <button className={tab === "geral" ? "active" : ""} onClick={() => setTab("geral")}>Ranking geral</button>
        <button className="locked" disabled title="Em breve">🔒 Amigos <small>Em breve</small></button>
      </div>

      {loading ? (
        <div className="ranking-loading"><i /><p>Carregando classificação real...</p></div>
      ) : !data || (data.podium.length === 0 && !data.me) ? (
        <div className="ranking-empty"><Trophy /><h2>O ranking começará com o primeiro usuário.</h2><p>Assim que alguém pontuar, a classificação será criada com dados reais.</p><button onClick={() => go("home")}>Voltar ao início <ChevronRight /></button></div>
      ) : (
        <>
          <div className="podium-v2">
            {[data.podium.find((p) => p.rank === 2), data.podium.find((p) => p.rank === 1), data.podium.find((p) => p.rank === 3)].map((user, slot) =>
              user ? (
                <button key={user.user_id} className={`podium-slot slot-${slot === 1 ? "gold" : slot === 0 ? "silver" : "bronze"}`} onClick={() => setViewingUserId(user.user_id)}>
                  <i>{initials(user.display_name)}</i>
                  <b>{user.display_name.split(" ")[0]}</b>
                  <strong>{user.xp.toLocaleString("pt-BR")} XP</strong>
                  <small>{user.rank}º</small>
                </button>
              ) : <span key={slot} />,
            )}
          </div>

          <div className="rank-list-v2">
            {data.list.map((user) => (
              <button key={user.user_id} className={`rank-row ${data.me?.user_id === user.user_id ? "me" : ""}`} onClick={() => setViewingUserId(user.user_id)}>
                <b>{user.rank}º</b>
                <i>{initials(user.display_name)}</i>
                <span><em>{user.display_name}</em><small>Nível {Math.floor(user.xp / 500) + 1}</small></span>
                <strong>{user.xp.toLocaleString("pt-BR")} XP</strong>
                <ChangeBadge change={user.weeklyChange} />
              </button>
            ))}
          </div>

          {data.outsideTop10 && (
            <div className="rank-row me outside-top10">
              <b>{data.outsideTop10.rank}º</b>
              <i>{initials(data.outsideTop10.display_name)}</i>
              <span><em>Você</em><small>Nível {Math.floor(data.outsideTop10.xp / 500) + 1}</small></span>
              <strong>{data.outsideTop10.xp.toLocaleString("pt-BR")} XP</strong>
              <ChangeBadge change={data.outsideTop10.weeklyChange} />
              {data.outsideTop10.distanceToPrevious !== null && <small className="rank-distance">Faltam {data.outsideTop10.distanceToPrevious} XP para subir</small>}
            </div>
          )}
        </>
      )}

      {viewingUserId && <ProfileOverlay userId={viewingUserId} onClose={() => setViewingUserId(null)} />}
    </div>
  );
}
