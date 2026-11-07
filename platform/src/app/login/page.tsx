import Link from "next/link";
import { Activity, ArrowLeft, Github, Mail } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/"><ArrowLeft size={15} /> Back to Sentinel</Link>
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark"><Activity size={17} /></span><span>SENTINEL<span className="brand-muted"> ANALYTICS</span></span></Link>
        <div className="eyebrow">YOUR ANALYTICS WORKSPACE</div>
        <h1>Welcome back.</h1>
        <p>Sign-in is being connected in the authentication phase. No account or session is created on this preview yet.</p>
        <div className="auth-provider"><span><Activity size={16} /> Google sign-in</span><small>Coming in Phase 2</small></div>
        <div className="auth-provider"><span><Github size={16} /> GitHub sign-in</span><small>Coming in Phase 2</small></div>
        <div className="auth-provider"><span><Mail size={16} /> Email and password</span><small>Coming in Phase 2</small></div>
        <div className="auth-note">Authentication is not active on this development branch. Never enter a real password here.</div>
        <div className="auth-switch">New to Sentinel? <Link href="/signup">Create an account</Link></div>
      </section>
    </main>
  );
}
