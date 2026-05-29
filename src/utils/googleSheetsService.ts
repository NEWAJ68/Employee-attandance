/**
 * Google Sheets API v4 Integration Service
 * Provides direct client-side synchronization between local state and custom user Google Spreadsheets.
 */

export async function ensureSheetsExist(accessToken: string, spreadsheetId: string) {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      console.warn('Could not inspect spreadsheet metadata: ', await response.text());
      return;
    }
    const data = await response.json();
    const existingTitles = (data.sheets || []).map((s: any) => s.properties?.title || "");
    
    const requiredSheets = ['Attendance', 'Employees', 'Settings'];
    const missingSheets = requiredSheets.filter(title => !existingTitles.includes(title));
    
    if (missingSheets.length > 0) {
      const batchResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: missingSheets.map(title => ({
            addSheet: {
              properties: {
                title
              }
            }
          }))
        })
      });
      if (!batchResponse.ok) {
        console.error('Failed to automatically create missing sheets:', await batchResponse.text());
      } else {
        console.log('Successfully auto-created missing sheets:', missingSheets);
      }
    }
  } catch (err) {
    console.error('Error in ensureSheetsExist helper:', err);
  }
}

export async function clearSpreadsheetRange(accessToken: string, spreadsheetId: string, range: string) {
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.warn('Silent range clear failed: ', err);
  }
}

export async function createSpreadsheet(accessToken: string, titleStr: string): Promise<string> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: titleStr
      },
      sheets: [
        { properties: { title: 'Attendance' } },
        { properties: { title: 'Employees' } },
        { properties: { title: 'Settings' } }
      ]
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create spreadsheet: ${err}`);
  }
  
  const data = await response.json();
  return data.spreadsheetId;
}

export async function syncEmployeesToSheet(accessToken: string, spreadsheetId: string, employees: any[]) {
  await ensureSheetsExist(accessToken, spreadsheetId);
  const headers = ["Employee ID", "Employee Name", "Department", "Email", "Hourly Rate", "Joined Date", "Status"];
  const rows = [headers, ...employees.map(emp => [
    emp.id || "",
    emp.name || "",
    emp.department || "",
    emp.email || "",
    emp.hourlyRate || 0,
    emp.joinedDate || "",
    emp.status || ""
  ])];
  
  await clearSpreadsheetRange(accessToken, spreadsheetId, 'Employees!A1:G2000');
  
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Employees!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: 'Employees!A1',
      majorDimension: 'ROWS',
      values: rows
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update employees on spreadsheet: ${err}`);
  }
}

export async function syncSettingsToSheet(accessToken: string, spreadsheetId: string, settings: any) {
  await ensureSheetsExist(accessToken, spreadsheetId);
  const rows = [
    ["Key", "Value"],
    ["companyName", settings.companyName || ""],
    ["standardHours", settings.standardHours || 8],
    ["lunchDurationMinutes", settings.lunchDurationMinutes || 60],
    ["overtimeRateMultiplier", settings.overtimeRateMultiplier || 1.5],
    ["workStartHour", settings.workStartHour || "09:00"],
    ["workEndHour", settings.workEndHour || "17:00"],
    ["currency", settings.currency || "INR"]
  ];
  
  await clearSpreadsheetRange(accessToken, spreadsheetId, 'Settings!A1:B30');
  
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Settings!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: 'Settings!A1',
      majorDimension: 'ROWS',
      values: rows
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to update system settings on spreadsheet: ${err}`);
  }
}

export async function syncAttendanceRecordToSheet(accessToken: string, spreadsheetId: string, record: any) {
  await ensureSheetsExist(accessToken, spreadsheetId);
  // 1. Fetch current rows to check/match
  const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Attendance!A1:N5000`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  let rows: string[][] = [];
  if (getRes.ok) {
    const data = await getRes.json();
    rows = data.values || [];
  }
  
  if (rows.length === 0) {
    const headers = ["Date", "Employee ID", "Employee Name", "Entry Time", "Lunch Out", "Lunch In", "Exit Time", "Total Hours", "Overtime", "Status", "Entry Time 2", "Exit Time 2", "Dinner Out", "Dinner In"];
    rows = [headers];
  }
  
  const recDateStr = record.date;
  const recEmpId = record.employeeId;
  
  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0] === recDateStr && row[1]?.toString() === recEmpId.toString()) {
      targetRowIndex = i + 1;
      break;
    }
  }
  
  const recordValues = [
    record.date || "",
    record.employeeId || "",
    record.employeeName || "",
    record.entryTime || "",
    record.lunchOut || "",
    record.lunchIn || "",
    record.exitTime || "",
    record.totalHours !== undefined ? record.totalHours : "0",
    record.overtime !== undefined ? record.overtime : "0",
    record.status || "",
    record.entryTime2 || "",
    record.exitTime2 || "",
    record.dinnerOut || "",
    record.dinnerIn || ""
  ];
  
  if (targetRowIndex > -1) {
    const putRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Attendance!A${targetRowIndex}:N${targetRowIndex}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `Attendance!A${targetRowIndex}:N${targetRowIndex}`,
        majorDimension: 'ROWS',
        values: [recordValues]
      })
    });
    if (!putRes.ok) {
      throw new Error(await putRes.text());
    }
  } else {
    // Append at the end of current count
    const nextRow = rows.length + 1;
    const putRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Attendance!A${nextRow}:N${nextRow}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: `Attendance!A${nextRow}:N${nextRow}`,
        majorDimension: 'ROWS',
        values: [recordValues]
      })
    });
    if (!putRes.ok) {
      throw new Error(await putRes.text());
    }
  }
}

export async function syncAllAttendanceToSheet(accessToken: string, spreadsheetId: string, attendance: any[]) {
  await ensureSheetsExist(accessToken, spreadsheetId);
  const headers = ["Date", "Employee ID", "Employee Name", "Entry Time", "Lunch Out", "Lunch In", "Exit Time", "Total Hours", "Overtime", "Status", "Entry Time 2", "Exit Time 2", "Dinner Out", "Dinner In"];
  const rows = [headers, ...attendance.map(rec => [
    rec.date || "",
    rec.employeeId || "",
    rec.employeeName || "",
    rec.entryTime || "",
    rec.lunchOut || "",
    rec.lunchIn || "",
    rec.exitTime || "",
    rec.totalHours !== undefined ? rec.totalHours : "0",
    rec.overtime !== undefined ? rec.overtime : "0",
    rec.status || "",
    rec.entryTime2 || "",
    rec.exitTime2 || "",
    rec.dinnerOut || "",
    rec.dinnerIn || ""
  ])];
  
  await clearSpreadsheetRange(accessToken, spreadsheetId, 'Attendance!A1:N5000');
  
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Attendance!A1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: 'Attendance!A1',
      majorDimension: 'ROWS',
      values: rows
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to overwrite attendance database sheet: ${err}`);
  }
}
