import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Archive, FileArchive, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const bytes = (value: number) => value ? `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB` : "Size not recorded";

export default function AdminFiles() {
  const { user } = useAuth();
  const staff = Boolean(user && ["admin", "super_admin"].includes(user.role));
  const files = trpc.admin.files.useQuery(undefined, { enabled: staff });
  const updateStatus = trpc.admin.updateFileStatus.useMutation({
    onSuccess: () => { toast.success("File publication status updated"); files.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const refreshUsage = trpc.admin.refreshStorageUsage.useMutation({ onSuccess: (result) => { toast.success(`Measured ${result.measuredFiles} stored file${result.measuredFiles === 1 ? "" : "s"}${result.failedFiles ? `; ${result.failedFiles} could not be read` : ""}`); files.refetch(); }, onError: (error) => toast.error(error.message) });

  if (!staff) return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] px-6 text-center"><div><FileArchive className="mx-auto h-7 w-7 text-slate-400" /><h1 className="mt-4 text-2xl font-semibold text-slate-950">Admin access required</h1><Link href="/admin"><Button variant="outline" className="mt-5"><ArrowLeft className="mr-2 h-4 w-4" />Back to admin</Button></Link></div></main>;

  return <main className="min-h-screen bg-[#f7f7f3] px-5 py-8 md:px-10"><div className="mx-auto max-w-6xl"><Link href="/admin" className="text-xs font-medium text-slate-400 hover:text-slate-700">← CreaDock Admin</Link><header className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">Storage operations</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.06em] text-slate-950">Creator files</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Review digital-product resources and safely stop or restore public sale. Changes preserve stored objects and purchaser records while creating an operational audit entry.</p></div><Button variant="outline" disabled={refreshUsage.isPending} onClick={() => refreshUsage.mutate()}><RefreshCw className={`mr-2 h-4 w-4 ${refreshUsage.isPending ? "animate-spin" : ""}`} />{refreshUsage.isPending ? "Measuring…" : "Refresh storage usage"}</Button></header><section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="hidden grid-cols-[minmax(0,1fr)_110px_100px_190px] gap-4 border-b border-slate-100 px-5 py-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400 md:grid"><span>Product resource</span><span>Storage</span><span>Status</span><span className="text-right">Action</span></div>{files.isLoading ? <p className="px-5 py-10 text-center text-sm text-slate-400">Loading file records…</p> : files.error ? <div className="px-5 py-10 text-center"><p className="text-sm text-slate-600">File records could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => files.refetch()}>Try again</Button></div> : files.data?.length ? <div className="divide-y divide-slate-100">{files.data.map((file) => <div key={file.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_110px_100px_190px] md:items-center md:gap-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{file.name}</p><p className="mt-1 truncate text-xs text-slate-400">{file.fileKey || file.fileUrl || file.externalUrl || "No file attached"}</p></div><span className="text-xs text-slate-500">{bytes(file.fileSizeBytes)}</span><span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{file.status}</span><div className="flex justify-start gap-2 md:justify-end">{file.status !== "archived" ? <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: file.id, status: "archived" })}><Archive className="mr-1.5 h-3.5 w-3.5" />Archive</Button> : <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: file.id, status: "draft" })}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restore draft</Button>}</div></div>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-400">No product file records yet.</p>}</section></div></main>;
}
