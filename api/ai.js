export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, mode, context } = req.body;
    const apiKey = process.env.GEMINI_KEY;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    // ── MODE: business advisor ──
    if (mode === 'advisor') {
      const advisorSystem = `You are a smart business advisor and accountant for a construction company using the Asmara Hisab app.
You have access to the business financial data provided in the context.
Answer questions about inventory, finances, profits, project costs, and give practical business advice.
Be concise, friendly, and specific with numbers from the context.
Answer in the same language the user writes in (English or Tigrinya).
If asked about inventory (tomatoes, cement, steel etc), check the inventory context and give exact quantities.
Always respond in plain text, no markdown, no JSON.`;

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
            { role: 'system', content: advisorSystem },
            { role: 'user', content: `Business Data:\n${context||'No data yet'}\n\nUser Question: ${prompt}` }
          ],
          max_tokens: 500
        })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'API error' });
      return res.status(200).json({ result: data.choices?.[0]?.message?.content || '' });
    }

    // ── MODE: accounting (default) ──
    const systemPrompt = `You are a Senior Construction Accountant in the Asmara Hisab app.

Analyze the transaction and return ONLY a valid JSON object.

CRITICAL RULES:
- Use ONLY ASCII English characters — NO Tigrinya, Arabic, or special unicode anywhere in JSON
- NO markdown, NO code fences, NO explanation — just the raw JSON object
- Numbers must be plain numbers: "debit": 300 not "debit": "300"
- The "type" field in entries must be EXACTLY one of: "asset", "liability", "equity", "revenue", "expense" (all lowercase)
- description must be short plain English only

OUTPUT FORMAT:
{
  "type": "Short Label",
  "description": "Plain English description",
  "date": "YYYY-MM-DD",
  "entries": [
    { "account": "Account Name", "type": "asset", "debit": 300, "credit": 0 },
    { "account": "Account Name", "type": "equity", "debit": 0, "credit": 300 }
  ],
  "amount": 300,
  "currency": "USD"
}

RULES:
- debit total MUST equal credit total exactly
- Use 0 for unused side, never null or empty string
- date = today if not specified
- If unrecognizable: {"error": "Cannot identify transaction"}

ACCOUNT TYPE MAPPING:
- Cash, Bank, Receivable, Inventory, Equipment, Vehicles, Land, Building, Prepaid, WIP = "asset"
- Payable, Loan, Unearned Revenue, Accrued accounts = "liability"
- Owner Capital, Owner Drawing, Retained Earnings = "equity"
- Sales Revenue, Contract Revenue, Service Revenue, Interest Revenue = "revenue"
- ALL expense accounts (Salary, Rent, Depreciation, COGS, Fuel, Utilities etc) = "expense"

CHART OF ACCOUNTS:
ASSETS: Cash, Petty Cash, Bank - Checking, Accounts Receivable, Notes Receivable,
Retention Receivable, Inventory, Raw Materials, Construction Materials, Work in Progress,
Prepaid Expense, Prepaid Insurance, Prepaid Rent, Office Supplies, Equipment,
Heavy Machinery, Vehicles, Land, Building,
Accumulated Depreciation - Equipment, Accumulated Depreciation - Vehicles,
Accumulated Depreciation - Building, Security Deposit, Due from Employee

LIABILITIES: Accounts Payable, Notes Payable, Loans Payable, Bank Loan Payable,
Mortgage Payable, Unearned Revenue, Advance from Client, Retention Payable,
Salaries Payable, Wages Payable, Tax Payable, VAT Payable, Income Tax Payable,
Interest Payable, Accrued Expenses, Accrued Salaries, Accrued Interest, Due to Subcontractor

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
Owner invests/adds money: Dr. Cash (asset) / Cr. Owner's Capital (equity) — type: "Owner Investment"
Owner withdraws: Dr. Owner's Drawing (equity) / Cr. Cash (asset) — type: "Owner Drawing"
Paid salary: Dr. Salary Expense (expense) / Cr. Cash (asset) — type: "Salary Payment"
Accrued salary: Dr. Salary Expense (expense) / Cr. Accrued Salaries (liability) — type: "Accrued Salaries"
Paid rent current month: Dr. Rent Expense (expense) / Cr. Cash (asset) — type: "Rent Payment"
Prepaid rent multiple months: Dr. Prepaid Rent (asset) / Cr. Cash (asset) — type: "Prepaid Rent"
Prepaid rent used: Dr. Rent Expense (expense) / Cr. Prepaid Rent (asset) — type: "Prepaid Rent Recognized"
Prepaid insurance paid: Dr. Prepaid Insurance (asset) / Cr. Cash (asset) — type: "Prepaid Insurance"
Prepaid insurance used: Dr. Insurance Expense (expense) / Cr. Prepaid Insurance (asset) — type: "Prepaid Insurance Recognized"
Client advance: Dr. Cash (asset) / Cr. Unearned Revenue (liability) — type: "Unearned Revenue"
Revenue earned from advance: Dr. Unearned Revenue (liability) / Cr. Contract Revenue (revenue) — type: "Revenue Recognition"
Bought materials cash: Dr. Construction Materials (asset) / Cr. Cash (asset) — type: "Materials Purchase - Cash"
Bought materials credit: Dr. Construction Materials (asset) / Cr. Accounts Payable (liability) — type: "Materials Purchase - Credit"
Materials used on site: Dr. Work in Progress (asset) / Cr. Construction Materials (asset) — type: "Materials Used on Project"
Project complete: Dr. Cost of Goods Sold (expense) / Cr. Work in Progress (asset) — type: "WIP Completion"
Bought equipment cash: Dr. Equipment (asset) / Cr. Cash (asset) — type: "Equipment Purchase"
Bought vehicle: Dr. Vehicles (asset) / Cr. Cash (asset) — type: "Vehicle Purchase"
Bank loan: Dr. Cash (asset) / Cr. Bank Loan Payable (liability) — type: "Loan Received"
Repaid loan: Dr. Loans Payable (liability) / Cr. Cash (asset) — type: "Loan Repayment"
Paid interest: Dr. Interest Expense (expense) / Cr. Cash (asset) — type: "Interest Payment"
Progress billing: Dr. Accounts Receivable (asset) / Cr. Contract Revenue (revenue) — type: "Progress Billing"
Client paid invoice: Dr. Cash (asset) / Cr. Accounts Receivable (asset) — type: "Receivable Collected"
Paid supplier: Dr. Accounts Payable (liability) / Cr. Cash (asset) — type: "Payable Paid"
Equipment depreciation: Dr. Depreciation Expense - Equipment (expense) / Cr. Accumulated Depreciation - Equipment (asset) — type: "Equipment Depreciation"
Vehicle depreciation: Dr. Depreciation Expense - Vehicles (expense) / Cr. Accumulated Depreciation - Vehicles (asset) — type: "Vehicle Depreciation"
Paid fuel: Dr. Fuel Expense (expense) / Cr. Cash (asset) — type: "Fuel Expense"
Paid utilities: Dr. Utilities Expense (expense) / Cr. Cash (asset) — type: "Utilities Payment"
Paid subcontractor: Dr. Subcontractor Expense (expense) / Cr. Cash (asset) — type: "Subcontractor Payment"
Sold goods cash: Dr. Cash (asset) / Cr. Sales Revenue (revenue) — type: "Cash Sale"
Sold goods credit: Dr. Accounts Receivable (asset) / Cr. Sales Revenue (revenue) — type: "Credit Sale"

AMOUNT PARSING:
- "30 bags each 200$" = 6000
- "5 months x 1000" = 5000
- "$300", "300 dollars", "300" = 300

LANGUAGE: Understand English, Tigrinya, Arabic. Output JSON in English only.`;

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
          { role: 'user', content: `Transaction: "${prompt}". Return ONLY the JSON object, nothing else.` }
        ],
        max_tokens: 600
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'API error' });

    let result = (data.choices?.[0]?.message?.content || '').trim();
    result = result.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ result: '{"error": "AI did not return valid JSON"}' });

    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        parsed.entries = parsed.entries.map(e => ({ ...e, type: (e.type || 'asset').toLowerCase() }));
      }
      return res.status(200).json({ result: JSON.stringify(parsed) });
    } catch(e) {
      return res.status(200).json({ result: '{"error": "AI returned malformed JSON. Please rephrase."}' });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
