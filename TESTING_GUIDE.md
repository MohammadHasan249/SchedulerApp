# PHASES 6-11 TESTING GUIDE

## Quick Start
1. Start dev server: `npm run dev`
2. Sign up as organization at http://localhost:3000/signup/org
3. Create employees and test workflows below

---

## PHASE 6: TIME-OFF REQUESTS

### Setup
1. Sign up as **org_admin** with email: `admin@test.com`, password: `Test123!`
2. Create 2 employees:
   - Alice (branch_manager) - assign to "Main" branch
   - Bob (employee) - assign to "Main" branch
3. Set Bob's PIN: `1234`

### Test Cases

#### Test 6.1: Employee Submits Time-Off
1. Switch to Bob's account (sign up as employee with Bob's email)
2. Go to **Dashboard > Time Off**
3. Click **+ Request Time Off**
4. Fill form:
   - Start Date: 5 days from today
   - End Date: 7 days from today
   - Reason: "Vacation"
5. Click Submit
6. ✅ Should see request in list with status "pending"

#### Test 6.2: Manager Approves Time-Off
1. Switch to Alice's account (branch_manager)
2. Go to **Dashboard > Time Off**
3. ✅ Should see Bob's request in the list
4. Click **Approve**
5. ✅ Status should change to "approved"
6. Switch back to Bob's account
7. ✅ Request should show status "approved"

#### Test 6.3: Manager Denies Time-Off
1. As Bob, submit another time-off request (different dates)
2. As Alice, go to Time Off
3. Click **Deny**
4. ✅ Status should change to "denied"

#### Test 6.4: Employee Cancels Pending Request
1. As Bob, submit another time-off request
2. ✅ Verify status is "pending"
3. Should see **Cancel** button
4. Click Cancel
5. ✅ Request should be deleted from list

#### Test 6.5: Date Validation
1. As Bob, try to submit time-off
2. Set Start Date: 10 days from today
3. Set End Date: 5 days from today (earlier than start)
4. Click Submit
5. ✅ Should see error: "Start date must be before end date"

#### Test 6.6: Employee Access Control
1. As Bob, try to access other employee's requests
2. ✅ Should only see their own requests
3. Try directly accessing `/api/time-off`
4. ✅ Should only return Bob's requests

#### Test 6.7: Org Admin Can See All Time-Off
1. Switch to org_admin account
2. Go to **Dashboard > Time Off**
3. ✅ Should see time-off requests from ALL branches

---

## PHASE 7: SHIFT SWAP REQUESTS

### Setup
1. Create 3 employees: Alice, Bob, Charlie (all in "Main" branch)
2. Create shifts for this week:
   - Monday 9-5: Assign to Bob
   - Tuesday 9-5: Assign to Charlie
   - Wednesday 9-5: Assign to Bob

### Test Cases

#### Test 7.1: Employee Requests Shift Swap (Open)
1. As Bob, go to **Dashboard > Shift Swaps**
2. ✅ Should see the Monday 9-5 shift he's assigned to
3. Click **Request Swap**
4. ✅ Should show swap request in "pending" status
5. Leave "Cover" field empty (open swap)
6. Submit

#### Test 7.2: Another Employee Accepts Swap
1. As Charlie, go to **Dashboard > Shift Swaps**
2. ✅ Should see Bob's open swap request
3. Should see **Accept Cover** button
4. Click it
5. ✅ Status should change to "cover_accepted"
6. As Bob, refresh
7. ✅ Should see Charlie accepted the cover

#### Test 7.3: Manager Approves Accepted Swap
1. As Alice (manager), go to **Dashboard > Shift Swaps**
2. ✅ Should see swap with status "cover_accepted"
3. Click **Approve**
4. ✅ Status should change to "manager_approved"
5. Verify in **Dashboard > Schedule** that assignments updated:
   - Bob is no longer assigned to Monday
   - Charlie is now assigned to Monday

#### Test 7.4: Swap with Nominated Cover
1. As Bob, request swap for Tuesday
2. Nominate Charlie as the cover
3. Submit
4. ✅ Status should be "pending"
5. As Charlie, go to Shift Swaps
6. ✅ Should see the swap for Tuesday with Bob as requester
7. Click **Accept Cover**
8. As Alice, approve the swap
9. ✅ Verify Tuesday assignment: Charlie → Bob

#### Test 7.5: Manager Denies Swap
1. As Bob, request a new swap
2. As Alice, click **Deny**
3. ✅ Status should change to "denied"
4. ✅ Shift assignments should NOT change

#### Test 7.6: Cannot Swap Past Shifts
1. Try to request swap for a shift that started yesterday
2. ✅ Should see error: "Cannot swap a past shift"

#### Test 7.7: Cover Must Be Same Branch
1. Create another branch: "Downtown"
2. Assign a different employee to Downtown branch
3. As Bob, try to nominate Downtown employee as cover
4. ✅ Should see error or prevent selection

#### Test 7.8: Cannot Cover Your Own Swap
1. As Bob, request shift swap
2. As Bob, try to accept the cover
3. ✅ Should see error: "Cannot cover your own swap"

---

## PHASE 8: CLOCK-IN KIOSK (PIN)

### Setup
1. Employee Bob has PIN set to: `1234`
2. Employee Charlie has PIN set to: `5678`

### Test Cases

#### Test 8.1: Valid PIN - Clock In
1. Go to `http://localhost:3000/kiosk/main`
2. ✅ Should see PIN pad with 9 number buttons + backspace
3. Click: 1, 2, 3, 4
4. ✅ Should show 4 dots
5. Click **Clock In / Out** button
6. ✅ Should show:
   - ✓ Green checkmark
   - "Bob" (employee name)
   - "Clocked In"
   - Timestamp (HH:mm:ss)
7. ✅ Auto-resets after 5 seconds

#### Test 8.2: Valid PIN - Clock Out
1. Clock in as Bob (PIN 1234)
2. Wait for auto-reset (5 seconds)
3. Enter PIN 1234 again
4. Click **Clock In / Out**
5. ✅ Should show "Clocked Out"
6. Verify in database:
   - Two clock_events entries for Bob today
   - One with type "clock_in", one with "clock_out"

#### Test 8.3: Invalid PIN
1. Enter PIN: 9999
2. Click **Clock In / Out**
3. ✅ Should show:
   - ✗ Red X icon
   - "Invalid PIN" error message
4. ✅ Should wait ~1 second before allowing retry
5. Click **Try Again**
6. ✅ PIN pad should clear and be ready for new entry

#### Test 8.4: PIN Display
1. Enter partial PIN: 123
2. ✅ Should show 3 dots (••• format, not numbers)
3. Click backspace
4. ✅ Should show 2 dots
5. Complete to 1234 and clock in

#### Test 8.5: Multiple Employees
1. Clock in as Bob (1234)
2. After 5-second reset, clock in as Charlie (5678)
3. ✅ Should show "Charlie" in success message
4. Verify database has entries for both employees

#### Test 8.6: Inactive Employees Cannot Clock In
1. Deactivate Bob in Employees list
2. Try PIN 1234 at kiosk
3. ✅ Should get "Invalid PIN" error
4. Reactivate Bob
5. Try PIN 1234 again
6. ✅ Should work

#### Test 8.7: Different Branch Kiosk
1. Create "Downtown" branch with slug `downtown`
2. Go to `http://localhost:3000/kiosk/downtown`
3. ✅ Kiosk should still be accessible
4. Employees from Downtown branch should be able to clock in
5. Main branch employees should not be able to clock in with their PINs (if branches are separate)

#### Test 8.8: PIN Format Validation
1. Try to submit PIN with < 4 digits
2. ✅ **Clock In / Out** button should be disabled
3. Try to submit PIN with > 6 digits
4. ✅ Should not allow more than 6 digits
5. Try to submit with letters
6. ✅ Should not accept letters

---

## PHASE 9: ATTENDANCE LOG

### Setup
1. Create some clock events by using the kiosk
2. Bob: Clock in at 9:00 AM, Clock out at 5:00 PM
3. Charlie: Clock in at 9:30 AM

### Test Cases

#### Test 9.1: View Today's Attendance
1. As manager (Alice), go to **Dashboard > Attendance Log** (Reports)
2. ✅ Should show:
   - Bob's clock in event
   - Bob's clock out event
   - Charlie's clock in event
3. ✅ Events should be sorted by time (newest first)

#### Test 9.2: Employee Cannot Access
1. As Bob (employee), try to go to `/dashboard/reports`
2. ✅ Should get error or redirect to login/forbidden

#### Test 9.3: Filter by Date Range
1. As Alice, on Attendance Log page
2. ✅ Default "From" and "To" dates should be today
3. Change "From" to 3 days ago
4. Change "To" to today
5. Click **Filter**
6. ✅ Should show all events from that range

#### Test 9.4: Filter by Branch
1. Create "Downtown" branch
2. Create Downtown employees and have them clock in
3. On Attendance Log, select "Downtown" from Branch dropdown
4. Click **Filter**
5. ✅ Should only show Downtown events
6. Select "All branches"
7. ✅ Should show all events

#### Test 9.5: Employee Details Display
1. View Attendance Log
2. ✅ Should show:
   - Employee Name (Bob, Charlie, etc.)
   - Branch Name (Main, Downtown, etc.)
   - Type badge (Clock In, Clock Out)
   - Timestamp (MMM d, HH:mm:ss format)

#### Test 9.6: Branch Manager Sees Only Their Branch
1. Create Bob as branch_manager of "Downtown" branch
2. As Bob, go to Attendance Log
3. ✅ Should only see Downtown events
4. Try to select "Main" branch
5. ✅ Should either disable it or show no results

#### Test 9.7: Empty State
1. Filter to a date range with no clock events
2. ✅ Should show message: "No clock events for the selected period."

---

## PHASE 10: REALTIME NOTIFICATIONS

### Setup
1. Have browser with Alice (manager) open
2. Have second browser/tab with Bob (employee) open
3. Have multiple pending time-off requests or shift swaps

### Test Cases

#### Test 10.1: Notification Bell Appears
1. As Bob, log in
2. Go to **Dashboard > Schedule** or any page
3. ✅ Bell icon should appear in top-right header
4. ✅ Should show unread count badge (if any unread notifications)

#### Test 10.2: Initial Load
1. As Bob, log in
2. ✅ Bell should load existing notifications from server
3. Notification count should match number of unread notifications

#### Test 10.3: Time-Off Approval Notification
1. As Bob, submit a time-off request
2. As Alice (in separate browser), approve it
3. ✅ Bob's bell should show badge with "1" (or increase)
4. ✅ WITHOUT refreshing, notification should appear in real-time
5. Click bell icon to open
6. ✅ Should see notification: "Your time-off request for [dates] has been approved"

#### Test 10.4: Swap Approval Notification
1. As Bob, request a shift swap
2. Charlie accepts the cover
3. As Alice, approve the swap
4. ✅ Bob should receive notification in real-time

#### Test 10.5: Mark as Read
1. Click bell to open notifications popover
2. ✅ All unread notifications should auto-mark as read
3. ✅ Badge count should go to 0
4. Click notification that's already read
5. ✅ Nothing should change

#### Test 10.6: Popover Behavior
1. Click bell to open
2. ✅ Should show all notifications with newest first
3. ✅ Each notification should show:
   - Message text
   - Timestamp (MMM d, HH:mm)
4. Close popover
5. Open it again
6. ✅ Notifications should still be there

#### Test 10.7: Empty State
1. Mark all notifications as read
2. Close and reopen bell
3. ✅ Should show message: "No notifications."

#### Test 10.8: Multiple Notifications
1. Create multiple approval events
2. ✅ Bell should show badge "9+" if more than 9 unread
3. Open popover
4. ✅ Should scroll if more than ~10 notifications

---

## PHASE 11: BRANCH MANAGEMENT

### Setup
1. Signed in as org_admin

### Test Cases

#### Test 11.1: View Branches List
1. Go to **Dashboard > Settings > Branches**
2. ✅ Should see table with columns:
   - Name
   - Slug
   - Address
   - Timezone
   - Actions (Edit, Delete)
3. ✅ Should show existing "Main" branch

#### Test 11.2: Create Branch with Auto Slug
1. Click **+ Add Branch**
2. Fill form:
   - Name: "Downtown"
   - Slug: (leave blank)
   - Address: "123 Main St"
   - Timezone: "America/Chicago"
3. Click **Create**
4. ✅ Should see new branch in list
5. ✅ Slug should auto-generate as "downtown" (lowercase, no spaces)

#### Test 11.3: Create Branch with Custom Slug
1. Click **+ Add Branch**
2. Fill form:
   - Name: "Westside"
   - Slug: "west-side"
   - Address: "456 Oak Ave"
   - Timezone: "America/Denver"
3. Click **Create**
4. ✅ Should see branch with slug "west-side"

#### Test 11.4: Slug Validation
1. Try to create branch with slug containing uppercase: "West-Side"
2. ✅ Should auto-convert to "west-side" or show error
3. Try slug with spaces: "west side"
4. ✅ Should reject or auto-convert to "west-side"
5. Try slug with special chars: "west@side"
6. ✅ Should reject with error

#### Test 11.5: Slug Uniqueness
1. Create branch with slug "unique-test"
2. Try to create another branch with same slug
3. ✅ Should see error: "A branch with this slug already exists"

#### Test 11.6: Edit Branch
1. Click **Edit** on "Downtown" branch
2. Change Name to "Downtown Hub"
3. Change Address to "999 New St"
4. Click **Save**
5. ✅ Should update in table

#### Test 11.7: Delete Branch
1. Click **Delete** on a branch
2. ✅ Should show confirmation dialog
3. Click **Delete** in dialog
4. ✅ Branch should disappear from list

#### Test 11.8: Access Control - Branch Manager
1. Create a branch_manager account
2. Try to access `/dashboard/settings/branches`
3. ✅ Should get Forbidden error or redirect

#### Test 11.9: Access Control - Employee
1. Create an employee account
2. Try to access `/dashboard/settings/branches`
3. ✅ Should get Forbidden error or redirect

#### Test 11.10: Timezone Field
1. Create branch with timezone "UTC"
2. Edit and change to "America/New_York"
3. ✅ Should save and display correctly
4. Verify timezone is stored in database

---

## TESTING CHECKLIST

### Before Testing
- [ ] Dev server running (`npm run dev`)
- [ ] Database has fresh data
- [ ] Supabase auth configured
- [ ] Supabase Realtime enabled

### After Each Phase
- [ ] No console errors
- [ ] No database errors in server logs
- [ ] All form validations work
- [ ] Role-based access enforced
- [ ] Data persists after page refresh

### Final Verification
- [ ] All 48+ test cases pass
- [ ] No security issues found
- [ ] Performance acceptable
- [ ] Error messages are clear
- [ ] UI is intuitive

---

## Troubleshooting

### Kiosk Page Shows 500 Error
- Make sure you're using the fixed version from commit 2d527be
- Restart dev server: `npm run dev`

### Notifications Not Updating in Real-Time
- Verify Supabase Realtime is enabled
- Check browser console for Supabase connection errors
- Try refreshing the page manually

### Clock Events Not Appearing in Attendance Log
- Verify employee has PIN set
- Check that PIN hash was created in database
- Verify clock_events table has records

### Branch Filtering Not Working
- Make sure branch exists in database
- Verify user has access to see that branch
- Check that employees are assigned to the branch

### Time-Off/Swap Requests Not Showing
- Verify user role (employee vs manager) for visibility rules
- Check that dates are in correct format (YYYY-MM-DD)
- Verify requests are in the same organization

---

## Test Data Setup Script

Instead of manually creating test data, you can use this workflow:

1. Sign up as org: `admin@testrest.com` / `Test123!`
2. Create employees:
   - Alice: `alice@testrest.com`, branch_manager, PIN: `1111`
   - Bob: `bob@testrest.com`, employee, PIN: `2222`
   - Charlie: `charlie@testrest.com`, employee, PIN: `3333`
3. Create shifts in Schedule for this week
4. Set availability for each employee
5. Start testing!

---

## Expected Results Summary

| Phase | Feature | Expected Result |
|-------|---------|-----------------|
| 6 | Time-Off Requests | Form submits, manager can approve/deny |
| 7 | Shift Swaps | Multi-step approval, assignments update |
| 8 | Clock Kiosk | PIN works, events recorded, auto-reset |
| 9 | Attendance Log | Events visible, filterable, role-restricted |
| 10 | Notifications | Realtime updates, badge count, popover |
| 11 | Branch Mgmt | CRUD works, slug auto-gen, access controlled |

---

Good luck with testing! 🚀
