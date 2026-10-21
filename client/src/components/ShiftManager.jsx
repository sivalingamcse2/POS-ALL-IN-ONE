import { useState, useEffect } from 'react';
import storageEngine, { playSound } from '../services/storageEngine';

export default function ShiftManager({ isOpen, onClose, currentCashier = 'Admin' }) {
  const [activeTab, setActiveTab] = useState('current'); // 'current', 'x_report', 'close_z', 'history'
  const [activeShift, setActiveShift] = useState(storageEngine.getActiveShift());
  const [shiftsHistory, setShiftsHistory] = useState(storageEngine.getShifts());
  
  // Cash In / Cash Out form
  const [cashMovement, setCashMovement] = useState({ type: 'in', amount: '', reason: '' });
  const [movementMessage, setMovementMessage] = useState('');

  // Close shift form
  const [countedCash, setCountedCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closedShiftResult, setClosedShiftResult] = useState(null);

  // New shift form
  const [newOpeningFloat, setNewOpeningFloat] = useState(200.00);

  useEffect(() => {
    const unsub = storageEngine.subscribe((event) => {
      if (event === 'shift_updated' || event === 'shift_closed' || event === 'order_created') {
        setActiveShift(storageEngine.getActiveShift());
        setShiftsHistory(storageEngine.getShifts());
      }
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const openingFloat = parseFloat(activeShift?.opening_float || 0);
  const cashSales = parseFloat(activeShift?.cash_sales || 0);
  const cardSales = parseFloat(activeShift?.card_sales || 0);
  const otherSales = parseFloat(activeShift?.other_sales || 0);
  const cashIn = parseFloat(activeShift?.cash_in || 0);
  const cashOut = parseFloat(activeShift?.cash_out || 0);
  const totalSales = parseFloat(activeShift?.total_sales || 0);

  const expectedCashInDrawer = (openingFloat + cashSales + cashIn - cashOut).toFixed(2);
  const variance = countedCash ? (parseFloat(countedCash) - parseFloat(expectedCashInDrawer)).toFixed(2) : 0;

  const handleCashMovementSubmit = (e) => {
    e.preventDefault();
    if (!cashMovement.amount || parseFloat(cashMovement.amount) <= 0) return;
    
    storageEngine.recordCashMovement(
      cashMovement.type,
      parseFloat(cashMovement.amount),
      cashMovement.reason || (cashMovement.type === 'in' ? 'Float Top-up' : 'Petty Cash Payout')
    );
    playSound('beep');
    setMovementMessage(`Successfully recorded Cash ${cashMovement.type.toUpperCase()}: $${cashMovement.amount}`);
    setCashMovement({ type: 'in', amount: '', reason: '' });
    setActiveShift(storageEngine.getActiveShift());
    setTimeout(() => setMovementMessage(''), 3000);
  };

  const handleCloseShift = (e) => {
    e.preventDefault();
    if (countedCash === '') return;
    
    const result = storageEngine.closeShift(parseFloat(countedCash), closingNotes);
    playSound('chime');
    setClosedShiftResult(result);
    setActiveShift(null);
    setShiftsHistory(storageEngine.getShifts());
  };

  const handleOpenNewShift = (e) => {
    e.preventDefault();
    const newShift = storageEngine.openNewShift(currentCashier, parseFloat(newOpeningFloat));
    playSound('chime');
    setActiveShift(newShift);
    setClosedShiftResult(null);
    setCountedCash('');
    setClosingNotes('');
    setActiveTab('current');
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💼</span>
            <div>
              <h2 className="font-bold text-lg">Cash Drawer & Shift Manager</h2>
              <p className="text-xs text-gray-400">
                Register Fiscal Tracking • X-Report (Audit) • Z-Report (End-of-Day)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-gray-100 p-1 border-b border-gray-200 print:hidden text-sm">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-2 font-bold rounded-lg transition-all ${
              activeTab === 'current' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Live Drawer Status
          </button>
          <button
            onClick={() => setActiveTab('x_report')}
            className={`flex-1 py-2 font-bold rounded-lg transition-all ${
              activeTab === 'x_report' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📄 X-Report (Audit)
          </button>
          <button
            onClick={() => setActiveTab('close_z')}
            className={`flex-1 py-2 font-bold rounded-lg transition-all ${
              activeTab === 'close_z' ? 'bg-white shadow text-red-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔒 End Shift (Z-Report)
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 font-bold rounded-lg transition-all ${
              activeTab === 'history' ? 'bg-white shadow text-primary-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Shift History
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Live Drawer Status */}
          {activeTab === 'current' && (
            activeShift ? (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-center">
                    <span className="text-xs text-gray-500 font-semibold uppercase">Opening Float</span>
                    <p className="text-lg font-bold text-gray-800">${openingFloat.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                    <span className="text-xs text-emerald-600 font-semibold uppercase">Total Sales</span>
                    <p className="text-lg font-bold text-emerald-700">${totalSales.toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
                    <span className="text-xs text-blue-600 font-semibold uppercase">Cash Collected</span>
                    <p className="text-lg font-bold text-blue-700">${cashSales.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center">
                    <span className="text-xs text-purple-600 font-semibold uppercase">In Drawer Now</span>
                    <p className="text-lg font-bold text-purple-800">${expectedCashInDrawer}</p>
                  </div>
                </div>

                {/* Sales Breakdown by Payment Type */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm">
                  <h4 className="font-bold text-gray-800 mb-2">Payment Method Breakdown</h4>
                  <div className="space-y-1.5 text-gray-600">
                    <div className="flex justify-between">
                      <span>💵 Cash Sales:</span>
                      <span className="font-semibold text-gray-900">${cashSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>💳 Credit / Debit Card:</span>
                      <span className="font-semibold text-gray-900">${cardSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>📱 Digital Wallets / Other:</span>
                      <span className="font-semibold text-gray-900">${otherSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 pt-1 border-t">
                      <span>Cash In (Floats): +${cashIn.toFixed(2)}</span>
                      <span>Cash Out (Payouts): -${cashOut.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Pay In / Pay Out Form */}
                <div className="border border-gray-200 p-4 rounded-xl">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span>💵</span> Record Pay In / Pay Out
                  </h4>

                  {movementMessage && (
                    <div className="mb-3 p-2.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold">
                      {movementMessage}
                    </div>
                  )}

                  <form onSubmit={handleCashMovementSubmit} className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={cashMovement.type}
                        onChange={(e) => setCashMovement({ ...cashMovement, type: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm bg-white"
                      >
                        <option value="in">Cash In (Float Top-up)</option>
                        <option value="out">Cash Out (Petty Cash/Payout)</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Amount ($)"
                        value={cashMovement.amount}
                        onChange={(e) => setCashMovement({ ...cashMovement, amount: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Reason (e.g. Paper rolls)"
                        value={cashMovement.reason}
                        onChange={(e) => setCashMovement({ ...cashMovement, reason: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-gray-800 hover:bg-black text-white text-sm font-bold rounded-lg transition-all"
                    >
                      Record Cash Movement
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="text-5xl">🔒</div>
                <h3 className="text-lg font-bold text-gray-800">No Active Shift Opened</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  Open a new cashier shift with an opening float to track sales and cash drawer balance.
                </p>
                <form onSubmit={handleOpenNewShift} className="max-w-xs mx-auto space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 text-left">
                      Opening Cash Float ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newOpeningFloat}
                      onChange={(e) => setNewOpeningFloat(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-lg font-bold text-center"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow transition-all"
                  >
                    Open New Shift
                  </button>
                </form>
              </div>
            )
          )}

          {/* TAB 2: X-Report (Audit Slip) */}
          {activeTab === 'x_report' && (
            activeShift ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center print:hidden">
                  <h3 className="font-bold text-gray-800">Mid-Shift X-Report (Non-Clearing Audit)</h3>
                  <button
                    onClick={handlePrintSlip}
                    className="px-3 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-black transition-all"
                  >
                    🖨️ Print X-Report Slip
                  </button>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 font-mono text-xs max-w-md mx-auto space-y-2">
                  <div className="text-center pb-2 border-b border-dashed border-gray-400">
                    <p className="font-extrabold text-sm uppercase">SIVARA SYSTEM</p>
                    <p className="font-bold">*** FISCAL X-REPORT ***</p>
                    <p className="text-[10px] text-gray-500">INTERIM AUDIT (DO NOT CLEAR DRAWER)</p>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Shift ID:</span>
                    <span>{activeShift.id}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Cashier:</span>
                    <span>{activeShift.cashier_name}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Opened At:</span>
                    <span>{new Date(activeShift.opened_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Audit Time:</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="py-2 border-y border-dashed border-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>OPENING FLOAT:</span>
                      <span>${openingFloat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>GROSS SALES:</span>
                      <span>${totalSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 pl-2">
                      <span>• Cash Sales:</span>
                      <span>${cashSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 pl-2">
                      <span>• Card Sales:</span>
                      <span>${cardSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 pl-2">
                      <span>• Other / Digital:</span>
                      <span>${otherSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Cash In (Floats):</span>
                      <span>+${cashIn.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Cash Out (Payouts):</span>
                      <span>-${cashOut.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm pt-1">
                    <span>EXPECTED IN DRAWER:</span>
                    <span>${expectedCashInDrawer}</span>
                  </div>
                  <p className="text-center text-[10px] text-gray-400 pt-3">
                    --- END OF X-REPORT ---
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No active shift to audit.</p>
            )
          )}

          {/* TAB 3: Close Shift & Z-Report */}
          {activeTab === 'close_z' && (
            closedShiftResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-2xl">✅</span>
                  <h3 className="font-bold text-emerald-800 text-lg">Shift Successfully Closed!</h3>
                  <p className="text-xs text-emerald-600">The End-of-Day Z-Report has been generated.</p>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 font-mono text-xs max-w-md mx-auto space-y-2">
                  <div className="text-center pb-2 border-b border-dashed border-gray-400">
                    <p className="font-extrabold text-sm uppercase">SIVARA SYSTEM</p>
                    <p className="font-bold text-red-600">*** OFFICIAL Z-REPORT ***</p>
                    <p className="text-[10px] text-gray-500">FINAL END-OF-DAY AUDIT (REGISTER CLOSED)</p>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Shift ID:</span>
                    <span>{closedShiftResult.id}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Closed At:</span>
                    <span>{new Date(closedShiftResult.closed_at).toLocaleString()}</span>
                  </div>
                  <div className="py-2 border-y border-dashed border-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Opening Float:</span>
                      <span>${parseFloat(closedShiftResult.opening_float).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total Sales:</span>
                      <span>${parseFloat(closedShiftResult.total_sales).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Cash:</span>
                      <span>${parseFloat(closedShiftResult.expected_cash).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Actual Counted Cash:</span>
                      <span>${parseFloat(closedShiftResult.actual_cash).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between font-extrabold text-xs ${
                      closedShiftResult.variance === 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      <span>DRAWER VARIANCE:</span>
                      <span>
                        {closedShiftResult.variance > 0 ? `+$${closedShiftResult.variance.toFixed(2)} OVER` : ''}
                        {closedShiftResult.variance < 0 ? `-$${Math.abs(closedShiftResult.variance).toFixed(2)} SHORT` : ''}
                        {closedShiftResult.variance === 0 ? '$0.00 EXACT' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePrintSlip}
                    className="flex-1 py-2.5 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition-all"
                  >
                    🖨️ Print Z-Report Slip
                  </button>
                  <button
                    onClick={() => setActiveTab('current')}
                    className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-all"
                  >
                    Open Next Shift
                  </button>
                </div>
              </div>
            ) : activeShift ? (
              <form onSubmit={handleCloseShift} className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                  <p className="font-bold">⚠️ Warning: Closing Shift (Z-Report)</p>
                  <p className="text-xs mt-1">
                    This will finalize fiscal totals and close the current cash drawer session. Please count physical cash carefully.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-gray-50 rounded-xl border">
                    <span className="text-xs text-gray-500">Expected Cash in Drawer:</span>
                    <p className="text-xl font-bold text-gray-800">${expectedCashInDrawer}</p>
                  </div>
                  <div className={`p-3 rounded-xl border ${
                    variance === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <span className="text-xs opacity-75">Calculated Discrepancy:</span>
                    <p className="text-xl font-bold">
                      {variance > 0 ? `+$${variance} Over` : ''}
                      {variance < 0 ? `-$${Math.abs(variance)} Short` : ''}
                      {variance == 0 ? '$0.00 Exact' : ''}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Actual Physical Cash Counted ($):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter counted amount..."
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-xl font-extrabold focus:border-primary-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Closing Notes / Audit Comments (Optional):
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Reason for discrepancy or shift notes..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  🔒 Close Shift & Print Z-Report
                </button>
              </form>
            ) : (
              <p className="text-center text-gray-500 py-8">No active shift to close.</p>
            )
          )}

          {/* TAB 4: Shift History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h4 className="font-bold text-gray-800">Closed Shifts Archive ({shiftsHistory.length})</h4>
              {shiftsHistory.length === 0 ? (
                <p className="text-xs text-gray-500">No archived shifts yet.</p>
              ) : (
                <div className="divide-y divide-gray-200 border rounded-xl overflow-hidden text-xs">
                  {shiftsHistory.map((shift, i) => (
                    <div key={i} className="p-3 bg-white hover:bg-gray-50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800">{shift.id}</p>
                        <p className="text-gray-500">
                          {new Date(shift.opened_at).toLocaleDateString()} by {shift.cashier_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">${parseFloat(shift.total_sales || 0).toFixed(2)} Sales</p>
                        <p className={`font-semibold ${
                          shift.variance === 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          Var: ${parseFloat(shift.variance || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
