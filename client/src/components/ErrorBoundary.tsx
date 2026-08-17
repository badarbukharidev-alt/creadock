import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(): State { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <main className="grid min-h-screen place-items-center bg-[#f7f7f3] px-6 text-center"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-9 shadow-[0_25px_60px_-40px_rgba(15,23,42,.3)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></span><h1 className="mt-5 text-2xl font-semibold tracking-[-.05em] text-slate-950">We could not load this workspace</h1><p className="mt-3 text-sm leading-6 text-slate-500">Please refresh the page and try again. If the problem continues, return to your dashboard shortly.</p><button onClick={() => window.location.reload()} className="mx-auto mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"><RotateCcw className="h-4 w-4" />Refresh page</button></section></main>;
    return this.props.children;
  }
}

export default ErrorBoundary;
