import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function AdminSecurityLog() {
  const { user } = useAuth();
  const staff = Boolean(user && ["admin", "super_admin", "support"].includes(user.role));
  const events = trpc.admin.auditEvents.useQuery(undefined, { enabled: staff });
  if (!staff) return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] px-6 text-center"><div><ShieldCheck className="mx-auto h-7 w-7 text-slate-400" /><h1 className="mt-4 text-2xl font-semibold text-slate-950">Admin access required</h1><Link href="/admin"><Button variant="outline" className="mt-5"><ArrowLeft className="mr-2 h-4 w-4" />Back to admin</Button></Link></div></main>;
  return <main className="min-h-screen bg-[#f7f7f3] px-5 py-8 md:px-10"><div className="mx-auto max-w-5xl"><Link href="/admin" className="text-xs font-medium text-slate-400 hover:text-slate-700">← CreaDock Admin</Link><header className="mt-8"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Platform security</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.06em] text-slate-950">Audit activity</h1><p className="mt-2 text-sm text-slate-500">Latest operational and account-security events across the platform.</p></header><section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400"><span>Activity</span><span>Time</span></div>{events.data?.length ? <div className="divide-y divide-slate-100">{events.data.map((event) => <div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4" key={event.id}><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{event.action}</p><p className="mt-1 truncate text-xs text-slate-400">{event.entityType}{event.entityId ? ` · ${event.entityId}` : ""}{event.ipAddress ? ` · ${event.ipAddress}` : ""}</p></div><time className="text-right text-xs text-slate-400">{new Date(event.createdAt).toLocaleString()}</time></div>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-400">No audit records are available.</p>}</section></div></main>;
}
