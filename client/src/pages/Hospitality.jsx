import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Hospitality() {
  const { activeRestaurant } = useAuth();
  const [activeTab, setActiveTab] = useState('room-service');
  const [rooms, setRooms] = useState([
    { id: '101', guest: 'John Doe', status: 'Checked In', pms_sync: 'Active' },
    { id: '102', guest: 'Jane Smith', status: 'Checked In', pms_sync: 'Active' },
    { id: '205', guest: 'Mike Wilson', status: 'Checked In', pms_sync: 'Active' },
    { id: '304', guest: 'Vacant', status: 'Available', pms_sync: 'Standby' },
  ]);

  const [liquorStock, setLiquorStock] = useState([
    { id: 1, name: 'Premium Whiskey', size: '750ml', type: 'Bottle', stock: 12, consumption: '45% (High)' },
    { id: 2, name: 'House Vodka', size: '1000ml', type: 'Bottle', stock: 8, consumption: '20% (Low)' },
    { id: 3, name: 'Craft Gin', size: '750ml', type: 'Bottle', stock: 5, consumption: '80% (Peak)' },
  ]);

  const [events, setEvents] = useState([
    { id: 1, name: 'Wedding Banquet', date: '2026-02-15', guests: 150, package: 'Premium Gold', deposit: 'Paid' },
    { id: 2, name: 'Corporate Seminar', date: '2026-02-20', guests: 50, package: 'Business Lite', deposit: 'Pending' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-gray-800">SIVARA <span className="text-primary-600">HOSPITALITY SUITE</span></h1>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-black border border-emerald-200 shadow-sm animate-pulse">
          PMS SYNC: CONNECTED (OPERA V5)
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit shadow-inner">
        {['room-service', 'bar-mgmt', 'banquet-events'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm uppercase ${
              activeTab === tab ? 'bg-white shadow-md text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Room Service / PMS Sync */}
      {activeTab === 'room-service' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
              <span className="p-2 bg-blue-100 text-blue-600 rounded-xl">🏨</span>
              Room Charge & PMS Integration
            </h2>
            <div className="space-y-4">
              {rooms.map(room => (
                <div key={room.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-blue-300 transition-all">
                  <div>
                    <p className="text-lg font-black text-gray-800">ROOM {room.id}</p>
                    <p className="text-sm text-gray-500 font-bold">{room.guest}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      disabled={room.status !== 'Checked In'}
                      onClick={() => alert(`Billing ORD-9823 to Room ${room.id}...\nSyncing with Cloudbeds PMS...`)}
                      className="bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-primary-200 disabled:opacity-30"
                    >
                      Post to Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-0 shadow-2xl">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <span>📊</span>
              Room Service Analytics
            </h2>
            <div className="space-y-6">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                <p className="text-xs font-bold uppercase opacity-60">Avg. Delivery Time</p>
                <p className="text-4xl font-black">18.5 mins</p>
                <div className="w-full h-1 bg-white/20 rounded-full mt-2">
                  <div className="w-4/5 h-full bg-emerald-400 rounded-full"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                  <p className="text-xs font-bold uppercase opacity-60">Service Charge</p>
                  <p className="text-2xl font-black">15.00%</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                  <p className="text-xs font-bold uppercase opacity-60">Auto-Tips</p>
                  <p className="text-2xl font-black">Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bar Management */}
      {activeTab === 'bar-mgmt' && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-black flex items-center gap-2">
               <span className="p-2 bg-amber-100 text-amber-600 rounded-xl">🥃</span>
               Bar & Liquor Inventory (Bottle-Wise)
             </h2>
             <button className="btn btn-secondary text-xs px-4">Manual Pour Log</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Brand Name</th>
                  <th>Size</th>
                  <th>Type</th>
                  <th>In-Stock (Full)</th>
                  <th>Consumption Trend</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {liquorStock.map(item => (
                  <tr key={item.id}>
                    <td className="font-black text-gray-800">{item.name}</td>
                    <td><span className="bg-gray-100 px-2 py-1 rounded text-[10px] font-black">{item.size}</span></td>
                    <td>{item.type}</td>
                    <td className="font-bold text-primary-600">{item.stock} Btls</td>
                    <td>
                       <span className={`text-xs font-black px-3 py-1 rounded-full ${
                         item.consumption.includes('High') ? 'bg-red-100 text-red-600' : 
                         item.consumption.includes('Peak') ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                       }`}>
                         {item.consumption}
                       </span>
                    </td>
                    <td>
                      <button className="text-blue-600 font-black hover:underline text-xs">View Pour Control</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Banquet & Events */}
      {activeTab === 'banquet-events' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
             <h2 className="text-xl font-black mb-6">Scheduled Events</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.map(event => (
                  <div key={event.id} className="p-5 bg-white border-2 border-gray-100 rounded-3xl hover:border-primary-500 transition-all shadow-sm">
                    <div className="flex justify-between mb-3">
                      <p className="text-lg font-black text-gray-800">{event.name}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${event.deposit === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        DEPOSIT: {event.deposit}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-500 font-bold">
                      <p className="flex justify-between">Date: <span className="text-gray-800">{event.date}</span></p>
                      <p className="flex justify-between">Guests: <span className="text-gray-800">{event.guests} PAX</span></p>
                      <p className="flex justify-between">Package: <span className="text-primary-600">{event.package}</span></p>
                    </div>
                    <button className="w-full mt-4 bg-gray-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-primary-600 transition-all">
                      Manage Banquet Bill
                    </button>
                  </div>
                ))}
             </div>
          </div>
          <div className="card p-6 bg-gray-900 text-white border-0">
             <h2 className="text-xl font-black mb-6 text-primary-400">Advance Payments</h2>
             <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-xs font-bold uppercase opacity-50">Total Advance Collected</p>
                   <p className="text-3xl font-black">$45,200.00</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-xs font-bold uppercase opacity-50">Pending Settlement</p>
                   <p className="text-3xl font-black text-orange-400">$12,800.00</p>
                </div>
                <button className="btn btn-primary w-full py-4 text-sm mt-4">Generate Event Report</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
