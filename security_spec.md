# Security Specification: Zero-Trust Threat Model

This document outlines the security specifications, data invariants, adversarial threat vectors ("The Dirty Dozen" payloads), and rules validation spec for the Apex Attendance & Shift Management Suite.

## 1. Data Invariants

1. **Role Separation**: Credentials and Employee rates must only be viewable/mutable by authenticated Managers/Admins, except for simple profile retrievals when a worker clocks in.
2. **Attendance Integrity**: Attendance records MUST match the employee ID currently logged in or identified on the terminal. An employee cannot clock in or edit hours on behalf of another user.
3. **No Double Punching**: An employee must follow structural check-in sequences (e.g. entry -> lunch out -> lunch in -> exit -> shift 2 entry -> exit 2).
4. **Time Veracity**: Timestamps and calculated working times must correspond to actual numbers and formats; values cannot be spoofed to inject arbitrary numbers of overtime hours.
5. **No Blind Administrative Upgrades**: Ordinary employee profiles cannot contain properties enabling them to gain administrative privileges (such as modifying `isAdmin` states or standard hours).

---

## 2. The "Dirty Dozen" Vulnerability Payloads

We design rules mathematically impossible to bypass under the following twelve threat scenarios:

### Payload 1: Admin Identity Hijacking
* **Threat**: A client attempts to write directly block settings or create an admin profile.
* **Payload**: `setDoc(doc(db, 'settings', 'global'), { companyName: 'Hacked Inc', standardHours: 0, workEndHour: '00:00' })`
* **Assertion**: `PERMISSION_DENIED` since read/write on settings is manager-locked.

### Payload 2: Ghost Employee Insertion
* **Threat**: Unauthenticated attacker attempts to register themselves as a high-paying engineer.
* **Payload**: `setDoc(doc(db, 'employees', 'CES999'), { id: 'CES999', name: 'Ghost', email: 'ghost@hacker.io', hourlyRate: 9999, status: 'Active' })`
* **Assertion**: `PERMISSION_DENIED`.

### Payload 3: Rate Hijacking
* **Threat**: Active employee attempts to update their own base hourly rate to $500/hr.
* **Payload**: `updateDoc(doc(db, 'employees', 'CES002'), { hourlyRate: 500 })`
* **Assertion**: `PERMISSION_DENIED`.

### Payload 4: Arbitrary Overtime Spawning
* **Threat**: Employee punches a log injecting 10 hours of premium overtime directly.
* **Payload**: `setDoc(doc(db, 'attendance', '2026-05-27_CES002'), { employeeId: 'CES002', date: '2026-05-27', totalHours: 20, overtime: 12, status: 'Present' })`
* **Assertion**: `PERMISSION_DENIED` because the structural schema checks, server-side temporal bounds, or admin role limits bar manually entering excessive custom overtime rates.

### Payload 5: Clock-in Spoofing
* **Threat**: User A tries to log a clock-in record under User B's Employee ID.
* **Payload**: `setDoc(doc(db, 'attendance', '2026-05-27_CES001'), { employeeId: 'CES001', date: '2026-05-27', entryTime: '08:00', status: 'Present' })` (Attempted by `request.auth.uid` corresponding to `CES002`).
* **Assertion**: `PERMISSION_DENIED`.

### Payload 6: Negative Hours Injection
* **Threat**: Malicious actor posts corrupt fractional floating points to trigger state crashes.
* **Payload**: `updateDoc(doc(db, 'attendance', '2026-05-27_CES002'), { totalHours: -45.5 })`
* **Assertion**: `PERMISSION_DENIED`.

### Payload 7: Terminal State Override
* **Threat**: Overriding final approved/rejected leave requests.
* **Payload**: `updateDoc(doc(db, 'leaveRequests', 'LR-101'), { status: 'Approved' })`
* **Assertion**: `PERMISSION_DENIED` (only Admin/Manager can write leaveRequest status updates).

### Payload 8: Blind Query Harvesting (PII Scraping)
* **Threat**: A rogue employee requests list access of all other employees' private profiles or contact numbers.
* **Payload**: `getDocs(collection(db, 'employees'))`
* **Assertion**: `PERMISSION_DENIED` (blanket list scans restricted to validated admin profiles).

### Payload 9: Unauthorized Notification Snooping
* **Threat**: Employee tries to query alerts meant for Admin attention.
* **Payload**: `getDocs(query(collection(db, 'notifications'), where('isAdmin', '==', true)))`
* **Assertion**: `PERMISSION_DENIED` unless request auth is admin.

### Payload 10: State Bypass via Sibling Injection
* **Threat**: User attempts to inject a shadow attribute "isSuperuser: true" into custom profiles.
* **Payload**: `updateDoc(doc(db, 'employees', 'CES002'), { isSuperuser: true })`
* **Assertion**: `PERMISSION_DENIED`.

### Payload 11: Future Date Clocking
* **Threat**: User posts attendance for three weeks in the future to falsify pay cycles.
* **Payload**: `setDoc(doc(db, 'attendance', '2026-07-27_CES002'), { date: '2026-07-27', totalHours: 8 })`
* **Assertion**: `PERMISSION_DENIED`.

### Payload 12: Orphaned Leave Log Spawning
* **Threat**: Submitting a leave request referencing a non-existent corporate profile.
* **Payload**: `setDoc(doc(db, 'leaveRequests', 'LR-999'), { employeeId: 'CES-FAKE', leaveType: 'Sick', status: 'Pending' })`
* **Assertion**: `PERMISSION_DENIED`.

---

## 3. Test Runner Design

For integration safety, we require verification that all reads/writes pass through proper verification gates. Transactions must reject whenever identity signatures are mismatched.
