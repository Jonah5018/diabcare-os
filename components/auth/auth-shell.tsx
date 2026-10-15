import type { ReactNode } from "react";
import { Activity, ArrowUpRight, Fingerprint, Layers3, ShieldCheck } from "lucide-react";
import styles from "./auth-shell.module.css";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export default function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main id="main-content" className={styles.shell}>
      <aside className={styles.brandPanel} aria-label="About DiabCare OS">
        <div className={styles.brand}>
          <span className={styles.brandMark}><Activity size={25} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>DiabCare <span className={styles.brandSuffix}>OS</span></span>
        </div>

        <div className={styles.brandContent}>
          <p className={styles.kicker}>THE CONNECTED CLINIC WORKSPACE</p>
          <h2>Better connected.<br />Better continuity.</h2>
          <p className={styles.brandDescription}>
            Modern clinic operations. Longitudinal care.<br className="hidden xl:block" /> One considered workspace.
          </p>

          <div className={styles.careVisual} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.orbitInner} />
            <div className={styles.visualCore}><Activity size={39} strokeWidth={1.4} /></div>
            <div className={styles.visualLabel}><span /> CONTINUITY OF CARE</div>
            <div className={styles.visualCard}>
              <span className={styles.visualIcon}><Layers3 size={18} /></span>
              <div><strong>Every visit, connected.</strong><span>A clearer view of the care journey</span></div>
              <ArrowUpRight size={16} />
            </div>
            <span className={styles.orbitPoint} />
          </div>

          <div className={styles.trustList}>
            <span><Fingerprint size={17} aria-hidden="true" /> Role-aware access</span>
            <span><Layers3 size={17} aria-hidden="true" /> Multi-tenant isolation</span>
            <span><ShieldCheck size={17} aria-hidden="true" /> Audit-ready workflows</span>
          </div>
        </div>

        <p className={styles.brandFooter}>BUILT AROUND THE WAY CLINICS CARE.</p>
      </aside>

      <section className={styles.formPanel} aria-labelledby="auth-title">
        <div className={styles.formContainer}>
          <div className={styles.formHeading}>
            <p className={styles.formEyebrow}><span /> {eyebrow}</p>
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </div>
          {children}
          <div className={styles.formFooter}>
            <ShieldCheck size={15} aria-hidden="true" />
            <p>Your account. Your authorized workspace.</p>
          </div>
        </div>
        <p className={styles.pageFooter}>DiabCare OS <span aria-hidden="true">/</span> Clinic operations, thoughtfully connected.</p>
      </section>
    </main>
  );
}
