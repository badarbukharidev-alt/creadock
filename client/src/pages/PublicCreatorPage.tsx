import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ExternalLink, Link2 } from "lucide-react";
import { Link, useRoute } from "wouter";

function Block({ block }: { block: { type: string; content: Record<string, unknown> } }) {
  const text = typeof block.content.text === "string" ? block.content.text : "";
  const title = typeof block.content.title === "string" ? block.content.title : text;
  const url = typeof block.content.url === "string" ? block.content.url : "";
  if (block.type === "divider") return <hr className="my-7 border-slate-200" />;
  if (block.type === "heading") return <h2 className="mt-8 text-2xl font-semibold tracking-[-.05em] text-slate-950">{text}</h2>;
  if (block.type === "text") return <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-600">{text}</p>;
  if (block.type === "image" && url) return <img src={url} alt={typeof block.content.alt === "string" ? block.content.alt : "Creator content"} className="mt-6 w-full rounded-2xl border border-slate-200 object-cover" />;
  if (block.type === "link" && url) return <a href={url} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"><span>{title || url}</span><ExternalLink className="h-4 w-4 text-slate-400" /></a>;
  if (block.type === "email") return <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-semibold text-slate-900">Stay in the loop</p><p className="mt-1 text-sm text-slate-500">Join this creator’s email list for future updates.</p></div>;
  if (block.type === "faq") return <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-900">{title || "Question"}</p><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>;
  return <p className="mt-4 text-sm leading-6 text-slate-600">{text || "Creator content"}</p>;
}

export default function PublicCreatorPage() {
  const [, params] = useRoute("/c/:handle/:slug"); const handle = params?.handle || ""; const slug = params?.slug || "";
  const content = trpc.storefront.publicContent.useQuery({ handle, slug }, { enabled: Boolean(handle && slug) });
  const registerClick = trpc.storefront.registerLinkClick.useMutation();
  if (content.isLoading) return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] text-sm text-slate-400">Loading page…</main>;
  if (content.error || !content.data) return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] px-6 text-center"><div><Link2 className="mx-auto h-5 w-5 text-slate-400" /><h1 className="mt-4 text-2xl font-semibold tracking-[-.05em] text-slate-950">Page unavailable</h1><p className="mt-2 text-sm text-slate-500">This page is still in draft or no longer exists.</p><Link href={`/c/${handle}`}><Button variant="outline" className="mt-5"><ChevronLeft className="mr-2 h-4 w-4" />Back to storefront</Button></Link></div></main>;
  const { creator, page, blocks, links } = content.data;
  const openLink = async (link: typeof links[number]) => { try { const result = await registerClick.mutateAsync({ handle, linkId: link.id }); window.open(result.url, result.openInNewTab ? "_blank" : "_self", result.openInNewTab ? "noopener,noreferrer" : undefined); } catch { window.open(link.url, link.openInNewTab ? "_blank" : "_self"); } };
  return <main className="min-h-screen bg-[#f7f7f3] text-slate-900"><div className="mx-auto max-w-xl px-5 pb-16 pt-8 sm:pt-12"><Link href={`/c/${handle}`} className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700"><span className="grid h-5 w-5 place-items-center rounded-md text-[9px] font-semibold text-white" style={{ backgroundColor: creator.accentColor }}>C</span>{creator.displayName}</Link><header className="pt-10 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-xl font-semibold text-white" style={{ backgroundColor: creator.accentColor }}>{creator.displayName.slice(0, 1).toUpperCase()}</div><h1 className="mt-4 text-4xl font-semibold tracking-[-.07em] text-slate-950">{page.title}</h1><p className="mt-3 text-sm leading-6 text-slate-500">{creator.bio}</p></header><section className="mt-9">{blocks.map((block) => <Block key={block.id} block={block} />)}</section>{links.length ? <section className="mt-10 space-y-3"><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">Links</p>{links.map((link) => <button key={link.id} onClick={() => openLink(link)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"><Link2 className="h-4 w-4 text-slate-400" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{link.title}</span>{link.description ? <span className="mt-0.5 block truncate text-xs text-slate-400">{link.description}</span> : null}</span><ExternalLink className="h-4 w-4 text-slate-400" /></button>)}</section> : null}<footer className="mt-12 text-center text-xs text-slate-400">Made with CreaDock</footer></div></main>;
}
