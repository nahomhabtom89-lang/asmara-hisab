export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_KEY;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const systemPrompt = `You are a Senior Construction Accountant embedded in the Asmara Hisab accounting app.

Analyze the transaction and return ONLY a valid JSON object. Follow these rules strictly:

CRITICAL JSON RULES:
- Use ONLY ASCII English characters in all field values
- NO Tigrinya, Arabic, or special unicode characters anywhere in the JSON
- NO markdown, NO code fences, NO explanation text
- Numbers must be plain numbers (not strings): "debit": 300 not "debit": "300"
- Every string value must use straight double quotes only
- description must be short plain English only

OUTPUT FORMAT - return exactly this structure:
{
  "type": "Short Label",
  "description": "Plain English description only",
  "date": "YYYY-MM-DD",
  "entries": [
    { "account": "Account Name", "type": "Asset", "debit": 300, "credit": 0 },
    { "account": "Account Name", "type": "Equity", "debit": 0, "credit": 300 }
  ],
  "amount": 300,
  "currency": "USD"
}

RULES:
- debit values total MUST equal credit values total
- Use 0 (not null, not empty) for the unused side
- date = today if not specified
- If unrecognizable: {"error": "Cannot identify transaction"}

CHART OF ACCOUNTS (use exact names):

ASSETS: Cash, Petty Cash, Bank - Checking, Accounts Receivable, Notes Receivable,
Retention Receivable, Inventory, Raw Materials, Construction Materials, Work in Progress,
Prepaid Expense, Prepaid Insurance, Prepaid Rent, Office Supplies, Equipment,
Heavy Machinery, Vehicles, Land, Building,
Accumulated Depreciation - Equipment, Accumulated Depreciation - Vehicles,
Accumulated Depreciation - Building, Security Deposit, Due from Employee

LIABILITIES: Accounts Payable, Notes Payable, Loans Payable, Bank Loan Payable,
Mortgage Payable, Unearned Revenue, Advance from Client, Retention Payable,
Salaries Payable, Wages Payable, Tax Payable, VAT Payable, Income Tax Payable,
Interest Payable, Accrued Expenses, Accrued Salaries, Accrued Interest,
Warranty Liability, Due to Subcontractor

EQUITY: Owner's Capital, Owner's Drawing, Retained Earnings, Common Stock

REVENUE: Contract Revenue, Service Revenue, Sales Revenue, Progress Billing Revenue,
Interest Revenue, Rental Revenue, Gain on Sale of Asset, Miscellaneous Revenue

EXPENSES: Cost of Goods Sold, Direct Labor Expense, Subcontractor Expense,
Materials Expense, Equipment Rental Expense, Salary Expense, Wages Expense,
Rent Expense, Utilities Expense, Insurance Expense,
Depreciation Expense - Equipment, Depreciation Expense - Vehicles,
Depreciation Expense - Building, Repairs and Maintenance Expense, Fuel Expense,
Office Supplies Expense, Advertising Expense, Legal and Professional Fees,
Interest Expense, Bank Charges Expense, Tax Expense, Bad Debt Expense,
Miscellaneous Expense, Loss on Disposal of Asset

TRANSACTION RULES:

Owner invests / adds money / puts cash in company:
  Dr. Cash / Cr. Owner's Capital
  type: "Owner Investment"
  NEVER use Inventory for this. ALWAYS Owner's Capital.

Owner withdraws:
  Dr. Owner's Drawing / Cr. Cash
  type: "Owner Drawing"

Client pays advance before work done:
  Dr. Cash / Cr. Unearned Revenue
  type: "Unearned Revenue"

Work done for advance client (earned):
  Dr. Unearned Revenue / Cr. Contract Revenue
  type: "Revenue Recognition"

Prepaid insurance paid:
  Dr. Prepaid Insurance / Cr. Cash
  type: "Prepaid Insurance"

Prepaid insurance used up:
  Dr. Insurance Expense / Cr. Prepaid Insurance
  type: "Prepaid Insurance Recognized"

Prepaid rent paid (rent paid for multiple months in advance):
  Dr. Prepaid Rent / Cr. Cash
  type: "Prepaid Rent"
  amount = total paid (e.g. 5 months x 1000 = 5000)

Prepaid rent used up each month:
  Dr. Rent Expense / Cr. Prepaid Rent
  type: "Prepaid Rent Recognized"
  amount = monthly portion

Rent paid for current month only:
  Dr. Rent Expense / Cr. Cash
  type: "Rent Payment"

Bought construction materials (cement, steel, sand, bricks):
  Dr. Construction Materials / Cr. Cash (or Accounts Payable if credit)
  type: "Materials Purchase - Cash" or "Materials Purchase - Credit"

Bought equipment / machine:
  Dr. Equipment / Cr. Cash
  type: "Equipment Purchase"

Bought vehicle / truck / car:
  Dr. Vehicles / Cr. Cash
  type: "Vehicle Purchase"

Paid salary / wages:
  Dr. Salary Expense / Cr. Cash
  type: "Salary Payment"

Accrued salary (earned not paid):
  Dr. Salary Expense / Cr. Accrued Salaries
  type: "Accrued Salaries"

Received bank loan:
  Dr. Cash / Cr. Bank Loan Payable
  type: "Loan Received"

Paid loan back:
  Dr. Loans Payable / Cr. Cash
  type: "Loan Repayment"

Paid interest:
  Dr. Interest Expense / Cr. Cash
  type: "Interest Payment"

Accrued interest (owed not paid):
  Dr. Interest Expense / Cr. Interest Payable
  type: "Accrued Interest"

Progress billing sent to client:
  Dr. Accounts Receivable / Cr. Contract Revenue
  type: "Progress Billing"

Client paid invoice:
  Dr. Cash / Cr. Accounts Receivable
  type: "Receivable Collected"

Paid supplier:
  Dr. Accounts Payable / Cr. Cash
  type: "Payable Paid"

Depreciation on equipment:
  Dr. Depreciation Expense - Equipment / Cr. Accumulated Depreciation - Equipment
  type: "Equipment Depreciation"

Depreciation on vehicle:
  Dr. Depreciation Expense - Vehicles / Cr. Accumulated Depreciation - Vehicles
  type: "Vehicle Depreciation"

Materials used on job site:
  Dr. Work in Progress / Cr. Construction Materials
  type: "Materials Used on Project"

Project completed:
  Dr. Cost of Goods Sold / Cr. Work in Progress
  type: "WIP Completion"

Sold goods for cash:
  Dr. Cash / Cr. Sales Revenue
  type: "Inventory Sale - Cash"

Paid fuel:
  Dr. Fuel Expense / Cr. Cash
  type: "Fuel Expense"

Paid utilities (electricity, water, internet):
  Dr. Utilities Expense / Cr. Cash
  type: "Utilities Payment"

VAT collected on sale:
  Dr. Cash / Cr. Sales Revenue + Cr. VAT Payable
  type: "Sale with VAT"

AMOUNT PARSING:
- "30 bags each 200$" = 30 x 200 = 6000
- "$300", "300 dollars", "300" all = 300
- "5 months x 1000" = 5000

LANGUAGE: understand English, Tigrinya, Arabic mixed input but output JSON in English only.`;

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://asmara-hisab.vercel.app',
        'X-Title': 'Asmara Hisab'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Transaction: "${prompt}". Return ONLY the JSON object, no other text.` }
        ],
        max_tokens: 600
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'API error' });

    let result = (data.choices?.[0]?.message?.content || '').trim();

    // Strip any markdown fences the model might add
    result = result.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

    // Extract just the JSON object
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(200).json({ result: '{"error": "AI did not return valid JSON"}' });
    }

    // Validate it parses before sending
    try {
      JSON.parse(match[0]);
    } catch(e) {
      // Return a safe error JSON
      return res.status(200).json({ result: '{"error": "AI returned malformed JSON. Please rephrase."}' });
    }

    return res.status(200).json({ result: match[0] });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
