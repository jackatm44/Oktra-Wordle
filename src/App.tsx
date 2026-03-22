/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where,
  orderBy, 
  limit, 
  onSnapshot,
  increment,
  runTransaction
} from 'firebase/firestore';
import { format, isAfter, isBefore, startOfDay, differenceInDays } from 'date-fns';
import { Trophy, LogOut, Info, ChevronRight, Keyboard as KeyboardIcon, CheckCircle2, XCircle, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db } from './firebase';
import { WORDS_APRIL, TEST_WORD, SCORING, APRIL_START, APRIL_END } from './constants';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const getUsernameFromEmail = (email: string) => {
  return email.split('@')[0];
};

const getDayOfApril = (date: Date) => {
  const start = startOfDay(APRIL_START);
  const current = startOfDay(date);
  return differenceInDays(current, start) + 1;
};

const isTodayUnlocked = (date: Date) => {
  const now = date;
  const unlockTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0);
  return isAfter(now, unlockTime);
};

// --- Components ---

const GlitchSequence = ({ onComplete }: { onComplete: () => void }) => {
  const [display, setDisplay] = useState('');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  useEffect(() => {
    let active = true;
    
    const animateWord = async (word: string, holdTime: number) => {
      if (!active) return;
      
      // Glitch phase
      const stepsPerLetter = 3; 
      const totalSteps = word.length * stepsPerLetter;
      
      for (let step = 0; step <= totalSteps; step++) {
        if (!active) return;
        const iteration = step / stepsPerLetter;
        
        setDisplay(
          word.split('').map((_, index) => {
            if (index < iteration) return word[index];
            return chars[Math.floor(Math.random() * chars.length)];
          }).join('')
        );
        await new Promise(r => setTimeout(r, 60));
      }
      
      setDisplay(word);
      await new Promise(r => setTimeout(r, holdTime));
    };

    const run = async () => {
      // Sequence: OKTRA -> WORDLE
      await new Promise(r => setTimeout(r, 300));
      
      await animateWord('OKTRA', 1500);
      await animateWord('WORDLE', 2000);
      
      if (active) onComplete();
    };

    run();
    return () => { active = false; };
  }, [onComplete]);

  return (
    <motion.h1 
      className="text-7xl md:text-[10vw] font-bold tracking-[-0.05em] leading-none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {display}
    </motion.h1>
  );
};

const Intro = ({ onEnter }: { onEnter: () => void }) => {
  const [phase, setPhase] = useState<'glitch' | 'reveal'>('glitch');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [bgChars, setBgChars] = useState('');

  const handleGlitchComplete = useCallback(() => {
    setPhase('reveal');
  }, []);

  useEffect(() => {
    if (phase !== 'reveal') return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'reveal') return;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    const interval = setInterval(() => {
      let result = '';
      for (let i = 0; i < 5000; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      setBgChars(result);
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Interactive Reveal Layer - Only active in reveal phase */}
      {phase === 'reveal' && (
        <>
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.05] select-none break-all font-mono text-[10px] leading-none p-4">
            {bgChars}
          </div>
          
          <motion.div 
            className="fixed inset-0 pointer-events-none z-10"
            animate={{
              background: `radial-gradient(circle 150px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, white 100%)`
            }}
            transition={{ type: 'spring', damping: 30, stiffness: 200, mass: 0.5 }}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        {phase === 'glitch' ? (
          <motion.div
            key="glitch"
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="z-20"
          >
            <GlitchSequence onComplete={handleGlitchComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center w-full max-w-4xl px-6 z-20"
          >
            <motion.div 
              className="relative w-48 h-48 mb-16 rounded-none overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] bg-white flex items-center justify-center"
              layoutId="intro-image"
            >
              <img 
                src="https://files.catbox.moe/pfq7ul.png" 
                alt="Wordle" 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                referrerPolicy="no-referrer"
              />
              <motion.div 
                className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <button
                onClick={onEnter}
                className="group relative px-8 py-3.5 bg-zinc-900 text-white rounded-full text-sm font-medium tracking-wide transition-all hover:bg-black hover:scale-[1.02] active:scale-[0.98] shadow-sm"
              >
                <span className="relative z-10 flex items-center gap-2.5">
                  Begin Challenge
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WordleGrid = ({ guesses, currentGuess, solution, isGameOver }: { 
  guesses: string[], 
  currentGuess: string, 
  solution: string,
  isGameOver: boolean 
}) => {
  const rows = Array(6).fill(null);
  
  return (
    <div className="grid grid-rows-6 gap-3 mb-12">
      {rows.map((_, i) => {
        const guess = guesses[i];
        const isCurrent = i === guesses.length && !isGameOver;
        
        return (
          <div key={i} className="grid grid-cols-5 gap-3">
            {Array(5).fill(null).map((_, j) => {
              let char = '';
              let status: 'empty' | 'active' | 'correct' | 'present' | 'absent' = 'empty';
              
              if (guess) {
                char = guess[j];
                if (solution[j] === char) status = 'correct';
                else if (solution.includes(char)) status = 'present';
                else status = 'absent';
              } else if (isCurrent) {
                char = currentGuess[j] || '';
                status = char ? 'active' : 'empty';
              }
              
              return (
                <motion.div
                  key={j}
                  initial={false}
                  animate={status !== 'empty' ? { 
                    scale: [1, 1.02, 1],
                    transition: { duration: 0.1 }
                  } : {}}
                  className={cn(
                    "w-14 h-14 md:w-16 md:h-16 flex items-center justify-center text-2xl font-medium transition-all duration-700 rounded-xl border",
                    status === 'empty' && "border-zinc-200 bg-white",
                    status === 'active' && "border-zinc-400 text-black shadow-sm",
                    status === 'correct' && "bg-black border-black text-white",
                    status === 'present' && "bg-zinc-200 border-zinc-200 text-black",
                    status === 'absent' && "bg-zinc-100 border-zinc-100 text-zinc-400"
                  )}
                >
                  {char}
                </motion.div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const Keyboard = ({ onKey, guesses, solution }: { 
  onKey: (key: string) => void,
  guesses: string[],
  solution: string
}) => {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
  ];

  const getKeyStatus = (key: string): 'default' | 'correct' | 'present' | 'absent' => {
    if (key === 'ENTER' || key === 'BACKSPACE') return 'default';
    
    let status: 'default' | 'correct' | 'present' | 'absent' = 'default';
    
    guesses.forEach(guess => {
      for (let i = 0; i < guess.length; i++) {
        if (guess[i] === key) {
          if (solution[i] === key) status = 'correct';
          else if (solution.includes(key) && status !== 'correct') status = 'present';
          else if (status === 'default') status = 'absent';
        }
      }
    });
    
    return status;
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-2">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5 mb-2">
          {row.map(key => {
            const status = getKeyStatus(key);
            return (
              <button
                key={key}
                onClick={() => onKey(key)}
                className={cn(
                  "h-12 md:h-14 px-2 md:px-4 rounded-xl font-medium text-xs transition-all hover:bg-zinc-200 active:scale-95",
                  key.length > 1 ? "px-4 md:px-6" : "min-w-[36px] md:min-w-[48px]",
                  status === 'default' && "bg-zinc-100 text-zinc-800",
                  status === 'correct' && "bg-black text-white",
                  status === 'present' && "bg-zinc-300 text-black",
                  status === 'absent' && "bg-zinc-100 text-zinc-300"
                )}
              >
                {key === 'BACKSPACE' ? '←' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const Leaderboard = ({ users }: { users: any[] }) => {
  return (
    <div className="w-full">
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-xl font-medium tracking-tight">Leaderboard</h3>
        <Trophy className="w-4 h-4 text-zinc-300" />
      </div>
      <div className="space-y-1">
        {users.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-sm italic">No scores yet.</div>
        ) : (
          users.map((user, i) => (
            <motion.div 
              key={user.id} 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex items-center justify-between py-3 px-4 rounded-xl hover:bg-zinc-100 transition-all cursor-default"
            >
              <div className="flex items-center gap-4">
                <span className={cn(
                  "w-5 text-xs font-mono text-zinc-400",
                  i < 3 && "text-zinc-900 font-bold"
                )}>
                  {(i + 1).toString().padStart(2, '0')}
                </span>
                <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-900 transition-colors">{user.username}</span>
              </div>
              <span className="text-sm font-bold text-zinc-900">{user.totalScore}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

const AuthForm = ({ onAuthSuccess }: { onAuthSuccess: (user: { email: string; username: string }) => void }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const domain = '@oktra.co.uk';
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail.endsWith(domain)) {
      setError('Please use your Oktra work email');
      setLoading(false);
      return;
    }

    try {
      const username = getUsernameFromEmail(trimmedEmail);
      const userRef = doc(db, 'users', trimmedEmail);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const userData = {
          email: trimmedEmail,
          username,
          totalScore: 0,
          dailyScores: {}
        };
        await setDoc(userRef, userData);
        
        await setDoc(doc(db, 'leaderboard', trimmedEmail), {
          username,
          totalScore: 0
        });
      }

      const user = { email: trimmedEmail, username };
      localStorage.setItem('wordle_user', JSON.stringify(user));
      onAuthSuccess(user);
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm p-10 bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-zinc-100 flex flex-col items-center text-center">
      <h2 className="text-3xl font-medium mb-2 tracking-tight">Welcome</h2>
      <p className="text-zinc-400 text-sm mb-10">Enter your email to start playing</p>
      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <div className="relative w-full">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
          <input
            type="email"
            placeholder="Work Email (@oktra.co.uk)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-none rounded-2xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all placeholder:text-zinc-300"
            required
          />
        </div>
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-black text-white font-medium rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
        </button>
      </form>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [dailyScore, setDailyScore] = useState<any>(null);
  const [isEventEnded, setIsEventEnded] = useState(false);
  const [isEventNotStarted, setIsEventNotStarted] = useState(false);
  const [forceUnlock, setForceUnlock] = useState(false);

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const isTestingMode = isBefore(now, APRIL_START);
  const dayOfApril = getDayOfApril(now);
  const solution = isTestingMode ? TEST_WORD.toUpperCase() : (WORDS_APRIL[dayOfApril - 1]?.toUpperCase() || '');
  const isUnlocked = isTodayUnlocked(now) || forceUnlock;

  // --- Effects ---

  useEffect(() => {
    const savedUser = localStorage.getItem('wordle_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    if (isAfter(now, APRIL_END)) setIsEventEnded(true);
    // Removed isEventNotStarted check to allow testing mode
  }, [now]);

  useEffect(() => {
    if (!user) {
      setLeaderboard([]);
      return;
    }

    const q = query(
      collection(db, 'leaderboard'), 
      where('totalScore', '>', 0),
      orderBy('totalScore', 'desc'), 
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaderboard');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.email);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const daily = data.dailyScores?.[todayStr];
          if (daily) {
            setDailyScore(daily);
            setGuesses(daily.guesses);
            setIsGameOver(true);
            setGameStatus(daily.score > 0 ? 'won' : 'lost');
          } else {
            // Reset state for new day
            setDailyScore(null);
            setGuesses([]);
            setIsGameOver(false);
            setGameStatus('playing');
            setCurrentGuess('');
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.email}`);
      });
      return () => unsubscribe();
    }
  }, [user, todayStr]);

  // --- Handlers ---

  const handleLogout = () => {
    localStorage.removeItem('wordle_user');
    setUser(null);
  };

  const handleResetToday = async () => {
    if (!user || !isTestingMode) return;
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.email);
        const leaderboardRef = doc(db, 'leaderboard', user.email);
        
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) return;
        
        const data = userSnap.data();
        const daily = data.dailyScores?.[todayStr];
        if (!daily) return;
        
        const scoreToRemove = daily.score;
        
        const updatedDailyScores = { ...data.dailyScores };
        delete updatedDailyScores[todayStr];
        
        transaction.update(userRef, {
          dailyScores: updatedDailyScores,
          totalScore: increment(-scoreToRemove)
        });
        transaction.update(leaderboardRef, {
          totalScore: increment(-scoreToRemove)
        });
      });
      setGuesses([]);
      setIsGameOver(false);
      setGameStatus('playing');
      setCurrentGuess('');
    } catch (err) {
      console.error("Reset error:", err);
    }
  };

  const submitGuess = useCallback(async () => {
    if (currentGuess.length !== 5 || isGameOver || !user) return;

    const newGuesses = [...guesses, currentGuess];
    const isWin = currentGuess === solution;
    const isLoss = newGuesses.length === 6 && !isWin;

    if (isWin || isLoss) {
      const score = isWin ? SCORING[newGuesses.length as keyof typeof SCORING] : 0;
      
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', user.email);
          const leaderboardRef = doc(db, 'leaderboard', user.email);
          
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) return;
          
          const userData = userSnap.data();
          
          // Prevent double submission
          if (userData.dailyScores?.[todayStr]) return;
          
          transaction.update(userRef, {
            [`dailyScores.${todayStr}`]: {
              word: solution,
              guesses: newGuesses,
              score,
              completedAt: new Date().toISOString()
            },
            totalScore: increment(score)
          });
          
          transaction.update(leaderboardRef, {
            totalScore: increment(score)
          });
        });

        if (isWin) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#fbbf24', '#ffffff']
          });
        }
      } catch (err) {
        console.error("Transaction failed:", err);
      }
    } else {
      setGuesses(newGuesses);
      setCurrentGuess('');
    }
  }, [currentGuess, guesses, isGameOver, user, solution, todayStr]);

  const onKey = useCallback((key: string) => {
    if (isGameOver) return;

    if (key === 'ENTER') {
      submitGuess();
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key);
    }
  }, [isGameOver, currentGuess, submitGuess]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === 'ENTER') onKey('ENTER');
      else if (key === 'BACKSPACE') onKey('BACKSPACE');
      else if (/^[A-Z]$/.test(key)) onKey(key);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onKey]);

  // --- Render ---

  if (isEventEnded) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl font-bold mb-4 text-zinc-900">This event has ended</h1>
          <p className="text-zinc-500">Thank you for participating in the April Edition.</p>
        </motion.div>
      </div>
    );
  }

  if (!hasEntered) {
    return <Intro onEnter={() => setHasEntered(true)} />;
  }  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans"
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl z-40 px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <motion.div 
            layoutId="intro-image"
            className="w-10 h-10 rounded-none overflow-hidden shadow-sm"
          >
            <img 
              src="https://files.catbox.moe/pfq7ul.png" 
              alt="Logo" 
              className="w-full h-full object-cover grayscale"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          <div className="h-4 w-[1px] bg-zinc-200 hidden md:block" />
        </div>

        {user ? (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-medium tracking-tight">{user.username}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Player</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 hover:bg-zinc-100 rounded-full transition-all active:scale-95"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        ) : null}
      </header>

      <main className="pt-32 pb-24 px-8 max-w-7xl mx-auto">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <AuthForm onAuthSuccess={(u) => setUser(u)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Game Area */}
            <div className="lg:col-span-8 flex flex-col items-center">
              {!isUnlocked ? (
                <div className="flex flex-col items-center justify-center py-32 text-center max-w-md">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                    <Info className="w-5 h-5 text-zinc-300" />
                  </div>
                  <h2 className="text-3xl font-medium mb-4 tracking-tight">Locked until 06:00</h2>
                  <p className="text-zinc-400 leading-relaxed">Today's challenge is currently being prepared. Check back shortly.</p>
                  {isTestingMode && (
                    <button 
                      onClick={() => setForceUnlock(true)}
                      className="mt-12 text-[10px] uppercase tracking-widest text-zinc-300 hover:text-zinc-500 transition-colors font-bold"
                    >
                      Developer: Force Unlock
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 text-center"
                  >
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400 font-bold mb-3">
                      {isTestingMode ? 'Pre-Launch Test' : `Challenge ${dayOfApril}`}
                    </p>
                    <h2 className="text-4xl md:text-5xl font-medium tracking-tighter">
                      {isTestingMode ? format(now, 'MMMM do') : `April ${dayOfApril}`}
                    </h2>
                  </motion.div>

                  <WordleGrid 
                    guesses={guesses} 
                    currentGuess={currentGuess} 
                    solution={solution} 
                    isGameOver={isGameOver}
                  />

                  {isGameOver ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center mb-12 p-10 bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-zinc-100 w-full max-w-sm"
                    >
                      {gameStatus === 'won' ? (
                        <>
                          <CheckCircle2 className="w-12 h-12 text-black mx-auto mb-6" />
                          <h3 className="text-2xl font-medium mb-2 tracking-tight">Impressive</h3>
                          <p className="text-zinc-400 mb-8">You earned {dailyScore?.score} points.</p>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-12 h-12 text-zinc-200 mx-auto mb-6" />
                          <h3 className="text-2xl font-medium mb-2 tracking-tight">Nice try</h3>
                          <p className="text-zinc-400 mb-8">The word was <span className="font-bold text-black tracking-tight">{solution}</span>.</p>
                        </>
                      )}
                      <p className="text-xs text-zinc-400 font-medium mb-8 leading-relaxed">
                        Challenge completed. Next word unlocks tomorrow at 06:00.
                      </p>
                      {isTestingMode && (
                        <button 
                          onClick={handleResetToday}
                          className="text-[10px] uppercase tracking-widest text-zinc-300 hover:text-zinc-500 transition-colors font-bold"
                        >
                          Developer: Reset Progress
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <Keyboard onKey={onKey} guesses={guesses} solution={solution} />
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-16">
              <Leaderboard users={leaderboard} />
            </div>
          </div>
        )}
      </main>
    </motion.div>
  );
}
