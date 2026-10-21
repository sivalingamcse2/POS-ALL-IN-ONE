import { useRef } from 'react';

export default function ThermalReceipt({ order, storeInfo, onClose }) {
  const receiptRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const store = storeInfo || {
    name: 'SIVARA SUPERMARKET & DINING',
    address: '123 Commercial Plaza, Main Street',
    phone: '+1-555-SIVARA',
    tax_number: 'VAT-992-881-01',
    currency: '$'
  };

  const currency = store.currency || '$';
  const currencyPrefix = currency.length > 1 ? `${currency} ` : currency;
  const orderDate = new Date(order.created_at || order.date || Date.now()).toLocaleString();
  const isSupermarket = order.business_type === 'supermarket' || !order.table_name;
  const orderTotal = Number(order.total ?? order.total_amount ?? 0);
  const orderDiscount = Number(order.discount ?? order.discount_amount ?? 0);

  return (
    <div className="thermal-receipt-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Actions Bar (hidden when printing) */}
        <div className="thermal-receipt-actions p-4 bg-gray-900 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <span className="font-bold">Receipt Preview (80mm)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg shadow flex items-center gap-1.5 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="overflow-y-auto p-6 flex justify-center bg-gray-100 print:bg-white print:p-0">
          <div
            ref={receiptRef}
            className="thermal-receipt w-full max-w-[320px] bg-white p-5 rounded shadow-sm text-gray-900 font-mono text-xs leading-relaxed border border-dashed border-gray-300 print:border-none print:shadow-none print:p-0"
          >
            {/* Header */}
            <div className="text-center mb-4 pb-3 border-b border-dashed border-gray-400">
              <h2 className="font-extrabold text-base tracking-wider uppercase">{store.name}</h2>
              <p className="text-[11px] text-gray-600">{store.address}</p>
              <p className="text-[11px] text-gray-600">Tel: {store.phone}</p>
              {store.tax_number && (
                <p className="text-[10px] text-gray-500">Tax Reg: {store.tax_number}</p>
              )}
              <div className="mt-2 inline-block px-2 py-0.5 bg-gray-200 text-gray-800 text-[10px] font-bold rounded uppercase">
                {isSupermarket ? '🛒 SUPERMARKET RETAIL SALE' : '🍽️ RESTAURANT DINE-IN SALE'}
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="mb-3 pb-2 border-b border-dashed border-gray-300 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{order.order_number || order.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{order.cashier || 'Admin'}</span>
              </div>
              {order.table_name && (
                <div className="flex justify-between font-bold">
                  <span>Table:</span>
                  <span>{order.table_name}</span>
                </div>
              )}
              {order.customer && (
                <>
                  <div className="flex justify-between text-emerald-700">
                    <span>Customer:</span>
                    <span className="font-semibold">{order.customer.name} ({order.customer.tier || 'Member'})</span>
                  </div>
                  {order.customer.phone && <div className="flex justify-between"><span>Phone:</span><span>{order.customer.phone}</span></div>}
                </>
              )}
            </div>

            {/* Itemized List */}
            <div className="mb-3 pb-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-gray-200">
                <span className="w-1/2">Item</span>
                <span className="w-1/4 text-center">Qty</span>
                <span className="w-1/4 text-right">Total</span>
              </div>

              <div className="divide-y divide-gray-100">
                {order.items?.map((item, idx) => {
                  const qty = item.quantity || 1;
                  const price = Number(item.price || 0);
                  const lineTotal = (qty * price).toFixed(2);
                  const isWeighed = item.is_weight_scale || item.unit === 'kg' || item.unit === 'g';

                  return (
                    <div key={idx} className="py-1.5 text-[11px]">
                      <div className="font-semibold truncate">{item.name || item.item_name || 'Item'}</div>
                      <div className="flex justify-between text-gray-600 text-[10px]">
                        <span>
                          {isWeighed
                            ? `${qty} ${item.unit || 'kg'} @ ${currencyPrefix}${price.toFixed(2)}/${item.unit || 'kg'}`
                            : `${qty} x ${currencyPrefix}${price.toFixed(2)}`}
                        </span>
                        <span className="font-bold text-gray-900">{currencyPrefix}{lineTotal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals Summary */}
            <div className="space-y-1 text-[11px] mb-3 pb-2 border-b border-dashed border-gray-400">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span>{currencyPrefix}{parseFloat(order.subtotal || 0).toFixed(2)}</span>
              </div>

              {orderDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount / Loyalty:</span>
                  <span>-{currencyPrefix}{orderDiscount.toFixed(2)}</span>
                </div>
              )}

              {parseFloat(order.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax:</span>
                  <span>{currencyPrefix}{parseFloat(order.tax_amount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-gray-300">
                <span>{order.status === 'Unpaid' || order.status === 'Pending' ? 'AMOUNT DUE:' : 'TOTAL:'}</span>
                <span className="text-base">{currencyPrefix}{orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-1 text-[11px] mb-4 pb-3 border-b border-dashed border-gray-400">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold">{order.payment_method === 'N/A' ? 'Pending' : order.payment_method || 'Cash'}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Tendered:</span>
                <span>{currencyPrefix}{parseFloat(order.amount_tendered ?? order.total ?? order.total_amount ?? 0).toFixed(2)}</span>
              </div>
              {order.cash_amount !== undefined && order.card_amount !== undefined && (
                <>
                  <div className="flex justify-between"><span>Cash portion:</span><span>{currencyPrefix}{Number(order.cash_amount).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Card portion:</span><span>{currencyPrefix}{Number(order.card_amount).toFixed(2)}</span></div>
                </>
              )}
              <div className="flex justify-between font-bold text-gray-900">
                <span>Change Given:</span>
                <span>{currencyPrefix}{parseFloat(order.change_due || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Barcode & Return Policy */}
            <div className="text-center space-y-2">
              <div className="flex justify-center items-center py-1 bg-white">
                {/* Visual Barcode Graphic */}
                <div className="space-y-1">
                  <div className="flex justify-center items-center gap-[2px] h-8">
                    {[3,1,2,1,4,1,2,3,1,2,4,1,3,2,1,3,1,4,2,1,2,3,1,4].map((width, i) => (
                      <span
                        key={i}
                        className="bg-black h-full inline-block"
                        style={{ width: `${width}px` }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] tracking-widest text-gray-600 font-mono font-bold">
                    *{order.order_number || order.id}*
                  </p>
                </div>
              </div>

              {isSupermarket && <p className="text-[10px] text-gray-500">Scan barcode for returns or exchanges within 14 days.</p>}
              <p className="text-[11px] font-bold text-gray-800">
                *** THANK YOU FOR VISITING ***
              </p>
              <p className="text-[9px] text-gray-400">
                Cloud & Offline Protected POS System v2.0
              </p>
            </div>
          </div>
        </div>

        {/* Print Styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: 80mm auto;
            margin: 0;
          }

          @media print {
            html,
            body {
              width: 80mm !important;
              min-width: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body * {
              visibility: hidden !important;
            }

            .thermal-receipt-overlay,
            .thermal-receipt-overlay * {
              visibility: visible !important;
            }

            .thermal-receipt-overlay {
              position: static !important;
              display: block !important;
              width: 80mm !important;
              height: auto !important;
              min-height: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              background: #fff !important;
              backdrop-filter: none !important;
            }

            .thermal-receipt-overlay > div {
              display: block !important;
              width: 80mm !important;
              max-width: none !important;
              height: auto !important;
              max-height: none !important;
              margin: 0 !important;
              overflow: visible !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }

            .thermal-receipt-actions {
              display: none !important;
            }

            .thermal-receipt-overlay > div > div:not(.thermal-receipt-actions) {
              display: block !important;
              width: 80mm !important;
              height: auto !important;
              padding: 0 !important;
              overflow: visible !important;
              background: #fff !important;
            }

            .thermal-receipt,
            .thermal-receipt * {
              visibility: visible !important;
            }

            .thermal-receipt {
              position: relative !important;
              display: block !important;
              width: 80mm;
              max-width: none;
              margin: 0 auto !important;
              padding: 4mm !important;
              box-sizing: border-box !important;
              overflow: visible !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
              color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        ` }} />
      </div>
    </div>
  );
}
