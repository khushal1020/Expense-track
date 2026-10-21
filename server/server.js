import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const port = Number(process.env.PORT) || 5000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const production = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', production ? 1 : false);
app.use(helmet());
app.use(cors({
  origin: clientUrl,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json({ limit: '10kb', strict: true }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 80, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true, strict: 'throw' });
const expenseSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 0.01, max: 100000000 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  date: { type: Date, required: true, default: Date.now }
}, { timestamps: true, strict: 'throw' });
const User = mongoose.model('User', userSchema);
const Expense = mongoose.model('Expense', expenseSchema);

function tokenFor(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '1h', issuer: 'expensetrack', audience: 'expensetrack-client' });
}
function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'expensetrack', audience: 'expensetrack-client' });
    req.auth = { userId: payload.sub };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
}
function requireAdmin(req, res, next) {
  User.findById(req.auth.userId).select('role').then(user => {
    if (!user || user.role !== 'admin') return res.status(403).json({ success: false, message: 'Administrator access required.' });
    return next();
  }).catch(next);
}
function validExpense(body) {
  const { description, amount, category, date } = body || {};
  return typeof description === 'string' && description.trim().length > 0 && description.trim().length <= 120 &&
    typeof category === 'string' && category.trim().length > 0 && category.trim().length <= 40 &&
    typeof amount === 'number' && Number.isFinite(amount) && amount >= 0.01 && amount <= 100000000 &&
    (date === undefined || (typeof date === 'string' && !Number.isNaN(Date.parse(date))));
}

function parseExpenseFilters(query) {
  const allowed = new Set(['search', 'category', 'minAmount', 'maxAmount', 'dateFrom', 'dateTo', 'sortBy', 'sortOrder']);
  if (Object.keys(query).some(key => !allowed.has(key))) return { error: 'Unsupported expense filter.' };
  if (Object.values(query).some(value => typeof value !== 'string')) return { error: 'Each expense filter must have one value.' };

  const filter = {};
  const search = (query.search || '').trim();
  if (search.length > 120) return { error: 'Search must be 120 characters or fewer.' };
  if (search) filter.description = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const category = (query.category || '').trim();
  if (category.length > 40) return { error: 'Category must be 40 characters or fewer.' };
  if (category) filter.category = category;

  const amount = {};
  for (const [key, operator] of [['minAmount', '$gte'], ['maxAmount', '$lte']]) {
    if (query[key] === undefined) continue;
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(query[key])) return { error: `${key} must be a valid non-negative amount.` };
    const value = Number(query[key]);
    if (!Number.isFinite(value) || value > 100000000) return { error: `${key} is outside the supported range.` };
    amount[operator] = value;
  }
  if (amount.$gte !== undefined && amount.$lte !== undefined && amount.$gte > amount.$lte) return { error: 'Minimum amount cannot exceed maximum amount.' };
  if (Object.keys(amount).length) filter.amount = amount;

  const dateValue = value => {
    if (value === undefined) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  };
  const from = dateValue(query.dateFrom);
  const to = dateValue(query.dateTo);
  if (from === null || to === null) return { error: 'Dates must use a valid YYYY-MM-DD value.' };
  if (from && to && from > to) return { error: 'Start date cannot be after end date.' };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) {
      const exclusiveEnd = new Date(to);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      filter.date.$lt = exclusiveEnd;
    }
  }

  const sortBy = query.sortBy || 'date';
  const sortOrder = query.sortOrder || 'desc';
  if (!['date', 'amount'].includes(sortBy)) return { error: 'Sort field must be date or amount.' };
  if (!['asc', 'desc'].includes(sortOrder)) return { error: 'Sort order must be asc or desc.' };
  const direction = sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortBy]: direction, _id: direction };
  return { filter, sort };
}

app.get('/api/health', (_req, res) => res.status(200).json({ success: true, message: 'ExpenseTrack API is running' }));

app.post('/api/auth/register', authLimit, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (Object.keys(req.body || {}).some(key => !['name', 'email', 'password'].includes(key)) || (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 80)) || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ success: false, message: 'Provide a valid email and a password of 12–72 characters.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const normalizedName = name?.trim().replace(/\s+/g, ' ') || '';
    const user = await User.create({ name: normalizedName, email: email.trim().toLowerCase(), passwordHash });
    return res.status(201).json({ success: true, token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
    return next(error);
  }
});
app.post('/api/auth/login', authLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (Object.keys(req.body || {}).some(key => !['email', 'password'].includes(key)) || typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    return res.json({ success: true, token: tokenFor(user), user: { id: user.id, name: user.name || '', email: user.email, role: user.role } });
  } catch (error) { return next(error); }
});

app.get('/api/auth/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select('name email role');
    if (!user) return res.status(401).json({ success: false, message: 'Account no longer exists.' });
    return res.json({ success: true, user: { id: user.id, name: user.name || '', email: user.email, role: user.role } });
  } catch (error) { return next(error); }
});

app.route('/api/expenses')
  .get(authenticate, async (req, res, next) => {
    try {
      const parsed = parseExpenseFilters(req.query);
      if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
      const owner = req.auth.userId;
      const [expenses, categories] = await Promise.all([
        Expense.find({ ...parsed.filter, owner }).sort(parsed.sort).limit(500).lean(),
        Expense.distinct('category', { owner })
      ]);
      return res.json({ success: true, expenses, categories: categories.sort((a, b) => a.localeCompare(b)) });
    }
    catch (error) { return next(error); }
  })
  .post(authenticate, async (req, res, next) => {
    try {
      if (!validExpense(req.body) || Object.keys(req.body).some(key => !['description', 'amount', 'category', 'date'].includes(key))) return res.status(400).json({ success: false, message: 'Invalid expense details.' });
      const expense = await Expense.create({ ...req.body, owner: req.auth.userId });
      return res.status(201).json({ success: true, expense });
    } catch (error) { return next(error); }
  });
app.route('/api/expenses/:id')
  .put(authenticate, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id) || !validExpense(req.body) || Object.keys(req.body).some(key => !['description', 'amount', 'category', 'date'].includes(key))) return res.status(400).json({ success: false, message: 'Invalid expense details.' });
      const expense = await Expense.findOneAndUpdate({ _id: req.params.id, owner: req.auth.userId }, req.body, { new: true, runValidators: true, strict: 'throw' });
      if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
      return res.json({ success: true, expense });
    } catch (error) { return next(error); }
  })
  .delete(authenticate, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid expense ID.' });
      const expense = await Expense.findOneAndDelete({ _id: req.params.id, owner: req.auth.userId });
      if (!expense) return res.status(404).json({ success: false, message: 'Expense not found.' });
      return res.status(204).end();
    } catch (error) { return next(error); }
  });

app.get('/api/admin/users', authenticate, requireAdmin, async (_req, res, next) => {
  try { const users = await User.find().select('email role createdAt').limit(500).lean(); return res.json({ success: true, users }); }
  catch (error) { return next(error); }
});

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ success: false, message: 'Invalid JSON request body.' });
  if (err?.name === 'ValidationError' || err?.name === 'StrictModeError') return res.status(400).json({ success: false, message: 'Invalid request data.' });
  console.error('Request failed:', err?.message || 'Unknown error');
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace_with|change_me|example/i.test(process.env.JWT_SECRET)) {
  console.error('Set MONGODB_URI and a unique JWT_SECRET of at least 32 characters in the server environment.');
  process.exit(1);
}
if (production && clientUrl.startsWith('http://')) {
  console.error('Production CLIENT_URL must use HTTPS.');
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI, { autoIndex: production ? false : true });
app.listen(port, () => console.log(`ExpenseTrack API listening on port ${port}`));
