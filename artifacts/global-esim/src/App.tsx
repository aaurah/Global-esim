import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  Clipboard, Cloud, CreditCard, Globe2, KeyRound, LifeBuoy, LockKeyhole,
  Menu, Moon, Package, Plus, Search, Shield, ShieldCheck, Signal, Sun, Wifi, X,
} from 'lucide-react';
import {
  getListAdminPlansQueryKey, getListPlansQueryKey, getListCoverageQueryKey,
  getLookupOrderQueryKey, useCreateOrder, useCreatePlan, useDeletePlan,
  useGetDashboardSummary, useGetIntegrationStatus, useListAdminOrders, useListAdminPlans,
  useListCoverage, useListPlans, useLookupOrder, useUpdatePlan,
} from '@workspace/api-client-react';
import type { Plan, PlanInput, PlanUpdate } from '@workspace/api-client-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#198cf2', colorForeground: '#e7f0ff', colorMutedForeground: '#91a3bc',
    colorDanger: '#ed6676', colorBackground: '#101b2c', colorInput: '#0b1524',
    colorInputForeground: '#e7f0ff', colorNeutral: '#31435b', fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#101b2c] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#31435b]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#e7f0ff] font-bold', headerSubtitle: 'text-[#91a3bc]',
    socialButtonsBlockButtonText: 'text-[#e7f0ff]', formFieldLabel: 'text-[#c8d7e9]',
    footerActionLink: 'text-[#55c7ff]', footerActionText: 'text-[#91a3bc]',
    dividerText: 'text-[#91a3bc]', identityPreviewEditButton: 'text-[#55c7ff]',
    formFieldSuccessText: 'text-[#55d6b0]', alertText: 'text-[#e7f0ff]',
    logoBox: 'mb-4', logoImage: 'rounded-lg', socialButtonsBlockButton: 'border-[#31435b]',
    formButtonPrimary: 'bg-[#198cf2] text-white', formFieldInput: 'bg-[#0b1524] text-[#e7f0ff] border-[#31435b]',
    footerAction: 'text-[#91a3bc]', dividerLine: 'bg-[#31435b]', alert: 'border-[#31435b]',
    otpCodeFieldInput: 'bg-[#0b1524] text-[#e7f0ff]', formFieldRow: 'text-[#e7f0ff]', main: 'text-[#e7f0ff]',
  },
};

function fmtMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(cents / 100);
}
function fmtData(mb: number) {
  return mb >= 1024 ? `${Number((mb / 1024).toFixed(1))} GB` : `${mb} MB`;
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('esim-theme') !== 'light');
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('esim-theme', next ? 'dark' : 'light');
  };
  return { dark, toggle };
}
function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" data-testid="link-brand">
    <span className="brand-mark"><Signal size={17} strokeWidth={2.3} /></span>
    {!compact && <span className="brand-name">GLOBAL<span>eSIM</span><small>PRIVACY PRO</small></span>}
  </Link>;
}
function ThemeButton({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return <button className="icon-button theme-toggle" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} data-testid="button-theme">
    {dark ? <Sun size={17} /> : <Moon size={17} />}
  </button>;
}
function SandboxPill() { return <span className="sandbox-pill"><span /> SANDBOX MODE</span>; }
function Loading({ label = 'Loading data' }: { label?: string }) {
  return <div className="skeleton-stack" aria-label={label}><i /><i /><i /></div>;
}
function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="notice notice-error" role="alert"><CircleHelp size={18} /><div><strong>We couldn’t load this view.</strong><p>{errorText(error)}</p>{retry && <button className="text-button" onClick={retry}>Try again</button>}</div></div>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="empty-icon"><Globe2 size={20} /></span><h3>{title}</h3><p>{detail}</p></div>;
}

function StoreHeader() {
  const [mobile, setMobile] = useState(false);
  const { dark, toggle } = useTheme();
  return <header className="store-header">
    <div className="header-inner"><Brand />
      <nav className={`main-nav ${mobile ? 'nav-open' : ''}`}>
        <Link href="/plans" data-testid="link-plans">Explore plans</Link>
        <Link href="/order-lookup" data-testid="link-order-lookup">Order lookup</Link>
        <a href="#how-it-works">How it works</a>
      </nav>
      <div className="header-actions"><ThemeButton dark={dark} toggle={toggle} />
        <Link href="/sign-in" className="sign-in-link" data-testid="link-sign-in">Sign in</Link>
        <Link href="/plans" className="button button-primary header-cta" data-testid="link-find-plan">Find a plan <ArrowRight size={15} /></Link>
      </div>
      <button className="icon-button mobile-menu" aria-label="Toggle navigation" onClick={() => setMobile(!mobile)} data-testid="button-mobile-menu">{mobile ? <X size={18} /> : <Menu size={18} />}</button>
    </div>
  </header>;
}

function Footer() {
  return <footer className="site-footer"><Brand /><p>Connectivity, with the details in the open.</p><div className="footer-links"><Link href="/plans">Browse plans</Link><Link href="/order-lookup">Order lookup</Link><Link href="/sign-in">Operator sign in</Link></div><span>© 2025 Global eSIM Privacy Pro · Sandbox experience</span></footer>;
}
function StoreLayout({ children }: { children: React.ReactNode }) {
  return <><StoreHeader /><main>{children}</main><Footer /></>;
}

function HomePage() {
  const plansQuery = useListPlans();
  const coverageQuery = useListCoverage();
  const plans = plansQuery.data ?? [];
  const coverage = coverageQuery.data ?? [];
  return <StoreLayout>
    <section className="hero-wrap">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> PRIVATE BY DESIGN. CLEAR BY DEFAULT.</div>
          <h1>Travel connected.<br /><span>Stay in control.</span></h1>
          <p className="hero-lede">Prepaid eSIM data for the places you’re going — with transparent plans, straightforward setup details, and no mystery fine print.</p>
          <div className="hero-buttons"><Link href="/plans" className="button button-primary button-large" data-testid="link-hero-browse">Browse destinations <ArrowRight size={17} /></Link><Link href="/order-lookup" className="button button-quiet button-large" data-testid="link-hero-lookup">Look up an order</Link></div>
          <div className="trust-points"><span><ShieldCheck size={15} /> Prepaid pricing</span><span><LockKeyhole size={15} /> No account required to browse</span></div>
        </div>
        <div className="hero-art" aria-label="Abstract global connectivity illustration">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          <div className="world-glow" /><div className="hero-coordinate coord-a">35° 41′ N <b>●</b> 139° 41′ E</div>
          <div className="hero-coordinate coord-b">SIGNAL PATH <b>01—04</b></div>
          <div className="signal-node node-one" /><div className="signal-node node-two" /><div className="signal-node node-three" />
          <div className="hero-device"><div className="device-top"><span className="device-dot" /> TRAVEL PROFILE <span className="device-menu">···</span></div><div className="device-flag">JP</div><strong>Japan</strong><small>Tokyo · data plan</small><div className="device-rule" /><div className="device-data"><span>5 GB</span><span>10 DAYS</span></div><div className="device-footer"><span><span className="live-dot" /> Ready to install</span><ArrowUpRight size={14} /></div></div>
          <div className="art-caption"><span>01 / GLOBAL CONNECTIVITY</span><span>BUILT FOR THE INDEPENDENT TRAVELER</span></div>
        </div>
      </div>
      <div className="hero-foot"><span>One small profile. A lot more room to roam.</span><span>Scroll to explore <span className="scroll-line" /></span></div>
    </section>

    <section className="section destinations-section" id="destinations">
      <div className="section-heading"><div><div className="eyebrow">YOUR NEXT CONNECTION</div><h2>Where to next?</h2><p>Explore the sandbox catalog by destination. Availability and plan details are examples, not live carrier data.</p></div><Link href="/plans" className="text-link" data-testid="link-all-plans">View all plans <ArrowRight size={16} /></Link></div>
      {plansQuery.isLoading ? <Loading label="Loading example plans" /> : plansQuery.isError ? <ErrorPanel error={plansQuery.error} retry={() => plansQuery.refetch()} /> :
      <div className="destination-cards">
        {plans.slice(0, 3).map((plan, i) => <PlanCard key={plan.id} plan={plan} accent={i} />)}
        {plans.length === 0 && <Empty title="The catalog is taking a pause" detail="There are no published sandbox plans yet. Check back soon." />}
      </div>}
      <div className="coverage-strip"><div className="coverage-title"><Globe2 size={19} /><span><strong>Coverage, made legible</strong><small>Destination availability from the example catalog</small></span></div>
        {coverageQuery.isLoading ? <span className="muted-inline">Checking destination list…</span> : coverageQuery.isError ? <span className="muted-inline">Coverage list is temporarily unavailable.</span> :
          <div className="coverage-tags">{coverage.slice(0, 5).map(item => <span key={item.countryCode}>{item.countryName}<i>{item.planCount}</i></span>)}{coverage.length > 5 && <Link href="/plans">+{coverage.length - 5} more</Link>}</div>}
      </div>
    </section>
    <section className="section process-section" id="how-it-works"><div className="process-intro"><div className="eyebrow">SIMPLE ON PURPOSE</div><h2>Good travel data<br />starts with clarity.</h2><p>Know what you’re buying, what your device needs, and what happens next. No hidden activation promise.</p><Link href="/plans" className="text-link">Choose a destination <ArrowRight size={16} /></Link></div>
      <div className="process-steps"><article><span>01</span><div><h3>Choose your coverage</h3><p>Compare destinations, data allowance, and validity before you decide.</p></div><Globe2 size={20} /></article><article><span>02</span><div><h3>Review every detail</h3><p>Plans are prepaid. Device compatibility and regional coverage still matter.</p></div><ShieldCheck size={20} /></article><article><span>03</span><div><h3>Keep your reference</h3><p>Use your private order access key to revisit an order summary.</p></div><KeyRound size={20} /></article></div>
    </section>
    <section className="disclosure-section"><div className="disclosure-mark"><Shield size={20} /></div><div><div className="eyebrow">PRIVACY, WITHOUT PROMISES WE CAN’T KEEP</div><h2>More transparency.<br />No anonymity claims.</h2><p>We don’t promise guaranteed anonymity. Carrier and network operators may process device and connection data as part of providing service. Review plan and provider terms before purchase.</p><Link href="/plans" className="text-link">Read plan details before checkout <ArrowRight size={16} /></Link></div><div className="disclosure-side"><span>BUYER PRINCIPLES</span><p><Check size={14} /> Understand the purchase</p><p><Check size={14} /> Keep control of order access</p><p><Check size={14} /> No fabricated network status</p></div></section>
  </StoreLayout>;
}

function PlanCard({ plan, accent = 0, onBuy }: { plan: Plan; accent?: number; onBuy?: (plan: Plan) => void }) {
  const colors = ['blue', 'violet', 'cyan'];
  return <article className={`plan-card card-accent-${colors[accent % colors.length]}`} data-testid={`card-plan-${plan.id}`}>
    <div className="plan-card-top"><span className="plan-country-code">{plan.countryCode ?? 'GL'}</span><span className="plan-region">{plan.regionType}</span></div>
    <div className="plan-location"><span className="location-pin"><Globe2 size={15} /></span><div><h3>{plan.countryName}</h3><p>{plan.name}</p></div></div>
    <div className="plan-allowance"><strong>{fmtData(plan.dataMb)}</strong><span>data</span><i /></div>
    <div className="plan-facts"><span><Activity size={14} /> {plan.validityDays} days</span><span><Wifi size={14} /> {plan.serviceType === 'data_voice_sms' ? 'Data + voice' : 'Data only'}</span></div>
    <div className="plan-price-row"><div><strong>{fmtMoney(plan.priceCents, plan.currency)}</strong><small>one-time · prepaid</small></div>
      {onBuy ? <button className="button button-primary" onClick={() => onBuy(plan)} data-testid={`button-order-plan-${plan.id}`}>Choose plan <ArrowRight size={15} /></button> : <Link href="/plans" className="card-arrow" aria-label={`Explore ${plan.countryName} plans`}><ArrowRight size={17} /></Link>}</div>
    <div className="plan-sandbox-note">Example plan · sandbox catalog</div>
  </article>;
}

function OrderDialog({ plan, close }: { plan: Plan | null; close: () => void }) {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ accessKey: string; order: { id: string; status: string; provisioningStatus: string } } | null>(null);
  const createOrder = useCreateOrder();
  if (!plan) return null;
  const submit = () => createOrder.mutate({ data: { planId: plan.id, email: email.trim() || null } }, { onSuccess: setResult });
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
    <button className="modal-close icon-button" onClick={close} aria-label="Close order details"><X size={18} /></button>
    {result ? <><div className="success-mark"><Check size={22} /></div><div className="eyebrow">SANDBOX ORDER CREATED</div><h2 id="order-title">Your reference is ready.</h2><p className="modal-lede">This is a sandbox order only. It does not purchase, provision, or activate an eSIM.</p><div className="order-key"><span>PRIVATE ACCESS KEY</span><code>{result.accessKey}</code><button className="icon-button" aria-label="Copy access key" onClick={() => navigator.clipboard?.writeText(result.accessKey)}><Clipboard size={16} /></button></div><p className="fine-print">Save this key to look up the order later. Order ref: {result.order.id}</p><Link href="/order-lookup" onClick={close} className="button button-primary button-full">Go to order lookup <ArrowRight size={16} /></Link></> :
    <><SandboxPill /><div className="eyebrow modal-eyebrow">REVIEW YOUR SELECTION</div><h2 id="order-title">{plan.countryName}, on your terms.</h2><div className="order-summary"><span>{fmtData(plan.dataMb)} · {plan.validityDays} days</span><strong>{fmtMoney(plan.priceCents, plan.currency)}</strong></div><p className="modal-lede">A sandbox order record will be created for demonstration. No payment is taken and no eSIM is activated.</p><label className="field-label" htmlFor="order-email">Email for your reference <span>optional</span></label><input id="order-email" className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-order-email" />{createOrder.isError && <p className="form-error">{errorText(createOrder.error)}</p>}<button className="button button-primary button-full" onClick={submit} disabled={createOrder.isPending} data-testid="button-create-sandbox-order">{createOrder.isPending ? 'Creating sandbox order…' : 'Create sandbox order'} <ArrowRight size={16} /></button><p className="fine-print">Your email is optional. We don’t claim guaranteed anonymity; network providers may process connection data.</p></>}
  </section></div>;
}

function PlansPage() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const plansQuery = useListPlans();
  const coverageQuery = useListCoverage();
  const plans = plansQuery.data ?? [];
  const filtered = useMemo(() => plans.filter(plan => {
    const matchesSearch = `${plan.countryName} ${plan.name} ${plan.countryCode ?? ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (region === 'all' || plan.regionType === region);
  }), [plans, search, region]);
  return <StoreLayout><section className="page-shell catalog-page"><div className="page-title-row"><div><div className="eyebrow">SANDBOX CATALOG</div><h1>Find your next plan.</h1><p>Example plan listings for exploring the experience. Not live carrier availability.</p></div><SandboxPill /></div>
    <div className="catalog-tools"><label className="search-field"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a country or destination" aria-label="Search plans" data-testid="input-plan-search" /><kbd>/</kbd></label><label className="select-wrap"><span>Region</span><select value={region} onChange={e => setRegion(e.target.value)} aria-label="Filter by region type" data-testid="select-plan-region"><option value="all">All plan types</option><option value="country">Country</option><option value="regional">Regional</option><option value="global">Global</option></select><ChevronDown size={15} /></label></div>
    <div className="catalog-meta"><span>{plansQuery.isLoading ? 'Loading catalog…' : `${filtered.length} example ${filtered.length === 1 ? 'plan' : 'plans'}`}</span><span><ShieldCheck size={14} /> Prepaid · transparent pricing</span></div>
    {plansQuery.isLoading ? <Loading label="Loading catalog plans" /> : plansQuery.isError ? <ErrorPanel error={plansQuery.error} retry={() => plansQuery.refetch()} /> : filtered.length ? <div className="plan-grid">{filtered.map((plan, i) => <PlanCard key={plan.id} plan={plan} accent={i} onBuy={setSelectedPlan} />)}</div> : <Empty title="No plans match that search" detail="Try a different destination or reset the region filter." />}
    <div className="catalog-footnote"><Shield size={17} /><div><strong>Privacy means being clear about the tradeoffs.</strong><p>Buying an eSIM does not guarantee anonymity. Network operators may process identifying device or connection information as part of service delivery.</p></div></div>
    {coverageQuery.isSuccess && <div className="destination-list"><h2>Destinations in the sandbox catalog</h2><div>{coverageQuery.data.map(item => <span key={item.countryCode}><i>{item.countryCode}</i>{item.countryName}<small>{item.planCount} example plans</small></span>)}</div></div>}
    <OrderDialog plan={selectedPlan} close={() => setSelectedPlan(null)} />
  </section></StoreLayout>;
}

function OrderLookupPage() {
  const [accessKey, setAccessKey] = useState('');
  const [submittedKey, setSubmittedKey] = useState('');
  const params = { accessKey: submittedKey };
  const lookup = useLookupOrder(params, { query: { enabled: !!submittedKey, queryKey: getLookupOrderQueryKey(params), retry: false } });
  return <StoreLayout><section className="lookup-wrap"><div className="lookup-icon"><KeyRound size={23} /></div><div className="eyebrow">PRIVATE ORDER LOOKUP</div><h1>Find your order.</h1><p>Enter the access key from your order confirmation. The key is private, so keep it somewhere safe.</p><form onSubmit={e => { e.preventDefault(); setSubmittedKey(accessKey.trim()); }} className="lookup-form"><label htmlFor="lookup-key">Order access key</label><div className="lookup-input"><KeyRound size={17} /><input id="lookup-key" required value={accessKey} onChange={e => setAccessKey(e.target.value)} placeholder="Paste your private access key" data-testid="input-order-key" /></div><button className="button button-primary button-full" disabled={!accessKey.trim()} data-testid="button-lookup-order">Look up order <ArrowRight size={16} /></button></form>
    {lookup.isLoading && submittedKey && <div className="lookup-result"><Loading label="Looking up order" /></div>}
    {lookup.isError && submittedKey && <div className="lookup-result"><ErrorPanel error={lookup.error} retry={() => lookup.refetch()} /></div>}
    {lookup.data && <div className="lookup-result order-result"><div className="result-heading"><div><small>ORDER REFERENCE</small><strong>{lookup.data.id}</strong></div><span className="status-chip">{lookup.data.status}</span></div><div className="result-row"><span>Plan</span><strong>{lookup.data.planName}</strong></div><div className="result-row"><span>Payment</span><strong>{lookup.data.paymentStatus}</strong></div><div className="result-row"><span>Provisioning</span><strong>{lookup.data.provisioningStatus}</strong></div><div className="result-row"><span>Amount</span><strong>{fmtMoney(lookup.data.amountCents, lookup.data.currency)}</strong></div><p className="fine-print">Sandbox order. It does not represent a live eSIM or activation status.</p></div>}
    <div className="privacy-note"><LockKeyhole size={16} /><span>Access keys are private credentials. Avoid sharing them in public or on shared devices.</span></div>
  </section></StoreLayout>;
}

function AdminFrame({ children, active }: { children: React.ReactNode; active: string }) {
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [{ href: '/dashboard', label: 'Overview', icon: Activity }, { href: '/admin/plans', label: 'Plans', icon: Package }, { href: '/admin/orders', label: 'Orders', icon: CreditCard }, { href: '/settings/integrations', label: 'Integrations', icon: Cloud }];
  return <div className="admin-app"><aside className={`admin-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><Brand /><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close sidebar"><X size={17} /></button></div><div className="workspace-label">OPERATOR CONSOLE <span>DEMO</span></div><nav className="sidebar-nav">{nav.map(item => <Link key={item.href} href={item.href} className={active === item.href ? 'active' : ''} onClick={() => setMobileOpen(false)} data-testid={`nav-${item.label.toLowerCase()}`}><item.icon size={17} />{item.label}{active === item.href && <i />}</Link>)}</nav><div className="sidebar-bottom"><div className="admin-help"><LifeBuoy size={16} /><span>Need a hand?<small>Operator support</small></span><ArrowUpRight size={14} /></div><div className="sidebar-user"><span className="user-avatar">OP</span><span>Operator account<small>Sandbox workspace</small></span><ChevronDown size={15} /></div></div></aside>
    <div className="admin-main"><header className="admin-topbar"><button className="icon-button admin-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{nav.find(i => i.href === active)?.label ?? 'Overview'}</strong></div><div className="topbar-right"><SandboxPill /><ThemeButton dark={dark} toggle={toggle} /><span className="operator-avatar">OP</span></div></header><main className="admin-content">{children}</main></div></div>;
}
function AdminGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="auth-loading"><Loading label="Checking sign-in status" /></div>;
  if (!isSignedIn) return <div className="admin-auth-wall"><Brand /><div className="auth-wall-card"><span className="auth-lock"><LockKeyhole size={22} /></span><div className="eyebrow">OPERATOR ACCESS</div><h1>Sign in to continue.</h1><p>Admin tools are limited to signed-in operator accounts. Server-side role checks still apply.</p><Link href="/sign-in" className="button button-primary button-full" data-testid="link-admin-sign-in">Sign in securely <ArrowRight size={16} /></Link><small>Signed-in access does not itself grant administrator permissions.</small></div></div>;
  return <>{children}</>;
}
function AccessFeedback({ error }: { error: unknown }) {
  const text = errorText(error);
  return <div className="notice notice-error"><LockKeyhole size={18} /><div><strong>Operator authorization required.</strong><p>{text} Signed-in access alone does not grant administrator permissions; server-side role approval is required.</p></div></div>;
}
function AdminTitle({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="admin-page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function DashboardPage() {
  const summary = useGetDashboardSummary();
  const q = summary;
  const data = q.data;
  const sales = data ? fmtMoney(data.sandboxOrderValueCents) : '—';
  return <AdminFrame active="/dashboard"><AdminTitle eyebrow="OPERATOR OVERVIEW" title="A clear view of the operation." subtitle="Sandbox metrics for your connectivity storefront." action={<SandboxPill />} />
    {q.isLoading ? <Loading label="Loading dashboard metrics" /> : q.isError ? <AccessFeedback error={q.error} /> : data && <>
      <div className="metric-grid"><Metric icon={CreditCard} label="Sandbox orders" value={String(data.orderCount)} note="All-time orders" /><Metric icon={Package} label="Active plans" value={String(data.activePlans)} note="In example catalog" /><Metric icon={ArrowDownRight} label="Gross sales" value={sales} note="Sandbox values only" /><Metric icon={Cloud} label="Integrations" value={String(data.integrationCount)} note="Configured providers" /></div>
      <section className="admin-panel recent-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest activity in the sandbox workspace</p></div><Link href="/admin/orders" className="text-link">All orders <ArrowRight size={15} /></Link></div>{data.recentOrders.length ? <OrderTable orders={data.recentOrders} /> : <Empty title="No sandbox orders yet" detail="Orders created through the storefront will appear here." />}</section>
      <div className="dashboard-bottom"><div className="admin-panel"><div className="panel-heading"><div><h2>Service readiness</h2><p>Provider setup is not represented as live connectivity.</p></div><Link href="/settings/integrations" className="panel-link"><ArrowUpRight size={16} /></Link></div><div className="readiness-line"><span className="readiness-icon"><Cloud size={16} /></span><div><strong>Provider integrations</strong><small>Review readiness and configuration details</small></div><span className="mini-status">Review</span></div></div><div className="admin-panel integrity-panel"><span className="integrity-emblem"><ShieldCheck size={20} /></span><div><strong>Privacy claims stay grounded</strong><p>No guaranteed anonymity, live carrier, or activation claims are shown in this sandbox.</p></div></div></div>
    </>}
  </AdminFrame>;
}
function Metric({ icon: Icon, label, value, note }: { icon: typeof Activity; label: string; value: string; note: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i><Icon size={17} /></i></div><strong>{value}</strong><small>{note}</small><div className="metric-trace"><span /></div></article>;
}
function OrderTable({ orders }: { orders: Array<{ id: string; planName: string; status: string; paymentStatus: string; provisioningStatus: string; amountCents: number; currency: string; mode: string; createdAt: string }> }) {
  return <div className="table-scroll"><table><thead><tr><th>Order</th><th>Plan</th><th>Status</th><th>Payment</th><th>Amount</th><th>Created</th></tr></thead><tbody>{orders.map(order => <tr key={order.id} data-testid={`row-order-${order.id}`}><td><span className="table-id">{order.id}</span><small>{order.mode}</small></td><td>{order.planName}</td><td><span className="status-chip">{order.status}</span></td><td>{order.paymentStatus}</td><td>{fmtMoney(order.amountCents, order.currency)}</td><td>{new Date(order.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>;
}

type PlanFormState = { name: string; countryCode: string; countryName: string; regionType: 'country' | 'regional' | 'global'; dataMb: string; validityDays: string; price: string; serviceType: 'data' | 'data_voice_sms'; network: string; status: 'active' | 'hidden' };
const blankPlan: PlanFormState = { name: '', countryCode: '', countryName: '', regionType: 'country', dataMb: '1024', validityDays: '7', price: '', serviceType: 'data', network: '', status: 'active' };
function PlanEditor({ plan, close, saved }: { plan: Plan | null | undefined; close: () => void; saved: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PlanFormState>(plan ? { name: plan.name, countryCode: plan.countryCode ?? '', countryName: plan.countryName, regionType: plan.regionType as PlanFormState['regionType'], dataMb: String(plan.dataMb), validityDays: String(plan.validityDays), price: (plan.priceCents / 100).toFixed(2), serviceType: plan.serviceType as PlanFormState['serviceType'], network: plan.network, status: plan.status as PlanFormState['status'] } : blankPlan);
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const pending = create.isPending || update.isPending;
  const set = (key: keyof PlanFormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: PlanInput = { name: form.name, countryCode: form.countryCode.trim() || null, countryName: form.countryName, regionType: form.regionType, dataMb: Number(form.dataMb), validityDays: Number(form.validityDays), priceCents: Math.round(Number(form.price) * 100), serviceType: form.serviceType, network: form.network };
    const onSuccess = () => { qc.invalidateQueries({ queryKey: getListAdminPlansQueryKey() }); qc.invalidateQueries({ queryKey: getListPlansQueryKey() }); saved(); close(); };
    if (plan) {
      const updateData: PlanUpdate = { ...data, status: form.status };
      update.mutate({ id: plan.id, data: updateData }, { onSuccess });
    } else create.mutate({ data }, { onSuccess });
  };
  const err = create.error ?? update.error;
  return <div className="modal-backdrop"><form className="modal plan-editor" onSubmit={submit}><button type="button" className="modal-close icon-button" onClick={close} aria-label="Close plan editor"><X size={18} /></button><div className="eyebrow">{plan ? 'EDIT SANDBOX PLAN' : 'NEW SANDBOX PLAN'}</div><h2>{plan ? 'Update plan details' : 'Create a plan'}</h2><p className="modal-lede">This catalog is for sandbox demonstration, not live carrier availability.</p><div className="form-grid">
    <label className="field-label span-2">Plan name<input required minLength={2} className="field-input" value={form.name} onChange={e => set('name', e.target.value)} data-testid="input-plan-name" /></label>
    <label className="field-label">Country / destination<input required className="field-input" value={form.countryName} onChange={e => set('countryName', e.target.value)} data-testid="input-plan-country" /></label>
    <label className="field-label">Country code<input className="field-input" maxLength={8} value={form.countryCode} onChange={e => set('countryCode', e.target.value.toUpperCase())} placeholder="JP" data-testid="input-country-code" /></label>
    <label className="field-label">Plan type<select className="field-input" value={form.regionType} onChange={e => set('regionType', e.target.value)}><option value="country">Country</option><option value="regional">Regional</option><option value="global">Global</option></select></label>
    <label className="field-label">Service type<select className="field-input" value={form.serviceType} onChange={e => set('serviceType', e.target.value)}><option value="data">Data only</option><option value="data_voice_sms">Data, voice and SMS</option></select></label>
    <label className="field-label">Data allowance (MB)<input required type="number" min="100" className="field-input" value={form.dataMb} onChange={e => set('dataMb', e.target.value)} /></label>
    <label className="field-label">Validity (days)<input required type="number" min="1" className="field-input" value={form.validityDays} onChange={e => set('validityDays', e.target.value)} /></label>
    <label className="field-label">Price (USD)<input required type="number" min="0" step="0.01" className="field-input" value={form.price} onChange={e => set('price', e.target.value)} /></label>
    <label className="field-label">Network label<input className="field-input" maxLength={120} value={form.network} onChange={e => set('network', e.target.value)} placeholder="Example / not verified" /></label>
    {plan && <label className="field-label">Catalog visibility<select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Active</option><option value="hidden">Hidden</option></select></label>}
    </div>{err && <p className="form-error">{errorText(err)}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={close}>Cancel</button><button className="button button-primary" disabled={pending} data-testid="button-save-plan">{pending ? 'Saving…' : plan ? 'Save changes' : 'Create sandbox plan'}</button></div></form></div>;
}
function PlansAdminPage() {
  const [editing, setEditing] = useState<Plan | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);
  const q = useListAdminPlans();
  const qc = useQueryClient();
  const remove = useDeletePlan();
  const plans = q.data ?? [];
  const shown = plans.filter(p => `${p.name} ${p.countryName}`.toLowerCase().includes(search.toLowerCase()));
  const deleteIt = () => confirmDelete && remove.mutate({ id: confirmDelete.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListAdminPlansQueryKey() }); qc.invalidateQueries({ queryKey: getListPlansQueryKey() }); setConfirmDelete(null); } });
  return <AdminFrame active="/admin/plans"><AdminTitle eyebrow="CATALOG OPERATIONS" title="Plans" subtitle="Manage the example plans shown in the public sandbox catalog." action={<button className="button button-primary" onClick={() => setEditing(null)} data-testid="button-add-plan"><Plus size={16} /> Add plan</button>} />
    <div className="admin-panel plan-admin-panel"><div className="table-toolbar"><label className="search-field admin-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plans" data-testid="input-admin-plan-search" /></label><span className="table-count">{plans.length} plans <span>· sandbox</span></span></div>{q.isLoading ? <Loading /> : q.isError ? <AccessFeedback error={q.error} /> : shown.length ? <div className="table-scroll"><table><thead><tr><th>Plan</th><th>Type</th><th>Data / validity</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{shown.map(plan => <tr key={plan.id}><td><div className="plan-cell"><span className="table-country">{plan.countryCode ?? 'GL'}</span><span><strong>{plan.countryName}</strong><small>{plan.name}</small></span></div></td><td>{plan.regionType}</td><td>{fmtData(plan.dataMb)} / {plan.validityDays} days</td><td>{fmtMoney(plan.priceCents, plan.currency)}</td><td><span className={`status-chip ${plan.status === 'active' ? 'status-good' : ''}`}>{plan.status}</span></td><td><div className="row-actions"><button className="button-small" onClick={() => setEditing(plan)} data-testid={`button-edit-plan-${plan.id}`}>Edit</button><button className="button-small danger-small" onClick={() => setConfirmDelete(plan)} data-testid={`button-delete-plan-${plan.id}`}>Delete</button></div></td></tr>)}</tbody></table></div> : <Empty title="No matching plans" detail="Add a plan or change your search." />}</div>
    {editing !== undefined && <PlanEditor plan={editing} close={() => setEditing(undefined)} saved={() => {}} />}
    {confirmDelete && <div className="modal-backdrop"><section className="modal confirm-modal"><div className="eyebrow">REMOVE SANDBOX PLAN</div><h2>Delete {confirmDelete.name}?</h2><p className="modal-lede">This plan will be removed from the sandbox catalog. This action cannot be undone.</p>{remove.isError && <p className="form-error">{errorText(remove.error)}</p>}<div className="modal-actions"><button className="button button-quiet" onClick={() => setConfirmDelete(null)}>Keep plan</button><button className="button button-danger" onClick={deleteIt} disabled={remove.isPending} data-testid="button-confirm-delete-plan">{remove.isPending ? 'Deleting…' : 'Delete plan'}</button></div></section></div>}
  </AdminFrame>;
}
function AdminOrdersPage() {
  const q = useListAdminOrders();
  const [search, setSearch] = useState('');
  const orders = q.data ?? [];
  const filtered = orders.filter(o => `${o.id} ${o.planName} ${o.status} ${o.paymentStatus}`.toLowerCase().includes(search.toLowerCase()));
  return <AdminFrame active="/admin/orders"><AdminTitle eyebrow="ORDER OPERATIONS" title="Orders" subtitle="Review recent sandbox orders and their recorded statuses." action={<SandboxPill />} /><section className="admin-panel orders-panel"><div className="table-toolbar"><label className="search-field admin-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order, plan, or status" data-testid="input-order-search" /></label><span className="table-count">{orders.length} records</span></div>{q.isLoading ? <Loading /> : q.isError ? <AccessFeedback error={q.error} /> : filtered.length ? <OrderTable orders={filtered} /> : <Empty title="No matching orders" detail="Sandbox orders will appear here after a storefront test." />}</section><p className="admin-footnote"><ShieldCheck size={15} /> Status fields are recorded sandbox data. No operation here provisions an eSIM.</p></AdminFrame>;
}
function IntegrationsPage() {
  const q = useGetIntegrationStatus();
  const integrations = q.data ?? [];
  return <AdminFrame active="/settings/integrations"><AdminTitle eyebrow="PROVIDER READINESS" title="Integrations" subtitle="Understand what is configured before connecting any production service." /><div className="integration-callout"><Shield size={18} /><p>Sandbox mode does not connect to carriers, payment processors, or provisioning systems. Status shown below is configuration metadata only.</p></div>{q.isLoading ? <Loading /> : q.isError ? <AccessFeedback error={q.error} /> : integrations.length ? <div className="integration-list">{integrations.map(item => <article className="integration-card" key={item.id}><div className="integration-symbol">{item.category.toLowerCase().includes('payment') ? <CreditCard size={19} /> : item.category.toLowerCase().includes('network') || item.category.toLowerCase().includes('carrier') ? <Signal size={19} /> : <Cloud size={19} />}</div><div className="integration-main"><div className="integration-heading"><h2>{item.name}</h2><span className={`integration-status status-${item.status}`}>{item.status.replaceAll('_', ' ')}</span></div><p>{item.detail}</p><div className="integration-meta"><span>{item.category}</span><span>{item.mode}</span></div></div><button className="icon-button integration-more" aria-label={`Details for ${item.name}`} onClick={() => window.alert(`${item.name}\n\n${item.detail}`)}><ArrowUpRight size={17} /></button></article>)}</div> : <Empty title="No integrations listed" detail="Provider integrations will appear here when they are declared by the service." />}<div className="integration-checklist"><div className="eyebrow">BEFORE PRODUCTION</div><h2>A readiness checklist, not a green light.</h2><div><span><Check size={15} /> Confirm provider contracts</span><span><Check size={15} /> Validate operational and privacy terms</span><span><Check size={15} /> Test provisioning with provider-approved tools</span></div></div></AdminFrame>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && isSignedIn) setLocation('/dashboard', { replace: true }); }, [isLoaded, isSignedIn, setLocation]);
  return isLoaded && isSignedIn ? <div className="auth-loading"><Loading label="Opening operator workspace" /></div> : <HomePage />;
}
function SignInPage() {
  return <div className="auth-page"><div className="auth-sheen" /><div className="auth-brand"><Brand /><Link href="/" className="button button-quiet">Back to store</Link></div><div className="auth-intro"><div className="eyebrow">GLOBAL eSIM PRIVACY PRO</div><h1>Operator workspace access.</h1><p>Sign in to manage sandbox plans and review operational data. Admin permissions are separately enforced by the server.</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /><p className="auth-footnote"><LockKeyhole size={14} /> Your session is handled securely by Clerk.</p></div>;
}
function SignUpPage() {
  return <div className="auth-page"><div className="auth-sheen" /><div className="auth-brand"><Brand /><Link href="/" className="button button-quiet">Back to store</Link></div><div className="auth-intro"><div className="eyebrow">GLOBAL eSIM PRIVACY PRO</div><h1>Create an operator account.</h1><p>Access to administrative actions remains subject to server-side role approval.</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /><p className="auth-footnote"><LockKeyhole size={14} /> Your session is handled securely by Clerk.</p></div>;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your operator workspace' } }, signUp: { start: { title: 'Create your account', subtitle: 'Request access to the operator workspace' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/plans" component={PlansPage} />
      <Route path="/order-lookup" component={OrderLookupPage} />
      <Route path="/dashboard"><AdminGate><DashboardPage /></AdminGate></Route>
      <Route path="/admin/plans"><AdminGate><PlansAdminPage /></AdminGate></Route>
      <Route path="/admin/orders"><AdminGate><AdminOrdersPage /></AdminGate></Route>
      <Route path="/settings/integrations"><AdminGate><IntegrationsPage /></AdminGate></Route>
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}
function ClerkUnavailableRoutes() {
  return <Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/plans" component={PlansPage} />
    <Route path="/order-lookup" component={OrderLookupPage} />
    <Route path="/dashboard"><UnavailableAdmin><DashboardPage /></UnavailableAdmin></Route>
    <Route path="/admin/plans"><UnavailableAdmin><PlansAdminPage /></UnavailableAdmin></Route>
    <Route path="/admin/orders"><UnavailableAdmin><AdminOrdersPage /></UnavailableAdmin></Route>
    <Route path="/settings/integrations"><UnavailableAdmin><IntegrationsPage /></UnavailableAdmin></Route>
    <Route path="/sign-in/*?" component={AuthUnavailable} />
    <Route path="/sign-up/*?" component={AuthUnavailable} />
    <Route component={NotFound} />
  </Switch>;
}
function UnavailableAdmin({ children }: { children: React.ReactNode }) {
  return <div className="admin-auth-wall"><Brand /><div className="auth-wall-card"><span className="auth-lock"><LockKeyhole size={22} /></span><div className="eyebrow">AUTHENTICATION NOT CONFIGURED</div><h1>Operator sign-in is unavailable.</h1><p>Clerk publishable key is not configured for this environment. Admin access remains protected.</p><Link href="/" className="button button-primary button-full">Return to storefront</Link>{children}</div></div>;
}
function AuthUnavailable() {
  return <div className="auth-page"><div className="auth-brand"><Brand /><Link href="/" className="button button-quiet">Back to store</Link></div><div className="auth-unavailable"><LockKeyhole size={22} /><h1>Authentication setup required</h1><p>Sign-in and account creation become available after the Clerk key is configured.</p><Link href="/" className="button button-primary">Return to storefront</Link></div></div>;
}
function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><RoutedErrorBoundary>{clerkPubKey ? <ClerkRoutes /> : <ClerkUnavailableRoutes />}</RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
