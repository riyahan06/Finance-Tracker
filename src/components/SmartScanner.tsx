import { useState, useCallback, useEffect } from 'react';
import { useVision, useTextGeneration } from '../hooks/useSharedAI';

interface ScannedExpense {
  id: string;
  merchant: string;
  date: string;
  total: number;
  category: string;
  lineItems: { description: string; amount: number }[];
  timestamp: number;
}

const STORAGE_KEY = 'smartScannerExpenses';

export function SmartScanner() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ScannedExpense[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<ScannedExpense | null>(null);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  
  const { analyzeImage, isReady: visionReady, state: visionState } = useVision();
  const { generate, isReady: llmReady, state: llmState } = useTextGeneration();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setExpenses(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load scanned expenses:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  const netBalance = expenses.reduce((sum, e) => sum - e.total, 0);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setScanError(null);
      setSelectedExpense(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleScan = useCallback(async () => {
    if (!imagePreview) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const prompt = `You are a receipt parsing AI. Extract the following information from this receipt image and return ONLY a JSON object with this exact structure:
{
  "merchant": "store name",
  "date": "YYYY-MM-DD",
  "total": number,
  "category": "Food|Transport|Bills|Shopping|Entertainment|Health",
  "lineItems": [{"description": "item name", "amount": number}]
}

If you cannot determine a value, use "Unknown" for strings and 0 for numbers. Return ONLY the JSON, no other text.`;

      const result = await analyzeImage(imagePreview, prompt);
      
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse receipt data');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const newExpense: ScannedExpense = {
        id: Date.now().toString(),
        merchant: parsed.merchant || 'Unknown',
        date: parsed.date || new Date().toISOString().split('T')[0],
        total: parseFloat(parsed.total) || 0,
        category: parsed.category || 'Shopping',
        lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
        timestamp: Date.now()
      };

      setExpenses(prev => [newExpense, ...prev]);
      setSelectedExpense(newExpense);
      setImagePreview(null);
    } catch (err) {
      console.error('Scan error:', err);
      setScanError(err instanceof Error ? err.message : 'Failed to scan receipt');
    } finally {
      setIsScanning(false);
    }
  }, [imagePreview, analyzeImage]);

  const handleDeleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (selectedExpense?.id === id) {
      setSelectedExpense(null);
    }
  }, [selectedExpense]);

  const exportToCSV = useCallback(() => {
    if (expenses.length === 0) {
      alert('No expenses to export!');
      return;
    }

    const headers = ['Date', 'Merchant', 'Category', 'Total', 'Items'];
    const rows = expenses.map(e => [
      e.date,
      `"${e.merchant.replace(/"/g, '""')}"`,
      e.category,
      e.total.toFixed(2),
      `"${e.lineItems.map(li => `${li.description}: $${li.amount}`).join(', ')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart_scanner_expenses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 2000);
  }, [expenses]);

  const isModelReady = visionReady() && llmReady();
  const modelStatus = !isModelReady 
    ? (visionState === 'loading' || llmState === 'loading' ? 'Loading AI model...' : 'Model not ready')
    : 'AI Ready';

  return (
    <div className="smart-scanner-container">
      <style>{`
        .smart-scanner-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .ss-header {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3));
          border-radius: 12px;
          padding: 20px;
          border: 2px solid rgba(139, 92, 246, 0.5);
        }
        
        .ss-header h2 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #F1F5F9;
        }
        
        .ss-header p {
          margin: 0;
          font-size: 13px;
          color: #94A3B8;
        }
        
        .ss-balance {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .ss-balance-label {
          font-size: 12px;
          color: #94A3B8;
        }
        
        .ss-balance-amount {
          font-size: 24px;
          font-weight: 700;
          color: #EF4444;
        }
        
        .ss-model-status {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          background: ${isModelReady ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'};
          color: ${isModelReady ? '#22C55E' : '#F59E0B'};
          border: 1px solid ${isModelReady ? '#22C55E' : '#F59E0B'};
        }
        
        .ss-scan-section {
          background: rgba(30, 41, 59, 0.7);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .ss-upload-area {
          border: 2px dashed rgba(139, 92, 246, 0.5);
          border-radius: 12px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .ss-upload-area:hover {
          border-color: rgba(139, 92, 246, 0.8);
          background: rgba(139, 92, 246, 0.1);
        }
        
        .ss-upload-area input {
          display: none;
        }
        
        .ss-upload-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        
        .ss-preview-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .ss-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .ss-btn-primary {
          background: linear-gradient(135deg, #8B5CF6, #6366F1);
          color: white;
        }
        
        .ss-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }
        
        .ss-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .ss-btn-secondary {
          background: rgba(100, 116, 139, 0.3);
          color: #F1F5F9;
        }
        
        .ss-error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #EF4444;
          border-radius: 8px;
          padding: 12px;
          color: #EF4444;
          font-size: 13px;
        }
        
        .ss-expenses-list {
          background: rgba(30, 41, 59, 0.7);
          border-radius: 12px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .ss-expense-card {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        
        .ss-expense-card:hover {
          border-color: rgba(139, 92, 246, 0.5);
        }
        
        .ss-expense-card.selected {
          border-color: #8B5CF6;
          background: rgba(139, 92, 246, 0.1);
        }
        
        .ss-expense-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .ss-expense-merchant {
          font-size: 16px;
          font-weight: 600;
          color: #F1F5F9;
        }
        
        .ss-expense-total {
          font-size: 18px;
          font-weight: 700;
          color: #EF4444;
        }
        
        .ss-expense-meta {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #94A3B8;
        }
        
        .ss-expense-category {
          background: rgba(139, 92, 246, 0.3);
          padding: 2px 8px;
          border-radius: 4px;
          color: #A78BFA;
        }
        
        .ss-export-btn {
          background: linear-gradient(135deg, #22C55E, #16A34A);
        }
        
        .ss-export-success {
          color: #22C55E;
          font-size: 13px;
          text-align: center;
          padding: 8px;
        }
        
        .ss-empty {
          text-align: center;
          padding: 40px;
          color: #64748B;
        }
      `}</style>

      <div className="ss-header">
        <h2>📷 Smart Scanner</h2>
        <p>AI-powered receipt scanning with on-device OCR</p>
        <div className="ss-balance">
          <div>
            <div className="ss-balance-label">Scanner Net Balance</div>
            <div className="ss-balance-amount">-${Math.abs(netBalance).toFixed(2)}</div>
          </div>
          <div className="ss-model-status">{modelStatus}</div>
        </div>
      </div>

      <div className="ss-scan-section">
        {!imagePreview ? (
          <label className="ss-upload-area">
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            <div className="ss-upload-icon">📸</div>
            <div style={{ color: '#94A3B8', marginBottom: '8px' }}>Click to upload receipt</div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>Processed 100% on-device</div>
          </label>
        ) : (
          <div>
            <img src={imagePreview} alt="Receipt preview" className="ss-preview-image" />
            {scanError && <div className="ss-error">{scanError}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="ss-btn ss-btn-primary" 
                onClick={handleScan} 
                disabled={isScanning || !visionReady()}
                style={{ flex: 1 }}
              >
                {isScanning ? '🤖 Scanning with AI...' : '🔍 Scan Receipt'}
              </button>
              <button 
                className="ss-btn ss-btn-secondary" 
                onClick={() => setImagePreview(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ss-expenses-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9' }}>Scanned Expenses</h3>
          <button 
            className="ss-btn ss-export-btn" 
            onClick={exportToCSV}
            disabled={expenses.length === 0}
          >
            📄 Export History
          </button>
          {showExportSuccess && <div className="ss-export-success">✓ Exported successfully!</div>}
        </div>

        {expenses.length === 0 ? (
          <div className="ss-empty">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧾</div>
            <div>No scanned receipts yet</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>Upload a receipt to get started</div>
          </div>
        ) : (
          expenses.map(expense => (
            <div 
              key={expense.id} 
              className={`ss-expense-card ${selectedExpense?.id === expense.id ? 'selected' : ''}`}
              onClick={() => setSelectedExpense(expense)}
            >
              <div className="ss-expense-header">
                <span className="ss-expense-merchant">{expense.merchant}</span>
                <span className="ss-expense-total">-${expense.total.toFixed(2)}</span>
              </div>
              <div className="ss-expense-meta">
                <span>{expense.date}</span>
                <span className="ss-expense-category">{expense.category}</span>
                {expense.lineItems.length > 0 && <span>{expense.lineItems.length} items</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedExpense && (
        <div className="ss-expenses-list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#F1F5F9' }}>Receipt Details</h3>
            <button 
              className="ss-btn ss-btn-secondary" 
              onClick={() => handleDeleteExpense(selectedExpense.id)}
              style={{ background: 'rgba(239, 68, 68, 0.3)', color: '#EF4444' }}
            >
              Delete
            </button>
          </div>
          <div style={{ fontSize: '14px', color: '#F1F5F9', lineHeight: '1.8' }}>
            <div><strong>Merchant:</strong> {selectedExpense.merchant}</div>
            <div><strong>Date:</strong> {selectedExpense.date}</div>
            <div><strong>Category:</strong> {selectedExpense.category}</div>
            <div><strong>Total:</strong> ${selectedExpense.total.toFixed(2)}</div>
            {selectedExpense.lineItems.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <strong>Line Items:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  {selectedExpense.lineItems.map((item, i) => (
                    <li key={i}>{item.description}: ${item.amount.toFixed(2)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
