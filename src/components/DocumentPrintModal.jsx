import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * DocumentPrintModal Component
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - documentType: 'receipt_command' | 'receipt_fiscal' | 'invoice_nir'
 * - data: object (order, payment or invoice details)
 */
export default function DocumentPrintModal({ isOpen, onClose, documentType, data }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  // Helper calculations for VAT & Net prices based on department
  const getVatRateForProduct = (item) => {
    // If it's a NIR item, it has vat_rate directly
    if (item.vat_rate !== undefined) return parseInt(item.vat_rate);
    // If it's an order item, determine by category's department
    const dept = item.product?.category?.department || 'kitchen';
    return dept === 'bar' ? 21 : 11;
  };

  const renderCommandReceipt = (isPrintWrapper = false) => {
    const order = data.order_details || data; // handle payment object or direct order
    const items = (data.items || order.items || []).filter(i => i.status !== 'rejected');
    const tableNumber = order.table_number || order.session?.table?.number || '?';
    const waiterName = data.collected_by_username || sessionStorage.getItem('waiter_username') || 'Sistem';
    const dateStr = new Date(order.created_at || Date.now()).toLocaleString('ro-RO');

    return (
      <div className="receipt-thermal">
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>
          *** BON DE COMANDĂ ***
        </div>
        <div className="dashed-line" />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>MASA: {tableNumber}</span>
          <span>COMANDA: #{order.id}</span>
        </div>
        <div>DATA: {dateStr}</div>
        <div>OSPATAR: {waiterName}</div>
        <div className="dashed-line" />
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>PRODUSE:</div>
        {items.map((item, idx) => (
          <div key={item.id || idx} style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>{item.quantity} x {item.product?.name || item.product_name}</span>
            </div>
            {item.notes && (
              <div style={{ fontSize: '8.5pt', fontStyle: 'italic', paddingLeft: '8px' }}>
                * {item.notes}
              </div>
            )}
          </div>
        ))}
        <div className="dashed-line" />
        <div style={{ textAlign: 'center', fontSize: '9pt', marginTop: '10px' }}>
          -- DESTINAT PREPARĂRII --
        </div>
      </div>
    );
  };

  const renderFiscalReceipt = (isPrintWrapper = false) => {
    // data can be the Payment object
    const payment = data;
    const order = payment.order_details || {};
    const items = (payment.items || order.items || []).filter(i => i.status !== 'rejected');
    const tableNumber = order.table_number || order.session?.table?.number || '?';
    const waiterName = payment.collected_by_username || sessionStorage.getItem('waiter_username') || 'Sistem';
    const dateStr = new Date(payment.created_at || Date.now()).toLocaleString('ro-RO');
    
    const amount = parseFloat(payment.amount || 0);
    const tip = parseFloat(payment.tip || 0);
    const totalPay = amount + tip;
    
    // Group and calculate VAT rates
    let vatTotals = {
      11: { net: 0, vat: 0, gross: 0 },
      21: { net: 0, vat: 0, gross: 0 }
    };

    items.forEach(item => {
      const price = parseFloat(item.unit_price || 0);
      const qty = parseFloat(item.quantity || 0);
      const itemGross = price * qty;
      const rate = getVatRateForProduct(item);
      
      const rateKey = rate === 21 ? 21 : 11;
      const calculatedNet = itemGross / (1 + rateKey / 100);
      const calculatedVat = itemGross - calculatedNet;
      
      vatTotals[rateKey].gross += itemGross;
      vatTotals[rateKey].net += calculatedNet;
      vatTotals[rateKey].vat += calculatedVat;
    });

    const methodLabels = {
      cash: 'NUMERAR',
      card: 'CARD',
      ticket: 'TICHET'
    };

    return (
      <div className="receipt-thermal">
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>
          RESTAURANT PLATFORM S.R.L.
        </div>
        <div style={{ textAlign: 'center', fontSize: '8.5pt' }}>
          Str. Principala Nr. 10, Cluj-Napoca
        </div>
        <div style={{ textAlign: 'center', fontSize: '8.5pt' }}>
          C.U.I.: RO987654321 | Reg.Com: J40/12345/2025
        </div>
        <div className="dashed-line" />
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', margin: '4px 0' }}>
          *** BON FISCAL ***
        </div>
        {payment.is_copy && (
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '4px 0', border: '2px solid #000', padding: '4px' }}>
            * COPIE *
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>MASA: {tableNumber}</span>
          <span>OPERATOR: {waiterName}</span>
        </div>
        <div>DATA: {dateStr}</div>
        <div className="dashed-line" />
        
        {items.map((item, idx) => {
          const qty = parseFloat(item.quantity || 0);
          const price = parseFloat(item.unit_price || 0);
          const totalVal = qty * price;
          const rateChar = getVatRateForProduct(item) === 21 ? 'B' : 'A';
          return (
            <div key={item.id || idx} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold' }}>{item.product?.name || item.product_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px' }}>
                <span>{qty.toFixed(3)} x {price.toFixed(2)} lei</span>
                <span>{totalVal.toFixed(2)} {rateChar}</span>
              </div>
            </div>
          );
        })}
        
        <div className="dashed-line" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11pt' }}>
          <span>TOTAL CONSUMATIE:</span>
          <span>{amount.toFixed(2)} lei</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>BACSIS (TIP):</span>
          <span>{tip.toFixed(2)} lei</span>
        </div>
        <div className="double-dashed-line" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13pt' }}>
          <span>TOTAL PLATA:</span>
          <span>{totalPay.toFixed(2)} lei</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '4px' }}>
          <span>METODA DE PLATA:</span>
          <span>{methodLabels[payment.method] || 'NUMERAR'}</span>
        </div>
        
        <div className="dashed-line" />
        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', marginBottom: '2px' }}>DEFALCARE TAXE (TVA):</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontWeight: 'bold' }}>
          <span>Cota / Val. Brut</span>
          <span>Val. Net</span>
          <span>Val. TVA</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt' }}>
          <span>A (11%): {vatTotals[11].gross.toFixed(2)}</span>
          <span>{vatTotals[11].net.toFixed(2)}</span>
          <span>{vatTotals[11].vat.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt' }}>
          <span>B (21%): {vatTotals[21].gross.toFixed(2)}</span>
          <span>{vatTotals[21].net.toFixed(2)}</span>
          <span>{vatTotals[21].vat.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px' }}>
          <span>TOTAL: {(vatTotals[11].gross + vatTotals[21].gross).toFixed(2)}</span>
          <span>{(vatTotals[11].net + vatTotals[21].net).toFixed(2)}</span>
          <span>{(vatTotals[11].vat + vatTotals[21].vat).toFixed(2)}</span>
        </div>
        
        <div className="dashed-line" />
        <div style={{ textAlign: 'center', fontSize: '8.5pt' }}>
          CASA DE MARCAT: E12345678-0001
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt' }}>
          <span>BON NR: {(payment.id || 0).toString().padStart(4, '0')}</span>
          <span>SERIA: RF{(payment.id || 0).toString().padStart(6, '0')}</span>
        </div>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', marginTop: '12px' }}>
          BON FISCAL
        </div>
        <div style={{ textAlign: 'center', fontSize: '9pt', marginTop: '6px', fontStyle: 'italic' }}>
          *** VA MULTUMIM PENTRU VIZITA! ***
        </div>
      </div>
    );
  };

  const renderNIR = (isPrintWrapper = false) => {
    const invoice = data;
    const items = invoice.items || [];
    
    // Group totals
    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;

    items.forEach(item => {
      const qty = parseFloat(item.quantity || 0);
      const priceNet = parseFloat(item.unit_price_without_vat || 0);
      const valNet = qty * priceNet;
      const rate = parseInt(item.vat_rate || 9);
      const valVat = valNet * (rate / 100);
      const valGross = valNet + valVat;

      totalNet += valNet;
      totalVat += valVat;
      totalGross += valGross;
    });

    const dateStr = new Date(invoice.date || Date.now()).toLocaleDateString('ro-RO');

    return (
      <div className="invoice-a4">
        {/* NIR Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '10px' }}>
          <div style={{ width: '48%' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>UNITATEA BENEFICIARĂ:</div>
            <div style={{ fontWeight: '800', fontSize: '12pt' }}>RESTAURANT PLATFORM S.R.L.</div>
            <div>C.U.I.: RO987654321</div>
            <div>Adresă: Str. Principală Nr. 10, Cluj-Napoca</div>
            <div>Punct lucru: Gestiune Restaurant</div>
          </div>
          <div style={{ width: '48%', borderLeft: '1px solid #000000', paddingLeft: '15px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>FURNIZOR:</div>
            <div style={{ fontWeight: '800', fontSize: '12pt' }}>{invoice.supplier_name || invoice.supplier?.name || 'Fără Furnizor'}</div>
            {invoice.supplier && (
              <>
                <div>C.U.I.: {invoice.supplier.cui || '-'}</div>
                <div>Reg. Com.: {invoice.supplier.reg_com || '-'}</div>
                <div>Adresă: {invoice.supplier.address || '-'}</div>
              </>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: '14pt', fontWeight: '800', textDecoration: 'underline' }}>
            NOTĂ DE RECEPȚIE ȘI CONSTATARE DE DIFERENȚE (NIR)
          </div>
          <div style={{ fontSize: '11pt', marginTop: '6px', fontWeight: 'bold' }}>
            Număr NIR: {invoice.nir_number || `Nespecificat (${invoice.id})`} | Data: {dateStr}
          </div>
          <div style={{ fontSize: '9pt', color: '#555555', fontStyle: 'italic', marginTop: '4px' }}>
            Aferent facturii / documentului însoțitor nr: {invoice.invoice_number} din {dateStr}
          </div>
        </div>

        {/* Items Table */}
        <table>
          <thead>
            <tr>
              <th style={{ width: '5%', textAlign: 'center' }}>Nr. crt.</th>
              <th style={{ width: '35%' }}>Denumirea mărfurilor / Ingredient</th>
              <th style={{ width: '8%', textAlign: 'center' }}>U.M.</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Cant. doc.</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Cant. rec.</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Preț unit. (fără TVA)</th>
              <th style={{ width: '11%', textAlign: 'right' }}>Val. net (fără TVA)</th>
              <th style={{ width: '7%', textAlign: 'center' }}>TVA (%)</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Valoare TVA</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Total (cu TVA)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const qty = parseFloat(item.quantity || 0);
              const priceNet = parseFloat(item.unit_price_without_vat || 0);
              const valNet = qty * priceNet;
              const rate = parseInt(item.vat_rate || 9);
              const valVat = valNet * (rate / 100);
              const valGross = valNet + valVat;
              const ingredientName = item.ingredient_name || item.ingredient?.name || 'Ingredient';
              const ingredientUm = item.ingredient_um || item.ingredient?.unit_of_measure || 'buc';

              return (
                <tr key={item.id || index}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ fontWeight: '600' }}>{ingredientName}</td>
                  <td style={{ textAlign: 'center' }}>{ingredientUm}</td>
                  <td style={{ textAlign: 'right' }}>{qty.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{qty.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{priceNet.toFixed(4)}</td>
                  <td style={{ textAlign: 'right' }}>{valNet.toFixed(2)}</td>
                  <td style={{ textAlign: 'center' }}>{rate}%</td>
                  <td style={{ textAlign: 'right' }}>{valVat.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{valGross.toFixed(2)}</td>
                </tr>
              );
            })}
            
            {/* Grand Totals */}
            <tr style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
              <td colSpan="3" style={{ textAlign: 'right' }}>TOTAL GESTIUNE:</td>
              <td colSpan="3"></td>
              <td style={{ textAlign: 'right' }}>{totalNet.toFixed(2)}</td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{totalVat.toFixed(2)}</td>
              <td style={{ textAlign: 'right', fontSize: '9.5pt', color: '#000' }}>{totalGross.toFixed(2)} lei</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', borderTop: '1px solid #dddddd', paddingTop: '20px' }}>
          <div style={{ width: '45%', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>Comisia de Recepție:</div>
            <div style={{ borderTop: '1px dashed #000000', width: '80%', margin: '0 auto', fontSize: '9pt', color: '#555555' }}>
              Nume, prenume și semnătură
            </div>
          </div>
          <div style={{ width: '45%', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '35px' }}>Gestionar primitor:</div>
            <div style={{ borderTop: '1px dashed #000000', width: '80%', margin: '0 auto', fontSize: '9pt', color: '#555555' }}>
              Nume, prenume și semnătură
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (documentType) {
      case 'receipt_command':
        return renderCommandReceipt();
      case 'receipt_fiscal':
        return renderFiscalReceipt();
      case 'invoice_nir':
        return renderNIR();
      default:
        return null;
    }
  };

  const renderPrintContent = () => {
    switch (documentType) {
      case 'receipt_command':
        return renderCommandReceipt(true);
      case 'receipt_fiscal':
        return renderFiscalReceipt(true);
      case 'invoice_nir':
        return renderNIR(true);
      default:
        return null;
    }
  };

  // Render on-screen modal layout
  const modalDOM = (
    <div style={backdropStyle} className="no-print">
      <div style={modalContainerStyle}>
        
        {/* Left Side: Controls & Guidance */}
        <div style={leftPanelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '28px' }}>🖨️</span>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                Tipărire Document
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                Simulare printare & export PDF
              </p>
            </div>
          </div>
          
          <div style={guideBoxStyle}>
            <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '6px', color: '#4f46e5' }}>
              💡 Sfaturi pentru Export PDF:
            </div>
            <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '12.5px', color: '#475569', display: 'grid', gap: '6px' }}>
              <li>Selectează <b>"Salvare ca PDF"</b> (Save as PDF) la destinația imprimantei din fereastra de print.</li>
              <li>Pentru <b>NIR</b>: alege orientarea <b>Portret</b> și formatul de pagină <b>A4</b>.</li>
              <li>Pentru <b>Bonuri</b>: alege lățimea corespunzătoare sau activează <b>"Margini: Niciuna"</b> pentru layout curat.</li>
              <li>Verifică ca opțiunea <b>"Grafică de fundal"</b> (Background graphics) să fie activată pentru culorile tabelului NIR.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: 'auto' }}>
            <button style={printButtonStyle} onClick={handlePrint}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Deschide Dialog Print / PDF
            </button>
            <button style={closeButtonStyle} onClick={onClose}>
              Închide Previzualizarea
            </button>
          </div>
        </div>

        {/* Right Side: Visual Document Preview Sheet */}
        <div style={rightPanelStyle}>
          <div style={previewHeaderStyle}>
            <span style={pillStyle}>PREVIZUALIZARE REALĂ</span>
            <button style={circleCloseStyle} onClick={onClose}>✕</button>
          </div>
          
          <div style={sheetContainerStyle}>
            <div style={documentSheetStyle(documentType)}>
              {renderContent()}
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  // We render the printable content in the hidden #print-area-wrapper container
  // So when print is triggered, this exact HTML is formatted on paper/PDF.
  const printWrapperDOM = (
    <div id="print-area-wrapper">
      {renderPrintContent()}
    </div>
  );

  return (
    <>
      {modalDOM}
      {ReactDOM.createPortal(printWrapperDOM, document.body)}
    </>
  );
}

// Inline Styles for On-screen Glassmorphic Preview
const backdropStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  boxSizing: 'border-box',
};

const modalContainerStyle = {
  width: '100%',
  maxWidth: '1050px',
  height: '85vh',
  maxHeight: '750px',
  background: 'rgba(255, 255, 255, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
  borderRadius: '20px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
  display: 'flex',
  overflow: 'hidden',
  animation: 'modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const leftPanelStyle = {
  width: '350px',
  borderRight: '1px solid #e2e8f0',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  background: '#f8fafc',
};

const guideBoxStyle = {
  background: '#e0e7ff',
  border: '1px solid #c7d2fe',
  borderRadius: '12px',
  padding: '16px',
  marginTop: '16px',
  boxSizing: 'border-box',
};

const rightPanelStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  background: '#cbd5e1', // grey blueprint contrast background
  position: 'relative',
  height: '100%',
};

const previewHeaderStyle = {
  height: '56px',
  background: '#ffffff',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  boxSizing: 'border-box',
};

const pillStyle = {
  background: '#10b981',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: '800',
  padding: '4px 10px',
  borderRadius: '9999px',
  letterSpacing: '0.05em',
};

const circleCloseStyle = {
  width: '30px',
  height: '30px',
  borderRadius: '50%',
  background: '#f1f5f9',
  border: 'none',
  fontSize: '12px',
  fontWeight: '700',
  color: '#475569',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
  outline: 'none',
};

const sheetContainerStyle = {
  flex: 1,
  padding: '30px',
  overflowY: 'auto',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  boxSizing: 'border-box',
};

const documentSheetStyle = (type) => ({
  background: '#ffffff',
  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
  padding: type === 'invoice_nir' ? '25px' : '16px',
  boxSizing: 'border-box',
  width: type === 'invoice_nir' ? '700px' : '320px',
  borderRadius: type === 'invoice_nir' ? '4px' : '8px',
  position: 'relative',
  border: type === 'invoice_nir' ? '1px solid #94a3b8' : 'none',
});

const printButtonStyle = {
  background: 'linear-gradient(135deg, #4f46e5, #3730a3)',
  color: '#ffffff',
  padding: '14px 20px',
  borderRadius: '12px',
  fontSize: '14.5px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  border: 'none',
  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
  transition: 'all 0.2s',
};

const closeButtonStyle = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  color: '#475569',
  padding: '12px 20px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s',
  textAlign: 'center',
};
