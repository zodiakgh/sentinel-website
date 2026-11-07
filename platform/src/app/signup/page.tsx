import Link from "next/link";
import { Activity, ArrowLeft, Github, Mail } from "lucide-react";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/"><ArrowLeft size={15} /> Back to Sentinel</Link>
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-mark"><Activity size={17} /></span><span>SENTINEL<span className="brand-muted"> ANALYTICS</span></span></Link>
        <div className="eyebrow">START MEASURING WHAT MATTERS</div>
        <h1>Create your account.</h1>
        <p>Public registration is the product direction. Account creation will be enabled after secure authentication and database setup are complete.</p>
        <div className="auth-provider"><span><Activity size={16} /> Continue with Google</span><small>Coming in Phase 2</small></div>
        <div className="auth-provider"><span><Github size={16} /> Continue with GitHub</span><small>Coming in Phase 2</small></div>
        <div className="auth-provider"><span><Mail size={16} /> Continue with email</span><small>Coming in Phase 2</small></div>
        <div className="auth-note">This is a development preview. Registration is not active yet, and no personal information is collected here.</div>
        <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
      </section>
    </main>
  );
}
