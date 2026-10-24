import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowUpRight, CalendarDays, CirclePlus, LoaderCircle, LogOut, Menu, Pencil, Search, Trash2, WalletCards, X } from 'lucide-react';
import { ApiError, authApi, expensesApi } from './api.js';
import { useAuth } from './auth.jsx';
import ExpenseDistributionChart from './ExpenseDistributionChart.jsx';
import { aggregateExpensesByCategory } from './expenseDistribution.js';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

function setPageMetadata(title, description) {
  document.title = title;
  const updateMeta = (attribute, key, content) => {
    let meta = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, key);
      document.head.append(meta);
    }
    meta.content = content;
  };
  updateMeta('name', 'description', description);
  updateMeta('property', 'og:title', title);
  updateMeta('property', 'og:description', description);
}

function Brand({ note = 'Personal finance', children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return <header className="site-header">
    <Link className="wordmark" to="/" aria-label="TRAXER home"><span className="brand-mark"><WalletCards size={20} /></span><span>TRAXER</span></Link>
    {children && <div className="site-nav">
      <button ref={menuButton} type="button" className="mobile-menu-toggle" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation-menu" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      <nav id="mobile-navigation-menu" className="mobile-nav-panel" aria-label="Primary navigation" hidden={!menuOpen} onClick={event => { if (event.target.closest('a')) setMenuOpen(false); }}>{children}</nav>
    </div>}
    <span className="header-note">{note}</span>
  </header>;
}

function ToastNotice({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => onDismiss(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return <div className={`toast-notice toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-atomic="true">
    <span>{toast.message}</span>
    <button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>×</button>
  </div>;
}

function DeleteConfirmationDialog({ expense, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  return <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <p className="eyebrow">DESTRUCTIVE ACTION</p>
    <h2 id="delete-dialog-title">Delete this expense?</h2>
    <p id="delete-dialog-description">“{expense.description}” will be permanently deleted. This action cannot be undone.</p>
    {error && <p className="dialog-error" role="alert">{error}</p>}
    <div className="dialog-actions">
      <button type="button" className="quiet-button" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : 'Delete expense'}</button>
    </div>
  </dialog>;
}

function LoadingScreen({ message = 'Loading your account…' }) {
  return <main className="page-shell"><Brand /><div className="loading-state"><LoaderCircle className="spin" size={22} />{message}</div></main>;
}

function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const navigate = useNavigate();
  const { acceptSession, token, user, loading, sessionNotice } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && token && user) navigate('/dashboard', { replace: true }); }, [loading, token, user, navigate]);
  useEffect(() => {
    setPageMetadata(
      isRegister ? 'Create account | TRAXER' : 'Sign in | TRAXER',
      isRegister ? 'Create a TRAXER account to record and review personal expenses.' : 'Sign in to TRAXER to manage your personal expense records.'
    );
  }, [isRegister]);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = isRegister ? await authApi.register(name.trim(), email.trim(), password) : await authApi.login(email.trim(), password);
      acceptSession(result);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  if (loading) return <LoadingScreen message="Restoring your session…" />;
  return <main className="page-shell auth-shell">
    <Brand><Link className="mobile-nav-link" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></Brand>
    <section className="auth-card">
      <p className="eyebrow">{isRegister ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</p>
      <h1>{isRegister ? 'Start with a clearer view.' : 'Your spending, in view.'}</h1>
      <p className="lede">{isRegister ? 'Create a private account to keep your expenses together.' : 'Sign in to see and manage your expenses.'}</p>
      {sessionNotice && <div className="notice error" role="status">{sessionNotice}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <form className="stack-form" onSubmit={submit}>
        {isRegister && <label>Full name<input type="text" autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>}
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 12 : undefined} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} />{isRegister && <small>Use at least 12 characters.</small>}</label>
        <button className="primary-button full-button" disabled={busy}>{busy ? <><LoaderCircle size={17} className="spin" /> Please wait…</> : isRegister ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="switch-auth">{isRegister ? 'Already have an account?' : 'New to TRAXER?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></p>
    </section>
    <footer className="site-footer"><span>TRAXER</span><span>Private preview</span></footer>
  </main>;
}

function ProtectedRoute({ children }) {
  const { token, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!token || !user) return <Navigate to="/login" replace />;
  return children;
}

function ExpenseForm({ initial, onSave, onCancel, busy }) {
  const [description, setDescription] = useState(initial?.description || '');
  const [amount, setAmount] = useState(initial?.amount ?? '');
  const [category, setCategory] = useState(initial?.category || 'Food');
  const [date, setDate] = useState(initial?.date ? new Date(initial.date).toISOString().slice(0, 10) : today());
  return <form className="expense-form" onSubmit={e => { e.preventDefault(); onSave({ description: description.trim(), amount: Number(amount), category: category.trim(), date }); }}>
    <label>Title<input autoFocus required maxLength={120} placeholder="e.g. Weekly groceries" value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>Amount<input required type="number" min="0.01" max="100000000" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <label>Category<input required list="expense-categories" maxLength={40} value={category} onChange={e => setCategory(e.target.value)} /><datalist id="expense-categories">{['Food', 'Transport', 'Home', 'Health', 'Shopping', 'Bills', 'Entertainment', 'Other'].map(item => <option key={item} value={item} />)}</datalist></label>
    <label>Date<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
    <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add expense'}</button><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function Dashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    setPageMetadata('Dashboard | TRAXER', 'Review and manage your personal expenses in TRAXER.');
  }, []);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [categories, setCategories] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const activeFilterCount = [search.trim(), categoryFilter !== 'All categories', minAmount !== '', maxAmount !== '', Boolean(dateFrom), Boolean(dateTo)].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  function notify(message, type = 'success') {
    setToast(current => current?.message === message && current?.type === type
      ? current
      : { id: ++toastId.current, message, type });
  }

  const dismissToast = useCallback(id => {
    setToast(current => current?.id === id ? null : current);
  }, []);

  function clearFilters() {
    setSearch('');
    setCategoryFilter('All categories');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const min = minAmount === '' ? null : Number(minAmount);
      const max = maxAmount === '' ? null : Number(maxAmount);
      if ((min !== null && (!Number.isFinite(min) || min < 0 || min > 100000000)) || (max !== null && (!Number.isFinite(max) || max < 0 || max > 100000000))) {
        setError('Amounts must be numbers from 0 to 100,000,000.'); setLoading(false); return;
      }
      if (min !== null && max !== null && min > max) { setError('Minimum amount cannot exceed maximum amount.'); setLoading(false); return; }
      if (dateFrom && dateTo && dateFrom > dateTo) { setError('Start date cannot be after end date.'); setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const result = await expensesApi.list(token, {
          search: search.trim(), category: categoryFilter === 'All categories' ? '' : categoryFilter,
          minAmount, maxAmount, dateFrom, dateTo, sortBy, sortOrder
        }, controller.signal);
        if (!controller.signal.aborted) { setExpenses(result.expenses); setCategories(result.categories || []); }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) { logout(); navigate('/login', { replace: true }); return; }
        setError(err.message || 'Could not load your expenses.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, search.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [token, search, categoryFilter, minAmount, maxAmount, dateFrom, dateTo, sortBy, sortOrder, refreshKey, logout, navigate]);
  const totals = useMemo(() => {
    const now = new Date();
    const monthTotal = expenses.filter(item => { const date = new Date(item.date); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); }).reduce((sum, item) => sum + item.amount, 0);
    return { all: expenses.reduce((sum, item) => sum + item.amount, 0), month: monthTotal, count: expenses.length };
  }, [expenses]);
  const categoryDistribution = useMemo(() => aggregateExpensesByCategory(expenses), [expenses]);

  async function saveExpense(values) {
    const wasEditing = Boolean(editing);
    setBusy(true); setError('');
    try {
      if (editing) await expensesApi.update(token, editing._id, values);
      else await expensesApi.create(token, values);
      setEditing(null); setShowForm(false); setRefreshKey(value => value + 1);
      notify(wasEditing ? 'Expense updated successfully.' : 'Expense added successfully.');
    } catch (err) { notify(err.message || 'Unable to save expense. Please try again.', 'error'); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await expensesApi.remove(token, deleteTarget._id);
      setRefreshKey(value => value + 1);
      setDeleteTarget(null);
      notify('Expense deleted successfully.');
    } catch (err) {
      setDeleteError(err.message || 'Unable to delete expense. Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  }
  function startAdd() { setEditing(null); setShowForm(true); }
  function startEdit(expense) { setEditing(expense); setShowForm(true); }

  return <main className="page-shell dashboard-shell">
    <Brand note="Your private dashboard">
      <a className="mobile-nav-link" href="#overview">Overview</a>
      <a className="mobile-nav-link" href="#spending">Spending breakdown</a>
      <a className="mobile-nav-link" href="#expenses">Expense records</a>
    </Brand>
    <div className="dashboard-top"><div><p className="eyebrow">EXPENSE OVERVIEW</p><h1>Good to see you, {user.name?.trim() || 'there'}.</h1><p className="lede">A clear picture of where your money is going.</p></div><button className="quiet-button signout" onClick={() => { logout(); navigate('/login'); }}><LogOut size={16} /> Sign out</button></div>

    {error && <div className="notice error" role="alert">{error}<button className="notice-close" onClick={() => setError('')} aria-label="Dismiss">×</button></div>}
    <section id="overview" className="stat-grid" aria-label="Expense statistics">
      <article className="stat-card"><span className="stat-icon"><WalletCards size={18} /></span><span className="stat-label">This month</span><strong>{money.format(totals.month)}</strong><small><CalendarDays size={13} /> Current calendar month</small></article>
      <article className="stat-card"><span className="stat-icon"><ArrowUpRight size={18} /></span><span className="stat-label">Matching total</span><strong>{money.format(totals.all)}</strong><small><Activity size={13} /> Current filters applied</small></article>
      <article className="stat-card"><span className="stat-icon"><ArrowDownLeft size={18} /></span><span className="stat-label">Matches</span><strong>{totals.count}</strong><small>Expense records</small></article>
    </section>

    <section id="spending" className="analysis-card"><div className="section-heading"><div><p className="eyebrow">SPENDING BREAKDOWN</p><h2>By category</h2></div><span className="muted-label">Based on matching records</span></div>
      {categoryDistribution.items.length
        ? <ExpenseDistributionChart items={categoryDistribution.items} total={categoryDistribution.total} money={money} />
        : <p className="empty-inline">Add an expense to see your spending distribution.</p>}
    </section>

    <section id="expenses" className="expenses-section">
      <div className="section-heading list-heading"><div><p className="eyebrow">YOUR RECORDS</p><h2>Expenses</h2></div><button className="primary-button" onClick={startAdd}><CirclePlus size={17} /> Add expense</button></div>
      {showForm && <div className="form-card"><div className="section-heading"><h2>{editing ? 'Edit expense' : 'New expense'}</h2></div><ExpenseForm key={editing?._id || 'new'} initial={editing} onSave={saveExpense} onCancel={() => { setShowForm(false); setEditing(null); }} busy={busy} /></div>}
      <fieldset className="filter-group search-category-group">
        <legend>Search and category</legend>
        <div className="filter-row">
          <label className="search-box"><span className="search-label">Description</span><Search size={17} aria-hidden="true" /><input aria-label="Search expense descriptions" placeholder="Search descriptions" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label className="category-control"><span>Category</span><select aria-label="Filter by category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        </div>
      </fieldset>
      <div className="filter-groups">
        <fieldset className="filter-group">
          <legend>Amount range</legend>
          <div className="filter-group-controls">
            <label>Minimum<input aria-label="Minimum amount" type="number" min="0" max="100000000" step="0.01" placeholder="0" value={minAmount} onChange={e => setMinAmount(e.target.value)} /></label>
            <label>Maximum<input aria-label="Maximum amount" type="number" min="0" max="100000000" step="0.01" placeholder="No limit" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Date range</legend>
          <div className="filter-group-controls">
            <label>From<input aria-label="Start date" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
            <label>To<input aria-label="End date" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Sorting</legend>
          <div className="filter-group-controls">
            <label>Sort by<select aria-label="Sort field" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="date">Date</option><option value="amount">Amount</option></select></label>
            <label>Order<select aria-label="Sort order" value={sortOrder} onChange={e => setSortOrder(e.target.value)}><option value="desc">Newest / highest</option><option value="asc">Oldest / lowest</option></select></label>
          </div>
        </fieldset>
      </div>
      {hasActiveFilters && <div className="filter-status-row"><span aria-live="polite">{activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span><button type="button" className="quiet-button clear-filters" onClick={clearFilters}>Clear filters</button></div>}
      {loading ? <div className="loading-state compact"><LoaderCircle className="spin" size={20} />Loading expenses…</div> : expenses.length ? <div className="expense-list">{expenses.map(expense => <article className="expense-row" key={expense._id}>
        <div className="expense-symbol" aria-hidden="true"><WalletCards size={17} /></div>
        <div className="expense-main"><strong title={expense.description}>{expense.description}</strong><div className="expense-meta"><span className="category-badge" title={expense.category}>{expense.category}</span><time dateTime={new Date(expense.date).toISOString()}>{new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time></div></div>
        <strong className="expense-amount">{money.format(expense.amount)}</strong>
        <div className="row-actions"><button type="button" className="icon-button" onClick={() => startEdit(expense)} aria-label={`Edit ${expense.description}`} title="Edit expense"><Pencil size={17} /></button><button type="button" className="icon-button danger-icon" onClick={() => { setDeleteTarget(expense); setDeleteError(''); }} aria-label={`Delete ${expense.description}`} title="Delete expense"><Trash2 size={17} /></button></div>
      </article>)}</div> : <div className="empty-state"><div className="empty-mark"><WalletCards size={21} /></div><h3>{hasActiveFilters ? 'No matching expenses' : 'Nothing recorded yet'}</h3><p>{hasActiveFilters ? 'No expenses match your current filters.' : 'Add your first expense to start seeing your spending clearly.'}</p>{hasActiveFilters ? <button type="button" className="quiet-button" onClick={clearFilters}>Clear filters</button> : <button className="primary-button" onClick={startAdd}><CirclePlus size={17} /> Add an expense</button>}</div>}
    </section>
    <ToastNotice toast={toast} onDismiss={dismissToast} />
    {deleteTarget && <DeleteConfirmationDialog expense={deleteTarget} busy={deleteBusy} error={deleteError} onCancel={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteError(''); } }} onConfirm={confirmDelete} />}
    <footer className="site-footer"><span>TRAXER</span><span>{expenses.length} record{expenses.length === 1 ? '' : 's'} · Saved to your account</span></footer>
  </main>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}
