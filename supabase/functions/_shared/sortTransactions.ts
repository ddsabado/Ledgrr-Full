/**
 * Sorts populated transaction rows by the Date/Date-time column (B) ascending.
 * The range deliberately starts at column B so the generated Txn ID formula in
 * column A is never moved or overwritten.
 */
export async function sortTransactionsByDate(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [rowsRes, metadataRes] = await Promise.all([
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('Transactions!B2:B')}`, { headers }),
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers }),
  ])
  if (!rowsRes.ok || !metadataRes.ok) throw new Error('Failed to read transaction sort range')
  const rows = (await rowsRes.json()) as { values?: string[][] }
  const metadata = (await metadataRes.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] }
  const rowCount = rows.values?.length ?? 0
  if (rowCount < 2) return
  const sheet = metadata.sheets?.find((item) => item.properties?.title === 'Transactions')
  const sheetId = sheet?.properties?.sheetId
  if (sheetId == null) throw new Error('Transactions sheet not found')

  const sortRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        sortRange: {
          // Row 1 is the header; rows are zero-based, so row 2 is index 1.
          range: { sheetId, startRowIndex: 1, endRowIndex: rowCount + 1, startColumnIndex: 1, endColumnIndex: 12 },
          sortSpecs: [{ dimensionIndex: 1, sortOrder: 'ASCENDING' }],
        },
      }],
    }),
  })
  if (!sortRes.ok) throw new Error('Failed to sort transactions')
}
