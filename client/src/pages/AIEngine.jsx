import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AIEngine() {
  const { activeRestaurant } = useAuth();
  const [activeTab, setActiveTab] = useState('dynamic-pricing');

  const [combos, setCombos] = useState([
    { id: 1, name: 'Family Weekend Feast', items: '2 Large Pizza + 4 Drinks', discount: '15%', demand: 'High' },
    { id: 2, name: 'Business Lunch Special', items: 'Steak + Wine + Dessert', discount: '10%', demand: 'Moderate' },
    { id: 3, name: 'Late Night Munchies', items: 'Wings + Fries + Beer', discount: '20%', demand: 'Rising' },
  ]);

  const [wasteLogs, setWasteLogs] = useState([
    { id: 1, item: 'Fresh Lettuce', qty: '2.5kg', reason: 'Over-ordered', ai_suggestion: 'Reduce order by 20% on Tuesdays' },
    { id: 2, item: 'Milk (1L)', qty: '4 units', reason: 'Expired', ai_suggestion: 'Auto-transfer to Bakery module' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">ALL IN ONE <span className="text-indigo-600">AI SMART ENGINE</span></h1>
        <div className="flex gap-2">
           <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Core: GPT-4o Hospitality</span>
           <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">Neural Sync Active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit shadow-inner">
        {['dynamic-pricing', 'smart-combos', 'waste-reduction'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm uppercase ${
              activeTab === tab ? 'bg-indigo-600 shadow-md text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Dynamic Pricing Engine */}
      {activeTab === 'dynamic-pricing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 border-t-4 border-indigo-500">
            <h2 className="text-xl font-black mb-4">Live Price Adjustments</h2>
            <div className="space-y-4">
               <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                  <div>
                    <p className="font-black text-indigo-900">HAPPY HOUR MODE</p>
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">Active: 4PM - 7PM</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-indigo-700">-25%</p>
                    <span className="text-[10px] font-bold text-indigo-400">All Beverages</span>
                  </div>
               </div>
               <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center opacity-50">
                  <div>
                    <p className="font-black text-amber-900">WEEKEND SURGE</p>
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">Scheduled: Friday Night</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-amber-700">+10%</p>
                    <span className="text-[10px] font-bold text-amber-400">Premium Mains</span>
                  </div>
               </div>
            </div>
            <button className="w-full mt-6 btn btn-primary py-4">Save Dynamic Rules</button>
          </div>
          <div className="card p-6 bg-gray-900 text-white border-0 shadow-2xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-10 opacity-10">
                <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
             </div>
             <h2 className="text-xl font-black mb-6">AI Demand Prediction</h2>
             <div className="space-y-6">
                <div className="flex items-end gap-2">
                   {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                     <div key={i} className="flex-1 bg-indigo-500 rounded-t-lg transition-all hover:bg-white" style={{ height: `${h}px` }}></div>
                   ))}
                </div>
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                   <p className="text-xs font-bold uppercase text-indigo-300">Peak Demand Prediction</p>
                   <p className="text-2xl font-black">7:30 PM - 9:00 PM</p>
                   <p className="text-[10px] font-bold text-emerald-400 mt-1">✓ Suggesting +2 staff for Kitchen</p>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Smart Combos / Upselling */}
      {activeTab === 'smart-combos' && (
        <div className="card p-6">
          <h2 className="text-xl font-black mb-6">AI-Generated Upsell Combos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {combos.map(combo => (
              <div key={combo.id} className="bg-gray-50 p-5 rounded-3xl border-2 border-transparent hover:border-indigo-500 transition-all group">
                <div className="flex justify-between items-start mb-4">
                   <h3 className="text-lg font-black text-gray-800">{combo.name}</h3>
                   <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-black">{combo.demand} Demand</span>
                </div>
                <p className="text-xs text-gray-500 font-bold mb-4">{combo.items}</p>
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                   <span className="text-indigo-600 font-black">SAVE {combo.discount}</span>
                   <button className="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black group-hover:bg-indigo-600 transition-colors">PUSH TO KIOSK</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waste Reduction */}
      {activeTab === 'waste-reduction' && (
        <div className="card p-6">
          <h2 className="text-xl font-black mb-6 flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">♻️</span>
            AI Waste Prevention Insights
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Item Lost</th>
                  <th>Quantity</th>
                  <th>Primary Reason</th>
                  <th>AI Corrective Action</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {wasteLogs.map(log => (
                  <tr key={log.id}>
                    <td className="font-black text-gray-800">{log.item}</td>
                    <td className="font-bold text-red-600">-{log.qty}</td>
                    <td className="text-sm text-gray-500 font-medium">{log.reason}</td>
                    <td>
                       <div className="p-2 bg-indigo-50 rounded-lg text-[10px] font-black text-indigo-700 border border-indigo-100">
                         {log.ai_suggestion}
                       </div>
                    </td>
                    <td>
                       <button className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black">APPLY FIX</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
