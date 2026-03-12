import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initSDK, ModelCategory, getAccelerationMode } from './runanywhere';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { AudioPlayback } from '@runanywhere/web';
import { useModelLoader } from './hooks/useModelLoader';
import { SmartScanner } from './components/SmartScanner';
import { AIChatbotPage } from './components/AIChatbotPage';
import { SavingChallengesPage } from './components/SavingChallengesPage';

type Category = 'Food' | 'Transport' | 'Bills' | 'Shopping' | 'Entertainment' | 'Health';
type TransactionType = 'expense' | 'income';
type Page = 'dashboard' | 'ledger' | 'goals' | 'quest' | 'security' | 'settings' | 'scanner' | 'chatbot' | 'challenges';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: Category;
  timestamp: number;
  isRecurring?: boolean;
}

interface CategoryBudget {
  limit: number;
  spent: number;
}

type Budgets = Record<Category, CategoryBudget>;

interface AIInsight {
  forecast: string;
  whatIf: string;
  timestamp: number;
}

interface SmartTip {
  message: string;
  timestamp: number;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  timestamp: number;
  status: 'success' | 'info';
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  category: Category;
  targetAmount: number;
  currentAmount: number;
  startDate: number;
  endDate: number;
  status: 'active' | 'completed' | 'failed';
  reward?: string;
}

type Currency = 'INR' | 'USD' | 'EUR';

// Gamification Types
interface PlayerProfile {
  xp: number;
  level: number;
  streakDays: number;
  lastLogDate: string;
  totalLogged: number;
  badges: Badge[];
  dailyBudget: number;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  earnedAt: number;
}

interface MotivationalQuote {
  text: string;
  timestamp: number;
}

// Level thresholds
const XP_PER_LEVEL = 100;
const LEVELS = [
  { level: 1, title: 'Budget Rookie', minXP: 0 },
  { level: 2, title: 'Expense Tracker', minXP: 100 },
  { level: 3, title: 'Savings Scout', minXP: 300 },
  { level: 4, title: 'Money Manager', minXP: 600 },
  { level: 5, title: 'Finance Warrior', minXP: 1000 },
  { level: 6, title: 'Wealth Builder', minXP: 1500 },
  { level: 7, title: 'Master Saver', minXP: 2200 },
  { level: 8, title: 'Financial Ninja', minXP: 3000 },
  { level: 9, title: 'Money Master', minXP: 4000 },
  { level: 10, title: 'Wealth Legend', minXP: 5500 },
];

// Badges
const SPECIAL_BADGES: Record<string, { name: string; icon: string; requirement: number }> = {
  first_log: { name: 'First Step', icon: '🎯', requirement: 1 },
  streak_3: { name: 'On Fire', icon: '🔥', requirement: 3 },
  streak_7: { name: 'Master Saver', icon: '🏆', requirement: 7 },
  streak_14: { name: 'Unstoppable', icon: '⚡', requirement: 14 },
  level_5: { name: 'Finance Warrior', icon: '🛡️', requirement: 5 },
  level_10: { name: 'Wealth Legend', icon: '👑', requirement: 10 },
  emergency_fund: { name: 'Shield Charged', icon: '💪', requirement: 100 },
};

export function App() {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Navigation state
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [showWelcome, setShowWelcome] = useState(false);
  
  // Core state
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [accelerationMode, setAccelerationMode] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [budgets, setBudgets] = useState<Budgets>({
    Food: { limit: 500, spent: 0 },
    Transport: { limit: 300, spent: 0 },
    Bills: { limit: 1000, spent: 0 },
    Shopping: { limit: 400, spent: 0 },
    Entertainment: { limit: 200, spent: 0 },
    Health: { limit: 300, spent: 0 },
  });
  const [editingBudget, setEditingBudget] = useState<Category | null>(null);
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  
  // Advanced features
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [smartTip, setSmartTip] = useState<SmartTip | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [showPrivacyReport, setShowPrivacyReport] = useState(false);
  
  // Security
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  
  // AI Chat Consultant
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Receipt Scanner
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  
  // Voice Input
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  
  // Expense Splitting
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
  const [splitAmounts, setSplitAmounts] = useState<{ category: Category; amount: number }[]>([]);
  
  // Multi-Currency
  const [currency, setCurrency] = useState<Currency>('USD');
  const currencySymbols: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€' };
  const exchangeRates: Record<Currency, number> = { INR: 83, USD: 1, EUR: 0.92 };
  
  // Privacy Audit Log
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  
  // AI Challenges
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isGeneratingChallenge, setIsGeneratingChallenge] = useState(false);
  
  // Gamification
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>({
    xp: 0,
    level: 1,
    streakDays: 0,
    lastLogDate: '',
    totalLogged: 0,
    badges: [],
    dailyBudget: 100
  });
  const [motivationalQuote, setMotivationalQuote] = useState<MotivationalQuote | null>(null);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  
  // TTS State for Read Aloud
  const [selectedVoice, setSelectedVoice] = useState<'male' | 'female'>('female');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingText, setCurrentSpeakingText] = useState<string | null>(null);
  const [ttsLoader, setTtsLoader] = useState<any>(null);
  const audioPlayerRef = useRef<AudioPlayback | null>(null);
  
  // Model loader
  const loader = useModelLoader(ModelCategory.Language);
  const processingRef = useRef(false);
  const smartTipGeneratedRef = useRef(false);

  // Add to audit log
  const addAuditEntry = useCallback((action: string) => {
    const entry: AuditLogEntry = {
      id: Date.now().toString(),
      action,
      timestamp: Date.now(),
      status: 'success'
    };
    setAuditLog(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      localStorage.setItem('auditLog', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Check challenge progress
  const checkChallengeProgress = useCallback(() => {
    const activeChallenge = challenges.find(c => c.status === 'active');
    if (!activeChallenge) return;
    
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const spentOnCategory = transactions
      .filter(t => t.type === 'expense' && t.category === activeChallenge.category && t.timestamp > weekAgo)
      .reduce((s, t) => s + t.amount, 0);
    
    const updated = challenges.map(c => {
      if (c.id === activeChallenge.id) {
        const isComplete = spentOnCategory === 0;
        return {
          ...c,
          currentAmount: spentOnCategory,
          status: isComplete ? 'completed' as const : 
            Date.now() > c.endDate ? 'failed' as const : c.status
        };
      }
      return c;
    });
    
    setChallenges(updated);
  }, [challenges, transactions]);

  // Initialize SDK and check for first run
  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme as 'dark' | 'light');
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'light' : 'dark';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    let mounted = true;
    
    const initializeSDK = async () => {
      try {
        await initSDK();
        
        if (!mounted) return;
        
        setSdkReady(true);
        setAccelerationMode(getAccelerationMode());
        
        // Add audit entry for SDK initialization
        const entry: AuditLogEntry = {
          id: Date.now().toString(),
          action: 'SDK Initialized - Local AI Ready',
          timestamp: Date.now(),
          status: 'success'
        };
        setAuditLog(prev => {
          const updated = [entry, ...prev].slice(0, 50);
          localStorage.setItem('auditLog', JSON.stringify(updated));
          return updated;
        });
        
        // Check if first run
        const hasData = localStorage.getItem('transactions');
        if (!hasData) {
          setShowWelcome(true);
        }
        
      } catch (err) {
        if (!mounted) return;
        setSdkError(err instanceof Error ? err.message : String(err));
      }
    };

    initializeSDK();

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
      mounted = false;
    };
  }, []);

  // Load all data from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem;
    
    const loadData = () => {
      try {
        const t = localStorage.getItem('transactions');
        if (t) setTransactions(JSON.parse(t));
        
        const b = localStorage.getItem('budgets');
        if (b) setBudgets(JSON.parse(b));
        
        const i = localStorage.getItem('aiInsight');
        if (i) setAiInsight(JSON.parse(i));
        
        const s = localStorage.getItem('smartTip');
        if (s) setSmartTip(JSON.parse(s));
        
        const g = localStorage.getItem('savingsGoals');
        if (g) setSavingsGoals(JSON.parse(g));
        
        const c = localStorage.getItem('challenges');
        if (c) setChallenges(JSON.parse(c));
        
        const a = localStorage.getItem('auditLog');
        if (a) setAuditLog(JSON.parse(a));
        
        const prof = localStorage.getItem('playerProfile');
        if (prof) setPlayerProfile(JSON.parse(prof));
        
        const p = localStorage.getItem('pin');
        if (p) {
          setStoredPin(p);
          setIsLocked(true);
        }
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    };
    
    loadData();
  }, []);

  // Save data
  useEffect(() => {
    if (transactions.length > 0) localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);
  
  useEffect(() => {
    localStorage.setItem('budgets', JSON.stringify(budgets));
  }, [budgets]);
  
  useEffect(() => {
    if (aiInsight) localStorage.setItem('aiInsight', JSON.stringify(aiInsight));
  }, [aiInsight]);
  
  useEffect(() => {
    if (smartTip) localStorage.setItem('smartTip', JSON.stringify(smartTip));
  }, [smartTip]);
  
  useEffect(() => {
    localStorage.setItem('savingsGoals', JSON.stringify(savingsGoals));
  }, [savingsGoals]);
  
  useEffect(() => {
    localStorage.setItem('challenges', JSON.stringify(challenges));
  }, [challenges]);
  
  useEffect(() => {
    localStorage.setItem('playerProfile', JSON.stringify(playerProfile));
  }, [playerProfile]);
  
  useEffect(() => {
    localStorage.setItem('isLocked', String(isLocked));
  }, [isLocked]);

  // Detect recurring transactions (debounced)
  useEffect(() => {
    if (transactions.length === 0) return;
    
    const timeoutId = setTimeout(() => {
      const map = new Map<string, number>();
      transactions.forEach(t => {
        const key = `${t.description.toLowerCase().trim()}_${t.amount.toFixed(2)}`;
        map.set(key, (map.get(key) || 0) + 1);
      });
      
      const updated = transactions.map(t => {
        const key = `${t.description.toLowerCase().trim()}_${t.amount.toFixed(2)}`;
        return { ...t, isRecurring: (map.get(key) || 0) >= 2 };
      });
      
      const hasChanges = updated.some((t, i) => t.isRecurring !== transactions[i]?.isRecurring);
      if (hasChanges) setTransactions(updated);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [transactions.length]);

  // Generate smart tip
  useEffect(() => {
    if (smartTipGeneratedRef.current || transactions.length < 3) return;
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    if (smartTip && smartTip.timestamp > oneDayAgo) {
      smartTipGeneratedRef.current = true;
      return;
    }
    
    setTimeout(() => {
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
      
      const lastWeek: Partial<Record<Category, number>> = {};
      const prevWeek: Partial<Record<Category, number>> = {};
      
      transactions.filter(t => t.type === 'expense' && t.category).forEach(t => {
        if (t.timestamp > oneWeekAgo) lastWeek[t.category!] = (lastWeek[t.category!] || 0) + t.amount;
        else if (t.timestamp > twoWeeksAgo) prevWeek[t.category!] = (prevWeek[t.category!] || 0) + t.amount;
      });
      
      for (const cat of (Object.keys(lastWeek) as Category[])) {
        const curr = lastWeek[cat] || 0;
        const prev = prevWeek[cat] || 0;
        if (prev > 0 && curr > prev * 1.3) {
          setSmartTip({ message: `Your ${cat} spending increased by ${((curr - prev) / prev * 100).toFixed(0)}% this week!`, timestamp: now });
          smartTipGeneratedRef.current = true;
          return;
        }
      }
      
      setSmartTip({ message: 'Great job tracking! Keep logging for personalized insights.', timestamp: now });
      smartTipGeneratedRef.current = true;
    }, 2000);
  }, [transactions.length]);

  // Pre-load model on welcome completion
  const handleWelcomeComplete = async () => {
    setShowWelcome(false);
    if (loader.state !== 'ready') {
      await loader.ensure();
    }
  };

  // Financial metrics
  const financialMetrics = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = income - expenses;
    
    const byCategory: Partial<Record<Category, number>> = {};
    transactions.filter(t => t.type === 'expense' && t.category).forEach(t => {
      byCategory[t.category!] = (byCategory[t.category!] || 0) + t.amount;
    });
    
    const recurring = transactions.filter(t => t.isRecurring && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    
    return { income, expenses, net, byCategory, recurring };
  }, [transactions]);
  
  // Animated balance counter
  const [animatedNet, setAnimatedNet] = useState(financialMetrics.net);
  
  useEffect(() => {
    const target = financialMetrics.net;
    if (animatedNet === target) return;
    
    const animate = () => {
      setAnimatedNet(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        const step = diff * 0.15;
        return prev + step;
      });
    };
    
    const timer = setInterval(animate, 30);
    return () => clearInterval(timer);
  }, [financialMetrics.net, animatedNet]);

  // Generate AI Challenge
  const generateChallenge = useCallback(async () => {
    if (isGeneratingChallenge || challenges.some(c => c.status === 'active')) return;
    setIsGeneratingChallenge(true);
    
    try {
      if (loader.state !== 'ready') await loader.ensure();
      
      const topCategory = Object.entries(financialMetrics.byCategory)
        .sort(([,a], [,b]) => b - a)[0];
      
      const challengeNames: Record<Category, string> = {
        Food: 'The No-Coffee Week',
        Transport: 'The Transport Saver',
        Bills: 'The Bill Buster',
        Shopping: 'The Shopping Freeze',
        Entertainment: 'The Entertainment Detox',
        Health: 'The Health Spender'
      };
      
      const cat = (topCategory?.[0] as Category) || 'Food';
      const challenge: Challenge = {
        id: Date.now().toString(),
        name: challengeNames[cat],
        description: `Spend $0 on ${cat} this week`,
        category: cat,
        targetAmount: 0,
        currentAmount: 0,
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        status: 'active',
        reward: '🏆 3D Champion Badge'
      };
      
      setChallenges(prev => [...prev, challenge]);
      addAuditEntry('AI Challenge Generated');
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingChallenge(false);
    }
  }, [isGeneratingChallenge, challenges, financialMetrics.byCategory, loader, addAuditEntry]);

  // Currency conversion

  // AI categorization
  const categorizeWithAI = useCallback(async (desc: string): Promise<Category> => {
    try {
      if (loader.state !== 'ready') await loader.ensure();
      
      const prompt = `Classify this into ONLY one: [Food, Transport, Bills, Shopping, Entertainment, Health]. Reply ONLY the word.\nTransaction: ${desc}`;
      const { result } = await TextGeneration.generateStream(prompt, { maxTokens: 10, temperature: 0.3 });
      const cat = (await result).text.trim() as Category;
      
      const valid: Category[] = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health'];
      return valid.includes(cat) ? cat : 'Shopping';
    } catch { return 'Shopping'; }
  }, [loader]);
  
  // Gamification Helpers (must be before handleAddTransaction)
  const getLevelInfo = (xp: number) => {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= LEVELS[i].minXP) return LEVELS[i];
    }
    return LEVELS[0];
  };
  
  const getXPProgress = (xp: number) => {
    const currentLevel = getLevelInfo(xp);
    const nextLevel = LEVELS.find(l => l.minXP > currentLevel.minXP);
    if (!nextLevel) return 100;
    const progress = ((xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100;
    return Math.min(progress, 100);
  };
  
  const calculateEmergencyFundTarget = () => {
    const monthlyExpenses = financialMetrics.expenses || 0;
    return monthlyExpenses * 3;
  };
  
  const calculateEmergencyFundProgress = () => {
    const target = calculateEmergencyFundTarget();
    if (target === 0) return 0;
    const progress = (financialMetrics.net / target) * 100;
    return Math.min(progress, 100);
  };
  
  // Add XP and check for level ups / badges
  const addXP = useCallback((amount: number) => {
    setPlayerProfile(prev => {
      const newXP = prev.xp + amount;
      const newLevel = getLevelInfo(newXP).level;
      let newBadges = [...prev.badges];
      
      if (newLevel >= 5 && !newBadges.find(b => b.id === 'level_5')) {
        newBadges.push({ id: 'level_5', name: 'Finance Warrior', icon: '🛡️', earnedAt: Date.now() });
      }
      if (newLevel >= 10 && !newBadges.find(b => b.id === 'level_10')) {
        newBadges.push({ id: 'level_10', name: 'Wealth Legend', icon: '👑', earnedAt: Date.now() });
      }
      if (prev.totalLogged + 1 >= 1 && !newBadges.find(b => b.id === 'first_log')) {
        newBadges.push({ id: 'first_log', name: 'First Step', icon: '🎯', earnedAt: Date.now() });
      }
      if (prev.streakDays >= 3 && !newBadges.find(b => b.id === 'streak_3')) {
        newBadges.push({ id: 'streak_3', name: 'On Fire', icon: '🔥', earnedAt: Date.now() });
      }
      if (prev.streakDays >= 7 && !newBadges.find(b => b.id === 'streak_7')) {
        newBadges.push({ id: 'streak_7', name: 'Master Saver', icon: '🏆', earnedAt: Date.now() });
      }
      if (prev.streakDays >= 14 && !newBadges.find(b => b.id === 'streak_14')) {
        newBadges.push({ id: 'streak_14', name: 'Unstoppable', icon: '⚡', earnedAt: Date.now() });
      }
      
      return { ...prev, xp: newXP, level: newLevel, totalLogged: prev.totalLogged + 1 };
    });
  }, []);
  
  // Update streak
  const updateStreak = useCallback(() => {
    const today = new Date().toDateString();
    
    setPlayerProfile(prev => {
      if (prev.lastLogDate === today) return prev;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      
      let newStreak = 1;
      if (prev.lastLogDate === yesterdayStr) {
        newStreak = prev.streakDays + 1;
      }
      
      return { ...prev, streakDays: newStreak, lastLogDate: today };
    });
  }, []);

  // Generate AI motivational quote
  const generateMotivationalQuote = useCallback(async () => {
    if (isGeneratingQuote) return;
    setIsGeneratingQuote(true);
    
    try {
      if (loader.state !== 'ready') await loader.ensure();
      
      const levelInfo = getLevelInfo(playerProfile.xp);
      const nextLevel = LEVELS.find(l => l.level === levelInfo.level + 1);
      const xpNeeded = nextLevel ? nextLevel.minXP - playerProfile.xp : 0;
      const emergencyProgress = calculateEmergencyFundProgress();
      
      const prompt = `Generate a short, punchy motivational financial message for a user. Current level: ${levelInfo.level} (${levelInfo.title}). XP: ${playerProfile.xp}. ${xpNeeded > 0 ? `They need ${xpNeeded} more XP to reach level ${levelInfo.level + 1}.` : 'They maxed out!'}. Emergency fund: ${emergencyProgress.toFixed(0)}% complete. Streak: ${playerProfile.streakDays} days. Keep it under 15 words. Add 1 emoji at the end.`;
      
      const { result } = await TextGeneration.generateStream(prompt, { maxTokens: 50, temperature: 0.8 });
      const quote = (await result).text.trim();
      
      setMotivationalQuote({ text: quote, timestamp: Date.now() });
      addAuditEntry('AI Motivation Generated');
    } catch (e) {
      console.error('Failed to generate quote:', e);
    } finally {
      setIsGeneratingQuote(false);
    }
  }, [isGeneratingQuote, playerProfile, loader, addAuditEntry]);

  // TTS Read Aloud Function
  const speakText = useCallback(async (text: string) => {
    if (isSpeaking && currentSpeakingText === text) {
      // Stop if already speaking this text
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
        audioPlayerRef.current.dispose();
        audioPlayerRef.current = null;
      }
      setIsSpeaking(false);
      setCurrentSpeakingText(null);
      return;
    }

    // Stop any current playback
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current.dispose();
      audioPlayerRef.current = null;
    }

    setIsSpeaking(true);
    setCurrentSpeakingText(text);

    try {
      // Dynamically import to avoid loading TTS until needed
      const { AudioPlayback: TTSPlayback, VoicePipeline } = await import('@runanywhere/web');
      
      // Create a simple TTS using VoicePipeline
      const pipeline = new VoicePipeline();
      
      // For now, we'll use a workaround since direct TTS requires model loading
      // Use Web Speech API as fallback for immediate response
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = selectedVoice === 'female' ? 1.1 : 0.9;
        
        // Try to find a good voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => {
          if (selectedVoice === 'female') {
            return v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Microsoft Zira');
          }
          return v.name.includes('Male') || v.name.includes('Daniel') || v.name.includes('Microsoft David');
        });
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        utterance.onend = () => {
          setIsSpeaking(false);
          setCurrentSpeakingText(null);
        };
        
        utterance.onerror = () => {
          setIsSpeaking(false);
          setCurrentSpeakingText(null);
        };
        
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('TTS Error:', err);
      setIsSpeaking(false);
      setCurrentSpeakingText(null);
    }
  }, [isSpeaking, currentSpeakingText, selectedVoice]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current.dispose();
      audioPlayerRef.current = null;
    }
    setIsSpeaking(false);
    setCurrentSpeakingText(null);
  }, []);

  // Add transaction
  const handleAddTransaction = useCallback(async () => {
    if (!description.trim() || !amount || isProcessing) return;
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    const desc = description.trim();
    setDescription(''); setAmount('');
    
    if (transactionType === 'income') {
      const currencySymbol = currencySymbols[currency];
      const formattedAmount = `${currencySymbol}${(val * exchangeRates[currency]).toFixed(2)}`;
      setTransactions(prev => [{ id: Date.now().toString(), description: desc, amount: val, type: 'income', timestamp: Date.now() }, ...prev]);
      addAuditEntry(`Income recorded: ${desc} - ${formattedAmount}`);
      addXP(15); // Bonus XP for income
      updateStreak();
      return;
    }
    
    setIsProcessing(true);
    const cat = await categorizeWithAI(desc);
    const currencySymbol = currencySymbols[currency];
    const formattedAmount = `${currencySymbol}${(val * exchangeRates[currency]).toFixed(2)}`;
    setTransactions(prev => [{ id: Date.now().toString(), description: desc, amount: val, type: 'expense', category: cat, timestamp: Date.now() }, ...prev]);
    addAuditEntry(`Expense categorized: ${desc} → ${cat} - ${formattedAmount}`);
    addXP(10); // XP for logging expense
    updateStreak();
    setIsProcessing(false);
  }, [description, amount, transactionType, isProcessing, categorizeWithAI, addAuditEntry, addXP, updateStreak, currency, currencySymbols, exchangeRates]);

  // AI Insights
  const generateAIInsights = useCallback(async () => {
    if (isGeneratingInsight || processingRef.current) return;
    processingRef.current = true;
    setIsGeneratingInsight(true);
    
    try {
      if (loader.state !== 'ready') await loader.ensure();
      await new Promise(r => setTimeout(r, 50));
      
      const summary = transactions.slice(0, 10).map(t => `${t.type}: ${t.description} $${t.amount}`).join(', ');
      const catSummary = Object.entries(financialMetrics.byCategory).map(([c, a]) => `${c}: $${a.toFixed(2)}`).join(', ');
      
      const prompt = `Based on: ${summary}. Spending: ${catSummary}. Income: $${financialMetrics.income}, Expenses: $${financialMetrics.expenses}. Predict next month and give one What-If (e.g., "Cut dining 20% = save $X"). Under 80 words.`;
      
      const { result } = await TextGeneration.generateStream(prompt, { maxTokens: 120, temperature: 0.7 });
      const text = (await result).text.trim();
      const lines = text.split('\n').filter(l => l.trim());
      
      setAiInsight({ forecast: lines[0] || text, whatIf: lines[1] || 'Track more for better predictions.', timestamp: Date.now() });
    } catch (e) { console.error(e); }
    finally { processingRef.current = false; setIsGeneratingInsight(false); }
  }, [isGeneratingInsight, transactions, financialMetrics, loader]);

  // Voice Input (STT)
  const startVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser. Try Chrome.');
      return;
    }
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setIsListening(true);
    setVoiceStatus('👂 Listening...');
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceStatus('👁️ Processing...');
      
      // Parse voice: "Spent 500 on groceries" or "Coffee 5 dollars"
      const match = transcript.match(/(\d+(?:\.\d+)?)/);
      const amountMatch = match ? parseFloat(match[1]) : 0;
      
      if (amountMatch > 0) {
        setDescription(transcript.replace(/\d+(?:\.\d+)?/g, '').replace(/spent|paid|bought|for|on/gi, '').trim() || 'Voice expense');
        setAmount(amountMatch.toString());
        setTransactionType('expense');
        setVoiceStatus('✅ Ready! Click Add to save');
        
        // Auto-categorize
        setTimeout(async () => {
          const cat = await categorizeWithAI(description || transcript);
          setTransactions(prev => [{
            id: Date.now().toString(),
            description: transcript.replace(/\d+(?:\.\d+)?/g, '').replace(/spent|paid|bought|for|on/gi, '').trim() || 'Voice expense',
            amount: amountMatch,
            type: 'expense',
            category: cat,
            timestamp: Date.now()
          }, ...prev]);
          setVoiceStatus('');
          setIsListening(false);
        }, 500);
      } else {
        setVoiceStatus('❌ Could not understand. Try again.');
        setTimeout(() => { setVoiceStatus(''); setIsListening(false); }, 2000);
      }
    };
    
    recognition.onerror = () => {
      setVoiceStatus('❌ Error. Try again.');
      setTimeout(() => { setVoiceStatus(''); setIsListening(false); }, 2000);
    };
    
    recognition.start();
  }, [categorizeWithAI, description]);

  // Receipt Scanner (VLM)
  const handleReceiptUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setReceiptPreview(dataUrl);
      setIsScanningReceipt(true);
      
      try {
        // Use VLM to analyze the receipt
        if (loader.state !== 'ready') await loader.ensure();
        
        // For now, simulate extraction - in production would use VLM
        setTimeout(() => {
          // Extract mock data - in real app, this would use VLM.analyzeImage()
          setDescription('Receipt Scan - ' + file.name.replace(/\.[^/.]+$/, ''));
          setAmount('');
          setIsScanningReceipt(false);
          setShowReceiptScanner(false);
          alert('Receipt uploaded! Please enter the amount and confirm.');
        }, 2000);
        
      } catch (err) {
        console.error('Receipt scan failed:', err);
        setIsScanningReceipt(false);
        alert('Failed to scan receipt. Please enter manually.');
      }
    };
    reader.readAsDataURL(file);
  }, [loader]);

  // Expense Splitting
  const startSplit = useCallback((t: Transaction) => {
    setSplittingTransaction(t);
    setSplitAmounts([{ category: t.category || 'Food', amount: t.amount }]);
  }, []);

  const confirmSplit = useCallback(() => {
    if (!splittingTransaction) return;
    
    const remaining = splitAmounts.reduce((s, a) => s - a.amount, splittingTransaction.amount);
    if (remaining !== 0) {
      alert(`Split amounts must equal ${splittingTransaction.amount}. Remaining: ${remaining}`);
      return;
    }
    
    // Remove original and add splits
    setTransactions(prev => prev.filter(t => t.id !== splittingTransaction.id));
    
    splitAmounts.forEach(sa => {
      if (sa.amount > 0) {
        setTransactions(prev => [{
          ...splittingTransaction,
          id: Date.now().toString() + Math.random(),
          description: splittingTransaction.description + ` (${sa.category})`,
          amount: sa.amount,
          category: sa.category,
          isRecurring: false
        }, ...prev]);
      }
    });
    
    setSplittingTransaction(null);
    setSplitAmounts([]);
  }, [splittingTransaction, splitAmounts]);

  // Goals
  const addGoal = useCallback(() => {
    const name = prompt('Goal name (e.g., "New Laptop"):');
    if (!name) return;
    const target = parseFloat(prompt('Target amount:') || '0');
    if (isNaN(target) || target <= 0) return;
    
    setSavingsGoals(prev => [...prev, {
      id: Date.now().toString(),
      name,
      targetAmount: target,
      currentAmount: 0,
      createdAt: Date.now()
    }]);
  }, []);

  const updateGoalProgress = useCallback((goalId: string, amount: number) => {
    setSavingsGoals(prev => prev.map(g => g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g));
  }, []);

  // AI Chat Consultant
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      if (loader.state !== 'ready') await loader.ensure();
      
      const history = chatMessages.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n');
      const summary = transactions.slice(0, 20).map(t => `${t.type}: ${t.description} $${t.amount}${t.category ? ` (${t.category})` : ''}`).join(', ');
      
      const prompt = `You are a financial advisor. User's data: ${summary}. Total: $${financialMetrics.net} net. Conversation:\n${history}\nUser: ${userMsg.text}\nGive helpful, brief advice.`;
      
      const { result } = await TextGeneration.generateStream(prompt, { maxTokens: 150, temperature: 0.7 });
      const response = (await result).text.trim();
      
      setChatMessages(prev => [...prev, { id: Date.now().toString() + '1', role: 'assistant', text: response, timestamp: Date.now() }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { id: Date.now().toString() + '1', role: 'assistant', text: 'Sorry, I encountered an error. Try again.', timestamp: Date.now() }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, chatMessages, transactions, financialMetrics, loader]);

  // Delete transaction
  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  // Update budget
  const updateBudget = useCallback((cat: Category, limit: number) => {
    setBudgets(prev => ({ ...prev, [cat]: { ...prev[cat], limit } }));
    setEditingBudget(null);
  }, []);

  // PIN handlers
  const handleSetPin = () => {
    if (pin.length === 4 && /^\d{4}$/.test(pin)) {
      setStoredPin(pin);
      localStorage.setItem('pin', pin);
      setIsSettingPin(false);
      setPin('');
      alert('PIN set!');
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const search = searchQuery.toLowerCase();
      const cat = filterCategory;
      const rec = showRecurringOnly;
      return t.description.toLowerCase().includes(search) && (cat === 'all' || t.category === cat) && (!rec || t.isRecurring);
    });
  }, [transactions, searchQuery, filterCategory, showRecurringOnly]);

  // Helpers
  const getCatColor = (c?: Category) => ({ Food: '#22C55E', Transport: '#3B82F6', Bills: '#EF4444', Shopping: '#A855F7', Entertainment: '#F59E0B', Health: '#EC4899' }[c || 'Shopping'] || '#94A3B8');
  const getCatEmoji = (c?: Category) => ({ Food: '🍔', Transport: '🚗', Bills: '📄', Shopping: '🛍️', Entertainment: '🎬', Health: '⚕️' }[c || 'Shopping'] || '💰');
  const getBarColor = (spent: number, limit: number) => (spent / limit) >= 0.8 ? '#EF4444' : '#22C55E';
  
  // Currency formatting
  const formatCurrency = (amount: number) => {
    const symbol = currencySymbols[currency];
    const converted = amount * exchangeRates[currency];
    return `${symbol}${converted.toFixed(2)}`;
  };
  
  // Auto-detect currency from input
  const detectCurrency = (text: string): number | null => {
    const usdMatch = text.match(/\$(\d+(?:\.\d+)?)/);
    if (usdMatch) return parseFloat(usdMatch[1]) / exchangeRates.USD;
    
    const inrMatch = text.match(/₹(\d+(?:\.\d+)?)/);
    if (inrMatch) return parseFloat(inrMatch[1]) / exchangeRates.INR;
    
    const eurMatch = text.match(/€(\d+(?:\.\d+)?)/);
    if (eurMatch) return parseFloat(eurMatch[1]) / exchangeRates.EUR;
    
    return null;
  };
  
  // ==================== EXPORT FUNCTIONS (Client-Side Only) ====================
  
  // CSV Export
  const exportToCSV = useCallback(() => {
    if (transactions.length === 0) {
      alert('No transactions to export!');
      return;
    }
    
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = transactions.map(t => [
      new Date(t.timestamp).toLocaleDateString(),
      `"${t.description.replace(/"/g, '""')}"`,
      t.category || 'N/A',
      t.type,
      t.amount.toFixed(2)
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `privacyfinance_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addAuditEntry('CSV Export Generated');
  }, [transactions, addAuditEntry]);
  
  // PNG Export for Spending Chart
  const exportChartToPNG = useCallback(() => {
    // Create a canvas with the spending data visualized
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      alert('Could not create chart');
      return;
    }
    
    // Background
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, 600, 400);
    
    // Title
    ctx.fillStyle = '#F1F5F9';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Spending Distribution', 20, 40);
    
    // Date
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px Arial';
    ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 20, 65);
    
    // Draw pie chart
    const total = Object.values(financialMetrics.byCategory).reduce((a, b) => a + b, 0);
    if (total === 0) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '16px Arial';
      ctx.fillText('No spending data to display', 180, 200);
    } else {
      const colors = ['#22C55E', '#3B82F6', '#EF4444', '#A855F7', '#F59E0B', '#EC4899'];
      const categoryNames = Object.keys(financialMetrics.byCategory);
      let startAngle = 0;
      
      categoryNames.forEach((cat, i) => {
        const value = financialMetrics.byCategory[cat as Category] || 0;
        const sliceAngle = (value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(300, 200);
        ctx.arc(300, 200, 100, startAngle, startAngle + sliceAngle);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        
        startAngle += sliceAngle;
      });
      
      // Legend
      let legendY = 330;
      categoryNames.forEach((cat, i) => {
        const value = financialMetrics.byCategory[cat as Category] || 0;
        const pct = ((value / total) * 100).toFixed(1);
        
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(50, legendY - 10, 15, 15);
        
        ctx.fillStyle = '#F1F5F9';
        ctx.font = '12px Arial';
        ctx.fillText(`${cat}: $${value.toFixed(2)} (${pct}%)`, 75, legendY);
        
        legendY += 25;
      });
    }
    
    // Download
    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `spending_chart_${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        URL.revokeObjectURL(url);
        addAuditEntry('PNG Chart Export Generated');
      }
    });
  }, [financialMetrics, addAuditEntry]);
  
  // PDF Monthly Summary Report (Vanilla JS - Client Side Only)
  const exportPDFReport = useCallback(() => {
    if (transactions.length === 0) {
      alert('No transactions to generate report!');
      return;
    }
    
    // Create a simple text-based PDF using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 595; // A4 width in points
    canvas.height = 842; // A4 height in points
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      alert('Could not create report');
      return;
    }
    
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 595, 842);
    
    let y = 50;
    
    // Header
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('PrivacyFinance', 50, y);
    y += 15;
    
    ctx.fillStyle = '#64748B';
    ctx.font = '14px Arial';
    ctx.fillText('Monthly Financial Summary Report', 50, y);
    y += 10;
    ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, 50, y);
    y += 40;
    
    // Divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(545, y);
    ctx.stroke();
    y += 30;
    
    // Summary Stats
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Financial Summary', 50, y);
    y += 30;
    
    ctx.font = '14px Arial';
    const summaryData = [
      { label: 'Total Income:', value: formatCurrency(financialMetrics.income), color: '#22C55E' },
      { label: 'Total Expenses:', value: formatCurrency(financialMetrics.expenses), color: '#EF4444' },
      { label: 'Net Balance:', value: formatCurrency(financialMetrics.net), color: financialMetrics.net >= 0 ? '#22C55E' : '#EF4444' },
      { label: 'Monthly Subscriptions:', value: formatCurrency(financialMetrics.recurring), color: '#F59E0B' },
    ];
    
    summaryData.forEach(item => {
      ctx.fillStyle = '#64748B';
      ctx.fillText(item.label, 70, y);
      ctx.fillStyle = item.color;
      ctx.font = 'bold 14px Arial';
      ctx.fillText(item.value, 250, y);
      ctx.font = '14px Arial';
      y += 25;
    });
    
    y += 20;
    
    // Top Spending Category
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Top Spending Category', 50, y);
    y += 30;
    
    const topCategory = Object.entries(financialMetrics.byCategory)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory) {
      ctx.font = '14px Arial';
      ctx.fillStyle = '#64748B';
      ctx.fillText('Category:', 70, y);
      ctx.fillStyle = '#1E293B';
      ctx.fillText(topCategory[0], 180, y);
      y += 25;
      ctx.fillStyle = '#64748B';
      ctx.fillText('Amount:', 70, y);
      ctx.fillStyle = '#EF4444';
      ctx.fillText(formatCurrency(topCategory[1]), 180, y);
    }
    y += 40;
    
    // Divider
    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(545, y);
    ctx.stroke();
    y += 30;
    
    // Recent Transactions
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Recent Transactions', 50, y);
    y += 25;
    
    ctx.font = '10px Arial';
    const recentTx = transactions.slice(0, 15);
    
    recentTx.forEach(t => {
      if (y > 800) return; // Stop if near bottom
      
      const date = new Date(t.timestamp).toLocaleDateString();
      ctx.fillStyle = '#64748B';
      ctx.fillText(date, 70, y);
      
      ctx.fillStyle = '#1E293B';
      const desc = t.description.length > 25 ? t.description.substring(0, 25) + '...' : t.description;
      ctx.fillText(desc, 150, y);
      
      ctx.fillStyle = t.type === 'income' ? '#22C55E' : '#EF4444';
      const prefix = t.type === 'income' ? '+' : '-';
      ctx.fillText(prefix + formatCurrency(t.amount), 400, y);
      
      if (t.category) {
        ctx.fillStyle = '#8B5CF6';
        ctx.fillText(t.category, 480, y);
      }
      
      y += 18;
    });
    
    y += 30;
    
    // Footer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px Arial';
    ctx.fillText('Generated locally by PrivacyFinance - No data sent to servers', 50, y);
    y += 15;
    ctx.fillText(`Total Transactions: ${transactions.length} | Privacy Score: 100%`, 50, y);
    
    // Download
    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `monthly_report_${new Date().toISOString().split('T')[0]}.png`;
        link.click();
        URL.revokeObjectURL(url);
        addAuditEntry('PDF Report Generated');
      }
    });
  }, [transactions, financialMetrics, formatCurrency, addAuditEntry]);
  
  // Welcome Screen
  if (showWelcome) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '48px',
          textAlign: 'center',
          maxWidth: '420px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔐</div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px', background: 'linear-gradient(135deg, #22C55E, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Welcome to PrivacyFinance
          </h1>
          <p style={{ color: '#94A3B8', marginBottom: '32px', lineHeight: '1.6' }}>
            Your data stays 100% on-device. No cloud. No tracking. Just you and your AI advisor.
          </p>
          
          <button
            onClick={handleWelcomeComplete}
            className="btn btn-primary btn-lg"
            style={{
              width: '100%',
              padding: '16px 32px',
              fontSize: '16px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
          >
            🚀 Initialize Private AI
          </button>
          
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: '24px' }}>
            Downloads ~250MB model to your device • One-time setup
          </p>
        </div>
      </div>
    );
  }

  // Lock Screen
  if (isLocked) {
    return (
      <div className="app" style={{ 
      background: 'var(--gradient-bg)',
      minHeight: '100vh'
    }}>
        <header className="app-header"><h1>PrivacyFinance</h1><span className="badge">🔒</span></header>
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '40px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>🔐</div>
            <h2 style={{ marginBottom: '8px' }}>Dashboard Locked</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Enter PIN to unlock</p>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyPress={e => e.key === 'Enter' && (pinInput === storedPin ? (setIsLocked(false), setPinInput('')) : (alert('Wrong PIN'), setPinInput('')))}
              placeholder="••••"
              style={{
                width: '100%', padding: '14px', fontSize: '28px', letterSpacing: '12px', textAlign: 'center',
                background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', outline: 'none', marginBottom: '16px'
              }}
            />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => pinInput === storedPin ? (setIsLocked(false), setPinInput('')) : (alert('Wrong PIN'), setPinInput(''))}>
              Unlock
            </button>
          </div>
        </main>
      </div>
    );
  }

  // PIN Setup
  if (isSettingPin) {
    return (
      <div className="app" style={{ 
      background: 'var(--gradient-bg)',
      minHeight: '100vh'
    }}>
        <header className="app-header"><h1>PrivacyFinance</h1><span className="badge">Set PIN</span></header>
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '40px', textAlign: 'center', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>🔐</div>
            <h2 style={{ marginBottom: '8px' }}>Set Your PIN</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>4-digit PIN to protect data</p>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyPress={e => e.key === 'Enter' && handleSetPin()}
              placeholder="••••"
              style={{
                width: '100%', padding: '14px', fontSize: '28px', letterSpacing: '12px', textAlign: 'center',
                background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', outline: 'none', marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setIsSettingPin(false); setPin(''); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSetPin}>Set PIN</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main App
  return (
    <div className="app" style={{ 
      background: 'var(--gradient-bg)',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <header className="app-header" style={{ 
        background: 'var(--bg-card)', 
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: '700' }}>🔐 PrivacyFinance</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Currency Selector */}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--bg-input)',
              color: 'var(--text)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <option value="USD">$ USD</option>
            <option value="INR">₹ INR</option>
            <option value="EUR">€ EUR</option>
          </select>
          {accelerationMode && (
            <span style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              fontSize: '11px', padding: '4px 10px', borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', border: '1px solid #22C55E'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', animation: 'pulse 2s infinite' }} />
              WebGPU
            </span>
          )}
          
          {/* Privacy Score Widget */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(16, 185, 129, 0.3))',
            color: '#22C55E', border: '1px solid #22C55E', fontWeight: '600'
          }}>
            🛡️ 100%
          </span>

          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={() => {
              const newTheme = theme === 'dark' ? 'light' : 'dark';
              setTheme(newTheme);
              localStorage.setItem('theme', newTheme);
              document.documentElement.setAttribute('data-theme', newTheme);
            }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div className="theme-toggle-thumb">
              {theme === 'dark' ? '🌙' : '☀️'}
            </div>
          </button>
          
          {(isProcessing || isGeneratingInsight) && (
            <span className="badge" style={{ animation: 'pulse 1s infinite' }}>✨ AI</span>
          )}
          {!sdkReady && (
            <span style={{
              fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', border: '1px solid #F59E0B'
            }}>
              🔄 Syncing...
            </span>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ 
        display: 'flex', gap: '4px', padding: '10px 12px', 
        background: 'var(--bg-card)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)', 
        overflowX: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
      }}>
        {[
          { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
          { id: 'ledger', icon: '📝', label: 'Ledger' },
          { id: 'goals', icon: '🎯', label: 'Goals' },
          { id: 'quest', icon: '⚔️', label: 'Quest' },
          { id: 'scanner', icon: '📷', label: 'Scanner' },
          { id: 'chatbot', icon: '💬', label: 'Chat' },
          { id: 'challenges', icon: '🏅', label: 'Challenges' },
          { id: 'security', icon: '🛡️', label: 'Security' },
          { id: 'settings', icon: '⚙️', label: 'Settings' }
        ].map(page => (
          <button
            key={page.id}
            onClick={() => setCurrentPage(page.id as Page)}
            style={{
              flex: 1, minWidth: 'fit-content', padding: '10px 12px',
              border: 'none', borderRadius: 'var(--radius-sm)',
              background: currentPage === page.id 
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.8), rgba(99, 102, 241, 0.8))' 
                : 'rgba(30, 41, 59, 0.5)',
              backdropFilter: 'blur(8px)',
              color: currentPage === page.id ? 'white' : 'var(--text-muted)',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer',
              transition: 'all 0.3s ease', whiteSpace: 'nowrap',
              boxShadow: currentPage === page.id ? '0 0 15px rgba(139, 92, 246, 0.4)' : 'none'
            }}
          >
            <span style={{ marginRight: '4px', fontSize: '12px' }}>{page.icon}</span>
            {page.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={{ 
        flex: 1, overflowY: 'auto', padding: '16px', 
        scrollbarWidth: 'thin', scrollbarColor: 'var(--border) var(--bg)'
      }}>
        {/* Premium Glassmorphism CSS */}
        <style>{`
          main::-webkit-scrollbar { width: 5px; }
          main::-webkit-scrollbar-track { background: var(--bg-card); }
          main::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
          main::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
          
          @keyframes neonPulse {
            0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.5); }
            50% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.8); }
          }
          
          @keyframes countUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .glass-card {
            background: var(--bg-card);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--border);
          }
          
          .neon-border {
            border: 1px solid var(--border);
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.1);
          }
        `}</style>

        {/* DASHBOARD */}
        {currentPage === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Smart Tip */}
            {smartTip && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3))',
                backdropFilter: 'blur(10px)', borderRadius: 'var(--radius)', padding: '14px 18px',
                border: '2px solid rgba(139, 92, 246, 0.5)', display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>💡</span>
                <span style={{ flex: 1, fontSize: '13px', lineHeight: '1.5' }}><strong>Smart Tip:</strong> {smartTip.message}</span>
              </div>
            )}

            {/* Financial Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Income', value: financialMetrics.income, color: '#22C55E' },
                { label: 'Expenses', value: financialMetrics.expenses, color: '#EF4444' },
                { label: 'Net Balance', value: animatedNet, color: animatedNet >= 0 ? '#22C55E' : '#EF4444', isAnimated: true }
              ].map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
                  borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center', 
                  border: item.isAnimated ? '2px solid' : '1px solid var(--border)',
                  borderColor: item.isAnimated ? (item.color + '60') : 'var(--border)',
                  boxShadow: item.isAnimated ? `0 0 20px ${item.color}30` : 'none'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: item.color }}>
                    {formatCurrency(Math.abs(item.value))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recurring Total */}
            {financialMetrics.recurring > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.15)', borderRadius: 'var(--radius)', padding: '14px 18px',
                border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monthly Subscriptions</div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#F59E0B' }}>{formatCurrency(financialMetrics.recurring)}</div>
                </div>
                <button className="btn btn-sm" onClick={() => setShowRecurringOnly(!showRecurringOnly)}>
                  {showRecurringOnly ? 'Show All' : 'View'}
                </button>
              </div>
            )}

            {/* AI Coach */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '2px solid var(--primary)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: '600' }}>🤖 AI Financial Coach</h3>
                <button className="btn btn-primary btn-sm" onClick={generateAIInsights} disabled={isGeneratingInsight}>
                  {isGeneratingInsight ? 'Analyzing...' : 'Refresh'}
                </button>
              </div>
              
              {isGeneratingInsight ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  Analyzing patterns privately...
                </div>
              ) : aiInsight ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Voice Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Voice:</span>
                    <button
                      onClick={() => setSelectedVoice('female')}
                      style={{
                        padding: '3px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        background: selectedVoice === 'female' ? '#EC4899' : 'rgba(100, 116, 139, 0.3)',
                        color: 'white'
                      }}
                    >
                      👩 F
                    </button>
                    <button
                      onClick={() => setSelectedVoice('male')}
                      style={{
                        padding: '3px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        background: selectedVoice === 'male' ? '#3B82F6' : 'rgba(100, 116, 139, 0.3)',
                        color: 'white'
                      }}
                    >
                      👨 M
                    </button>
                    <div style={{ flex: 1 }} />
                    {isSpeaking ? (
                      <button
                        onClick={stopSpeaking}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          background: '#EF4444',
                          color: 'white'
                        }}
                      >
                        ⏹ Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => speakText(`Forecast: ${aiInsight.forecast}. What if: ${aiInsight.whatIf}`)}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          background: '#22C55E',
                          color: 'white'
                        }}
                      >
                        🔊 Read
                      </button>
                    )}
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px', borderLeft: '3px solid #3B82F6' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>📊 FORECAST</div>
                    <div style={{ fontSize: '13px', lineHeight: '1.5' }}>{aiInsight.forecast}</div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px', borderLeft: '3px solid #22C55E' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>💡 WHAT-IF</div>
                    <div style={{ fontSize: '13px', lineHeight: '1.5' }}>{aiInsight.whatIf}</div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Click "Refresh" for AI predictions
                </div>
              )}
            </div>

            {/* Budget Bars */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>Budget Tracker</h3>
              {Object.entries(budgets).map(([cat, data]) => {
                const spent = financialMetrics.byCategory[cat as Category] || 0;
                const pct = (spent / data.limit) * 100;
                return (
                  <div key={cat} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                      <span>{getCatEmoji(cat as Category)} {cat}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(spent)} / {editingBudget === cat ? (
                          <input type="number" value={data.limit} autoFocus
                            onChange={e => updateBudget(cat as Category, parseFloat(e.target.value) || 0)}
                            onBlur={() => setEditingBudget(null)}
                            style={{ width: '50px', padding: '2px', fontSize: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)' }}
                          />
                        ) : (
                          <span onClick={() => setEditingBudget(cat as Category)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{formatCurrency(data.limit)}</span>
                        )}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: getBarColor(spent, data.limit), transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Add */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>Quick Add</h3>
              
              {/* Voice & Camera buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  onClick={startVoiceInput}
                  disabled={isListening}
                  style={{ flex: 1, padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: isListening ? 'var(--primary)' : 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  {isListening ? '👂 Listening...' : '🎤 Voice'}
                </button>
                <button
                  onClick={() => setShowReceiptScanner(true)}
                  style={{ flex: 1, padding: '12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', cursor: 'pointer' }}
                >
                  📷 Receipt
                </button>
              </div>
              
              {voiceStatus && <div style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '12px', fontSize: '13px' }}>{voiceStatus}</div>}
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" placeholder={`Description (e.g., Coffee ${currencySymbols.USD}5)`} value={description} onChange={e => {
                  setDescription(e.target.value);
                  // Auto-detect currency from description
                  const detected = detectCurrency(e.target.value);
                  if (detected && !amount) {
                    setAmount(detected.toString());
                  }
                }}
                  onKeyPress={e => e.key === 'Enter' && handleAddTransaction()}
                  style={{ flex: 2, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', outline: 'none' }} />
                <input type="number" placeholder={currencySymbols.USD + '0.00'} value={amount} onChange={e => setAmount(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', outline: 'none' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => setTransactionType('expense')} disabled={isProcessing}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)', background: transactionType === 'expense' ? 'var(--primary)' : 'transparent', color: transactionType === 'expense' ? 'white' : 'var(--text-muted)', fontWeight: '600', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
                  Expense
                </button>
                <button onClick={() => setTransactionType('income')} disabled={isProcessing}
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)', background: transactionType === 'income' ? '#22C55E' : 'transparent', color: transactionType === 'income' ? 'white' : 'var(--text-muted)', fontWeight: '600', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}>
                  Income
                </button>
                <button onClick={handleAddTransaction} disabled={isProcessing || !description || !amount} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                  {isProcessing ? '...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEDGER */}
        {currentPage === 'ledger' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Quick Export Button */}
            <button 
              onClick={exportToCSV}
              style={{
                padding: '8px 12px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid #22C55E',
                borderRadius: 'var(--radius-sm)',
                color: '#22C55E',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              📄 Export CSV
            </button>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', outline: 'none' }} />
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as Category | 'all')}
                style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '14px', cursor: 'pointer' }}>
                <option value="all">All</option>
                {(['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health'] as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No transactions</div>
              ) : (
                filteredTransactions.map(t => (
                  <div key={t.id} onClick={() => startSplit(t)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ fontSize: '24px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: `${getCatColor(t.category)}25` }}>
                      {getCatEmoji(t.category)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>{t.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                        {t.category && <span style={{ background: getCatColor(t.category), padding: '1px 6px', borderRadius: '4px', color: 'white', fontSize: '10px' }}>{t.category}</span>}
                        <span style={{ background: t.type === 'income' ? '#22C55E' : 'var(--primary)', padding: '1px 6px', borderRadius: '4px', color: 'white', fontSize: '10px' }}>{t.type}</span>
                        {t.isRecurring && <span style={{ background: '#F59E0B', padding: '1px 6px', borderRadius: '4px', color: 'white', fontSize: '10px' }}>🔁</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: t.type === 'income' ? '#22C55E' : '#EF4444' }}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteTransaction(t.id); }} className="btn btn-sm">✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* GOALS */}
        {currentPage === 'goals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button onClick={addGoal} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>+ Add Goal</button>
            
            {savingsGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                <div>No savings goals yet</div>
                <div style={{ fontSize: '13px', marginTop: '8px' }}>Set a target to track your progress</div>
              </div>
            ) : (
              savingsGoals.map(goal => {
                const monthlySavings = Math.max(0, financialMetrics.net);
                const monthsLeft = monthlySavings > 0 ? Math.ceil((goal.targetAmount - goal.currentAmount) / monthlySavings) : Infinity;
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                
                return (
                  <div key={goal.id} style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{goal.name}</h3>
                      <button onClick={() => setSavingsGoals(prev => prev.filter(g => g.id !== goal.id))} className="btn btn-sm">✕</button>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#22C55E' }}>{formatCurrency(goal.currentAmount)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(goal.targetAmount)}</span>
                    </div>
                    
                    <div style={{ width: '100%', height: '12px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: progress >= 100 ? '#22C55E' : 'linear-gradient(90deg, #22C55E, #3B82F6)', transition: 'width 0.5s' }} />
                    </div>
                    
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {progress >= 100 ? '🎉 Goal reached!' : monthsLeft === Infinity ? 'Add income to see progress' : `~${monthsLeft} months at current rate`}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {[50, 100, 200].map(amt => (
                        <button key={amt} onClick={() => updateGoalProgress(goal.id, amt)} className="btn btn-sm" style={{ flex: 1 }}>
                          +{currencySymbols[currency]}{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* QUEST - Gamified Financial Health */}
        {currentPage === 'quest' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Player Profile Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.3))',
              borderRadius: 'var(--radius)', padding: '20px', border: '2px solid #8B5CF6',
              textAlign: 'center'
            }}>
              {/* Level Badge */}
              <div style={{
                display: 'inline-block', padding: '8px 20px', borderRadius: '999px',
                background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', marginBottom: '12px',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.5)'
              }}>
                <span style={{ fontSize: '24px', marginRight: '8px' }}>⚔️</span>
                <span style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>Level {playerProfile.level}</span>
              </div>
              
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px', color: '#A78BFA' }}>
                {getLevelInfo(playerProfile.xp).title}
              </h2>
              
              {/* XP Progress Bar */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: '#A78BFA' }}>{playerProfile.xp} XP</span>
                  <span style={{ color: 'var(--text-muted)' }}>{getLevelInfo(playerProfile.xp + XP_PER_LEVEL).minXP} XP</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--bg-input)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${getXPProgress(playerProfile.xp)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
                    transition: 'width 0.5s ease',
                    boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)'
                  }} />
                </div>
              </div>
              
              {/* Streak & Stats */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
                <div>
                  <div style={{ fontSize: '24px' }}>🔥</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: playerProfile.streakDays >= 3 ? '#F59E0B' : 'var(--text)' }}>
                    {playerProfile.streakDays}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day Streak</div>
                </div>
                <div>
                  <div style={{ fontSize: '24px' }}>📝</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#22C55E' }}>
                    {playerProfile.totalLogged}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Transactions</div>
                </div>
                <div>
                  <div style={{ fontSize: '24px' }}>🏆</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#F59E0B' }}>
                    {playerProfile.badges.length}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Badges</div>
                </div>
              </div>
            </div>

            {/* Emergency Fund Boss Shield */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🛡️ Emergency Fund Boss
              </h3>
              
              {calculateEmergencyFundProgress() < 30 ? (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444',
                  borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <span style={{ color: '#EF4444', fontSize: '13px', fontWeight: '600' }}>Shield Critical! Build your emergency fund!</span>
                </div>
              ) : null}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '48px' }}>
                  {calculateEmergencyFundProgress() >= 100 ? '🛡️' : calculateEmergencyFundProgress() >= 50 ? '🛡️' : '🛡️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                    <span style={{ color: '#22C55E' }}>{formatCurrency(Math.max(0, financialMetrics.net))}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(calculateEmergencyFundTarget())}</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'var(--bg-input)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${calculateEmergencyFundProgress()}%`,
                      height: '100%',
                      background: calculateEmergencyFundProgress() >= 100 ? '#22C55E' : 
                        calculateEmergencyFundProgress() >= 50 ? '#F59E0B' : '#EF4444',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                    {calculateEmergencyFundProgress() >= 100 ? '✅ Fully Charged!' : `${calculateEmergencyFundProgress().toFixed(0)}% Charged`}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Motivational Coach */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid #8B5CF6'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#A78BFA' }}>🤖 AI Financial Coach</h3>
                <button
                  onClick={generateMotivationalQuote}
                  disabled={isGeneratingQuote}
                  className="btn btn-sm"
                  style={{ background: '#8B5CF6', border: 'none', color: 'white' }}
                >
                  {isGeneratingQuote ? 'Thinking...' : 'Get Tips'}
                </button>
              </div>
              
              {motivationalQuote ? (
                <div style={{
                  background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                  padding: '16px', borderLeft: '3px solid #8B5CF6',
                  fontSize: '14px', lineHeight: '1.6'
                }}>
                  {/* Voice Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Voice:</span>
                    <button
                      onClick={() => setSelectedVoice('female')}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        background: selectedVoice === 'female' ? '#EC4899' : 'rgba(100, 116, 139, 0.3)',
                        color: 'white',
                        transition: 'all 0.2s'
                      }}
                    >
                      👩 Female
                    </button>
                    <button
                      onClick={() => setSelectedVoice('male')}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        background: selectedVoice === 'male' ? '#3B82F6' : 'rgba(100, 116, 139, 0.3)',
                        color: 'white',
                        transition: 'all 0.2s'
                      }}
                    >
                      👨 Male
                    </button>
                    <div style={{ flex: 1 }} />
                    {currentSpeakingText === motivationalQuote.text && isSpeaking ? (
                      <button
                        onClick={stopSpeaking}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          background: '#EF4444',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ⏹ Stop
                      </button>
                    ) : (
                      <button
                        onClick={() => speakText(motivationalQuote.text)}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          background: '#22C55E',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🔊 Read Aloud
                      </button>
                    )}
                  </div>
                  <span style={currentSpeakingText === motivationalQuote.text ? { background: 'rgba(139, 92, 246, 0.3)', padding: '2px 4px', borderRadius: '4px' } : {}}>
                    "{motivationalQuote.text}"
                  </span>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Click "Get Tips" for AI-powered motivation!
                </div>
              )}
            </div>

            {/* Badges Collection */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>🏆 Badge Collection</h3>
              
              {playerProfile.badges.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No badges yet. Log transactions to earn badges!
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {playerProfile.badges.map(badge => (
                    <div key={badge.id} style={{
                      padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px'
                    }}>
                      <span style={{ fontSize: '16px' }}>{badge.icon}</span>
                      <span>{badge.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECURITY - Privacy Audit Log */}
        {currentPage === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(59, 130, 246, 0.2))',
              borderRadius: 'var(--radius)', padding: '20px', border: '2px solid #22C55E',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🛡️</div>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#22C55E', marginBottom: '4px' }}>
                Privacy Audit Log
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Every AI action processed locally • 0% Cloud Leak
              </p>
            </div>

            {/* Challenge Section */}
            <div style={{ 
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>🎯 AI Savings Challenges</h3>
              
              {!challenges.some(c => c.status === 'active') && (
                <button 
                  onClick={generateChallenge}
                  disabled={isGeneratingChallenge}
                  className="btn btn-primary" 
                  style={{ width: '100%', marginBottom: '12px' }}
                >
                  {isGeneratingChallenge ? 'Generating...' : '✨ Generate New Challenge'}
                </button>
              )}
              
              {challenges.filter(c => c.status === 'active').map(challenge => {
                const daysLeft = Math.ceil((challenge.endDate - Date.now()) / (1000 * 60 * 60 * 24));
                const success = challenge.currentAmount === 0;
                
                return (
                  <div key={challenge.id} style={{
                    background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600' }}>{challenge.name}</span>
                      <span style={{ fontSize: '12px', color: daysLeft <= 0 ? '#EF4444' : 'var(--text-muted)' }}>
                        {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {challenge.description}
                    </div>
                    <div style={{ 
                      width: '100%', height: '8px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px'
                    }}>
                      <div style={{ 
                        width: success ? '100%' : `${Math.min((challenge.currentAmount / (financialMetrics.byCategory[challenge.category] || 1)) * 100, 100)}%`,
                        height: '100%', 
                        background: success ? '#22C55E' : '#F59E0B',
                        transition: 'width 0.5s'
                      }} />
                    </div>
                    {challenge.status === 'completed' && (
                      <div style={{ 
                        textAlign: 'center', padding: '12px', background: 'rgba(34, 197, 94, 0.2)', 
                        borderRadius: 'var(--radius-sm)', fontSize: '16px' 
                      }}>
                        🎉 {challenge.reward}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {challenges.filter(c => c.status !== 'active').length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Completed Challenges</h4>
                  {challenges.filter(c => c.status !== 'active').slice(-3).map(c => (
                    <div key={c.id} style={{ 
                      display: 'flex', justifyContent: 'space-between', padding: '8px', 
                      background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '4px', fontSize: '12px'
                    }}>
                      <span>{c.name}</span>
                      <span style={{ color: c.status === 'completed' ? '#22C55E' : '#EF4444' }}>
                        {c.status === 'completed' ? '✅ Won' : '❌ Lost'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Heatmap */}
            <div style={{ 
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>📊 Spending Heatmap</h3>
              
              {/* Simple heatmap - last 28 days */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {Array.from({ length: 28 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (27 - i));
                  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                  
                  const dayTotal = transactions
                    .filter(t => t.type === 'expense' && t.timestamp >= dayStart && t.timestamp < dayEnd)
                    .reduce((s, t) => s + t.amount, 0);
                  
                  const maxSpend = Math.max(...Object.values(financialMetrics.byCategory), 1);
                  const intensity = Math.min(dayTotal / (maxSpend / 4), 1);
                  
                  const colors = ['#1E293B', '#14532D', '#166534', '#15803D', '#22C55E'];
                  const colorIndex = Math.floor(intensity * 4);
                  
                  return (
                    <div 
                      key={i}
                      title={`${date.toLocaleDateString()}: $${dayTotal.toFixed(0)}`}
                      style={{
                        aspectRatio: '1',
                        background: colors[colorIndex],
                        borderRadius: '3px',
                        fontSize: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: intensity > 0.5 ? 'white' : 'transparent'
                      }}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>Less</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {['#1E293B', '#14532D', '#166534', '#15803D', '#22C55E'].map((c: string, i: number) => (
                    <div key={i} style={{ width: '12px', height: '12px', background: c, borderRadius: '2px' }} />
                  ))}
                </div>
                <span>More</span>
              </div>
            </div>

            {/* Audit Log */}
            <div style={{ 
              background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>📜 Activity Log</h3>
              
              {auditLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No activity yet. Add transactions to see the log.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {auditLog.map(entry => (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px',
                      background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)'
                    }}>
                      <span style={{ color: '#22C55E', fontSize: '14px' }}>✅</span>
                      <span style={{ flex: 1, fontSize: '13px' }}>{entry.action}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Processed by Local GPU (0% Cloud Leak)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCANNER - Smart Scanner Page */}
        {currentPage === 'scanner' && (
          <SmartScanner />
        )}

        {/* CHATBOT - AI Chatbot Page */}
        {currentPage === 'chatbot' && (
          <AIChatbotPage />
        )}

        {/* CHALLENGES - Saving Challenges Page */}
        {currentPage === 'challenges' && (
          <SavingChallengesPage />
        )}

        {/* SETTINGS */}
        {currentPage === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Privacy Report */}
            <div onClick={() => setShowPrivacyReport(true)}
              style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid #22C55E', cursor: 'pointer' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🛡️</div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Privacy Report</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tap to see your data privacy stats</p>
            </div>
            
            {/* Export & Backup Section */}
            <div style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid #8B5CF6' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#A78BFA' }}>📤 Export & Backup</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* CSV Export */}
                <button 
                  onClick={exportToCSV}
                  className="btn"
                  style={{ 
                    width: '100%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                    border: 'none',
                    padding: '12px'
                  }}
                >
                  <span>📄</span>
                  <span>Export to CSV</span>
                </button>
                
                {/* PNG Chart Export */}
                <button 
                  onClick={exportChartToPNG}
                  className="btn"
                  style={{ 
                    width: '100%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                    border: 'none',
                    padding: '12px'
                  }}
                >
                  <span>📊</span>
                  <span>Save Chart as PNG</span>
                </button>
                
                {/* PDF Report */}
                <button 
                  onClick={exportPDFReport}
                  className="btn"
                  style={{ 
                    width: '100%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                    border: 'none',
                    padding: '12px'
                  }}
                >
                  <span>📑</span>
                  <span>Monthly Summary PDF</span>
                </button>
              </div>
              
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
                🔒 All exports generated locally - No data leaves your device
              </p>
            </div>
            
            {/* Security */}
            <div style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>🔐 Security</h3>
              <button onClick={() => storedPin ? setIsLocked(!isLocked) : setIsSettingPin(true)} className="btn" style={{ width: '100%' }}>
                {storedPin ? (isLocked ? 'Unlock Dashboard' : 'Lock Dashboard') : 'Set PIN Lock'}
              </button>
            </div>
            
            {/* Stats */}
            <div style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(10px)', borderRadius: 'var(--radius)', padding: '20px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>📊 Statistics</h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '2' }}>
                <div>Total Transactions: {transactions.length}</div>
                <div>Categories Used: {Object.keys(financialMetrics.byCategory).length}</div>
                <div>Recurring Items: {transactions.filter(t => t.isRecurring).length}</div>
                <div>Goals Active: {savingsGoals.length}</div>
              </div>
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>
              🔒 All data processed locally • {accelerationMode || 'CPU'} Mode • LFM2-350M Model
            </div>
          </div>
        )}
      </main>

      {/* AI Chat Consultant - Floating Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', width: '60px', height: '60px',
          borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #E64500)',
          border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255, 85, 0, 0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        💬
      </button>

      {/* AI Chat Window */}
      {showChat && (
        <div style={{
          position: 'fixed', bottom: '100px', right: '24px', width: '360px', height: '480px',
          background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(20px)',
          borderRadius: '16px', border: '1px solid var(--border)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600' }}>🤖 AI Consultant</h3>
            <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '40px' }}>
                Ask me about your finances!<br /><br />
                "How much did I spend on Food?"<br />
                "Give me a savings plan"
              </div>
            ) : (
              chatMessages.map(m => (
                <div key={m.id} style={{
                  padding: '12px', borderRadius: '12px', maxWidth: '85%',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-input)',
                  fontSize: '13px', lineHeight: '1.5'
                }}>
                  {m.text}
                </div>
              ))
            )}
            {isChatLoading && <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '12px', fontSize: '13px' }}>Thinking...</div>}
          </div>
          
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
              placeholder="Ask about your finances..."
              style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px', outline: 'none' }} />
            <button onClick={sendChatMessage} disabled={isChatLoading} className="btn btn-primary btn-sm">Send</button>
          </div>
        </div>
      )}

      {/* Receipt Scanner Modal */}
      {showReceiptScanner && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '400px', width: '100%', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>📷 Scan Receipt</h3>
            
            {isScanningReceipt ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <div>👁️ Scanning receipt locally...</div>
              </div>
            ) : receiptPreview ? (
              <div style={{ textAlign: 'center' }}>
                <img src={receiptPreview} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '16px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Receipt scanned! Enter amount below.</p>
              </div>
            ) : (
              <label style={{ display: 'block', padding: '40px', border: '2px dashed var(--border)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={handleReceiptUpload} style={{ display: 'none' }} />
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                <div>Click to upload receipt</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Processed 100% on-device</div>
              </label>
            )}
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setShowReceiptScanner(false); setReceiptPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setShowReceiptScanner(false); setReceiptPreview(null); setTransactionType('expense'); }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Split Modal */}
      {splittingTransaction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '24px', maxWidth: '400px', width: '100%', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Split Expense</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              "{splittingTransaction.description}" - ${splittingTransaction.amount.toFixed(2)}
            </p>
            
            {splitAmounts.map((sa, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <select value={sa.category} onChange={e => { const arr = [...splitAmounts]; arr[i].category = e.target.value as Category; setSplitAmounts(arr); }}
                  style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px' }}>
                  {(['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health'] as Category[]).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" value={sa.amount} onChange={e => { const arr = [...splitAmounts]; arr[i].amount = parseFloat(e.target.value) || 0; setSplitAmounts(arr); }}
                  style={{ width: '100px', padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '13px' }} />
                <button onClick={() => setSplitAmounts(prev => prev.filter((_, j) => j !== i))} className="btn btn-sm">✕</button>
              </div>
            ))}
            
            <button onClick={() => setSplitAmounts(prev => [...prev, { category: 'Food', amount: 0 }])} className="btn btn-sm" style={{ marginBottom: '16px' }}>+ Add Split</button>
            
            <div style={{ fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
              Remaining: ${(splittingTransaction.amount - splitAmounts.reduce((s, a) => s + a.amount, 0)).toFixed(2)}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setSplittingTransaction(null); setSplitAmounts([]); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmSplit}>Confirm Split</button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Report Modal */}
      {showPrivacyReport && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '32px', maxWidth: '360px', width: '100%', border: '1px solid #22C55E', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', color: '#22C55E' }}>Privacy Score: 100%</h2>
            
            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '20px', margin: '20px 0' }}>
              {[
                { icon: '📝', label: 'Transactions Analyzed', value: transactions.length },
                { icon: '☁️', label: 'Data Sent to Cloud', value: '0 KB' },
                { icon: '🤖', label: 'AI Processing', value: 'On-Device' },
                { icon: '🔒', label: 'Encryption', value: 'LocalStorage' }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.icon} {item.label}</span>
                  <span style={{ fontWeight: '600' }}>{item.value}</span>
                </div>
              ))}
            </div>
            
            <button className="btn btn-primary" onClick={() => setShowPrivacyReport(false)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
