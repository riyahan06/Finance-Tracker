import { useState, useCallback, useEffect } from 'react';
import { useTextGeneration } from '../hooks/useSharedAI';

interface Challenge {
  id: string;
  title: string;
  goal_amount: number;
  category: string;
  status: 'active' | 'completed' | 'failed';
  startDate: number;
  endDate: number;
  currentSpending: number;
}

const STORAGE_KEY = 'savingChallenges';

function getSpendingByCategory(): Record<string, number> {
  try {
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    const byCategory: Record<string, number> = {};
    
    transactions
      .filter((t: any) => t.type === 'expense' && t.category)
      .forEach((t: any) => {
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
      });
    
    return byCategory;
  } catch {
    return {};
  }
}

export function SavingChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { generate, isReady, state: modelState } = useTextGeneration();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setChallenges(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load challenges:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(challenges));
  }, [challenges]);

  const generateChallenges = useCallback(async () => {
    if (isGenerating || !isReady()) return;

    setIsGenerating(true);
    setShowLoading(true);
    setError(null);

    try {
      const spendingData = getSpendingByCategory();
      
      if (Object.keys(spendingData).length === 0) {
        throw new Error('No spending data available. Add some transactions first!');
      }

      const categorySummary = Object.entries(spendingData)
        .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
        .join(', ');

      const prompt = `Analyze this spending data. Generate 3 specific "Savings Challenges" (e.g., "The No-Coffee Week"). Return ONLY a JSON array with objects containing "title", "goal_amount", and "category" keys. Example: [{"title": "The No-Coffee Week", "goal_amount": 0, "category": "Food"}]. Spending data: ${categorySummary}. Make the challenges specific and actionable.`;

      const result = await generate(prompt, {
        maxTokens: 300,
        temperature: 0.7
      });

      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Could not generate challenges');
      }

      const parsedChallenges = JSON.parse(jsonMatch[0]);
      
      const newChallenges: Challenge[] = parsedChallenges.map((c: any, index: number) => ({
        id: (Date.now() + index).toString(),
        title: c.title || 'New Challenge',
        goal_amount: c.goal_amount ?? 0,
        category: c.category || 'Shopping',
        status: 'active' as const,
        startDate: Date.now(),
        endDate: Date.now() + 7 * 24 * 60 * 60 * 1000,
        currentSpending: spendingData[c.category] || 0
      }));

      setChallenges(prev => [...newChallenges, ...prev]);
    } catch (err) {
      console.error('Challenge generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate challenges');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setShowLoading(false), 1000);
    }
  }, [isGenerating, isReady, generate]);

  const startChallenge = useCallback((id: string) => {
    setChallenges(prev => prev.map(c => 
      c.id === id 
        ? { ...c, status: 'active' as const, startDate: Date.now(), endDate: Date.now() + 7 * 24 * 60 * 60 * 1000 }
        : c
    ));
  }, []);

  const deleteChallenge = useCallback((id: string) => {
    setChallenges(prev => prev.filter(c => c.id !== id));
  }, []);

  const spendingData = getSpendingByCategory();
  const totalSpending = Object.values(spendingData).reduce((sum, val) => sum + val, 0);

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const failedChallenges = challenges.filter(c => c.status === 'failed');

  return (
    <div className="saving-challenges-page">
      <style>{`
        .saving-challenges-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          max-width: 800px;
          margin: 0 auto;
        }

        .challenges-header {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(239, 68, 68, 0.3));
          border-radius: 12px;
          padding: 20px;
          border: 2px solid rgba(245, 158, 11, 0.5);
        }

        .challenges-header h2 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #F1F5F9;
        }

        .challenges-header p {
          margin: 0;
          font-size: 13px;
          color: #94A3B8;
        }

        .challenges-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #F59E0B;
        }

        .stat-label {
          font-size: 11px;
          color: #94A3B8;
          margin-top: 4px;
        }

        .generate-btn {
          padding: 14px 24px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }

        .generate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }

        .generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-message {
          text-align: center;
          padding: 20px;
          color: #F59E0B;
          font-size: 14px;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #EF4444;
          border-radius: 8px;
          padding: 12px;
          color: #EF4444;
          font-size: 13px;
        }

        .challenge-card {
          background: rgba(30, 41, 59, 0.7);
          border-radius: 12px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }

        .challenge-card.active {
          border-color: #22C55E;
          background: rgba(34, 197, 94, 0.1);
        }

        .challenge-card.completed {
          border-color: #3B82F6;
          background: rgba(59, 130, 246, 0.1);
        }

        .challenge-card.failed {
          border-color: #EF4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .challenge-title {
          font-size: 16px;
          font-weight: 600;
          color: #F1F5F9;
          margin-bottom: 8px;
        }

        .challenge-meta {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #94A3B8;
          margin-bottom: 12px;
        }

        .challenge-category {
          background: rgba(139, 92, 246, 0.3);
          padding: 2px 8px;
          border-radius: 4px;
          color: #A78BFA;
        }

        .challenge-progress {
          margin-top: 12px;
        }

        .progress-bar {
          height: 8px;
          background: rgba(15, 23, 42, 0.8);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #22C55E;
          transition: width 0.5s ease;
        }

        .progress-fill.warning {
          background: #F59E0B;
        }

        .progress-fill.danger {
          background: #EF4444;
        }

        .challenge-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .start-btn {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #22C55E, #16A34A);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .start-btn:hover {
          transform: translateY(-1px);
        }

        .delete-btn {
          padding: 10px 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: transparent;
          color: #94A3B8;
          cursor: pointer;
          transition: all 0.2s;
        }

        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
          border-color: #EF4444;
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #94A3B8;
          margin-bottom: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #64748B;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .challenge-spending {
          margin-top: 8px;
          font-size: 12px;
          color: #94A3B8;
        }

        .challenge-spending span {
          color: #EF4444;
          font-weight: 600;
        }
      `}</style>

      <div className="challenges-header">
        <h2>🎯 Saving Challenges</h2>
        <p>AI-powered challenges to help you save money</p>
        
        <div className="challenges-stats">
          <div className="stat-item">
            <div className="stat-value">{activeChallenges.length}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{completedChallenges.length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">${totalSpending.toFixed(0)}</div>
            <div className="stat-label">Total Spent</div>
          </div>
        </div>
      </div>

      <button 
        className="generate-btn"
        onClick={generateChallenges}
        disabled={isGenerating || !isReady()}
      >
        {isGenerating ? '🤖 Generating Challenges...' : '✨ Generate AI Challenges'}
      </button>

      {showLoading && (
        <div className="loading-message">
          🤖 Syncing with Local Data...
        </div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {activeChallenges.length > 0 && (
        <div>
          <div className="section-title">Active Challenges</div>
          {activeChallenges.map(challenge => {
            const categorySpending = spendingData[challenge.category] || 0;
            const progress = categorySpending > 0 ? Math.min((categorySpending / (categorySpending + 50)) * 100, 100) : 100;
            const progressClass = progress > 80 ? 'danger' : progress > 50 ? 'warning' : '';
            
            return (
              <div key={challenge.id} className="challenge-card active">
                <div className="challenge-title">{challenge.title}</div>
                <div className="challenge-meta">
                  <span className="challenge-category">{challenge.category}</span>
                  <span>Goal: ${challenge.goal_amount}</span>
                  <span>7 days</span>
                </div>
                <div className="challenge-progress">
                  <div className="progress-bar">
                    <div className={`progress-fill ${progressClass}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="challenge-spending">
                    Current {challenge.category} spending: <span>${categorySpending.toFixed(2)}</span>
                  </div>
                </div>
                <div className="challenge-actions">
                  <button className="delete-btn" onClick={() => deleteChallenge(challenge.id)}>
                    ✕ Close
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completedChallenges.length > 0 && (
        <div>
          <div className="section-title">Completed Challenges</div>
          {completedChallenges.map(challenge => (
            <div key={challenge.id} className="challenge-card completed">
              <div className="challenge-title">✅ {challenge.title}</div>
              <div className="challenge-meta">
                <span className="challenge-category">{challenge.category}</span>
                <span>Goal: ${challenge.goal_amount}</span>
              </div>
              <div className="challenge-actions">
                <button className="delete-btn" onClick={() => deleteChallenge(challenge.id)}>
                  ✕ Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {challenges.length === 0 && !isGenerating && (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div>No challenges yet</div>
          <div style={{ fontSize: '13px', marginTop: '8px' }}>
            Click "Generate AI Challenges" to create personalized savings goals
          </div>
        </div>
      )}

      {failedChallenges.length > 0 && (
        <div>
          <div className="section-title">Failed Challenges</div>
          {failedChallenges.map(challenge => (
            <div key={challenge.id} className="challenge-card failed">
              <div className="challenge-title">❌ {challenge.title}</div>
              <div className="challenge-meta">
                <span className="challenge-category">{challenge.category}</span>
                <span>Goal: ${challenge.goal_amount}</span>
              </div>
              <div className="challenge-actions">
                <button className="start-btn" onClick={() => startChallenge(challenge.id)}>
                  🔄 Try Again
                </button>
                <button className="delete-btn" onClick={() => deleteChallenge(challenge.id)}>
                  ✕ Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
