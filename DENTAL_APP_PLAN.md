# Dental Practice Owner App — Product Plan

A mobile app (Expo / React Native) for dental practice owners that starts small and grows with the practice: one codebase, three tiers.

| Tier | Target | Practice size |
|---|---|---|
| **Solo** | Single-owner practices | 1–2 dentists, little or no admin staff |
| **Team** | Growing practices | 3–10 providers, front desk team |
| **Group** | DSOs / multi-location | Multiple locations, regional managers |

---

## 1. Problems by practice size

### Small (Solo)
- Last-minute cancellations leave chairs empty (≈ $200–$500 lost per hour).
- The owner is also the office manager, so there's no time for admin.
- Few online reviews, so it's hard to attract new patients.
- Paper intake forms and slow check-in.

### Medium (Team)
- Patients accept treatment plans but never schedule them, leaving revenue on the table.
- Staff coordination happens over sticky notes and group texts.
- Insurance eligibility isn't verified before visits.
- Hygienist shifts and time off are managed by hand.

### Large (Group / DSO)
- No single view of performance across locations.
- Staffing gaps at one location while another is overstaffed.
- Supply spend differs widely between sites.
- Compliance (OSHA, infection control, certifications) is hard to audit.

---

## 2. Feature ideas

### Solo
1. **Chair Filler.** When an appointment is cancelled, the waitlist gets an SMS or push notification, and the first patient to tap books the slot.
2. **Owner Pocket Dashboard.** Today's production, collections, no-shows and open slots.
3. **Review Booster.** A post-visit, one-tap Google review request. Unhappy patients are sent to a private feedback form instead.
4. **Digital Intake.** Medical history, insurance card photos (`expo-camera`) and e-signed consent.

### Team
1. **Treatment Plan Closer.** Lists unscheduled treatment, shows financing options and sends automated follow-ups.
2. **Morning Huddle.** Today's patients, outstanding balances, overdue X-rays and staff tasks.
3. **Insurance Verification Assistant.** Scan the insurance card and track whether eligibility has been checked before each visit.
4. **Staff Scheduling.** Shifts, swaps, time-off requests and overtime alerts.

### Group / DSO
1. **Multi-location KPI Command Center.** Production per provider, case acceptance, hygiene reappointment rate and no-shows, compared across sites.
2. **Float Staff Marketplace.** Fill a gap at one location with staff from another.
3. **Supply & Inventory Tracker.** Barcode scanning, reorder points and spend per location.
4. **Compliance & Training.** Checklists, certification expiry alerts and audit trails.

---

## 3. MVP scope (v1 — Solo tier)

Focus on features that need **little PHI**, so we can ship fast and safely.

- [ ] Auth: owner sign-up / login (email + magic link)
- [ ] Practice setup: practice name, location, operating hours
- [ ] **Chair Filler**
  - [ ] Add patients to a waitlist (name, phone, preferred times)
  - [ ] Owner marks a slot as open
  - [ ] Waitlist gets notified; first tap claims the slot
- [ ] **Owner Dashboard** (manual entry or CSV import at first)
  - [ ] Today's open slots, filled slots and no-shows
  - [ ] Weekly production and collections
- [ ] **Review Booster**
  - [ ] Send a review request link after a visit
  - [ ] Route low ratings to private feedback

**Success metric:** number of cancelled slots re-filled per week.

---

## 4. Roadmap

| Version | Tier | Features |
|---|---|---|
| v1 | Solo | Chair Filler, Owner Dashboard, Review Booster |
| v1.5 | Solo | Digital Intake |
| v2 | Team | Roles & permissions, Morning Huddle, Treatment Plan Closer, Staff Scheduling |
| v2.5 | Team | Insurance Verification |
| v3 | Group | Multi-location, KPI Command Center, Float Staff, Inventory, Compliance |

---

## 5. Tech stack

| Need | Choice |
|---|---|
| App framework | **Expo** (React Native) |
| Navigation | **Expo Router** (file-based) |
| Backend / DB / Auth | **Supabase** (Postgres + Row-Level Security) |
| Styling | NativeWind (Tailwind for React Native) |
| Forms & validation | react-hook-form + zod |
| Data fetching | TanStack Query |
| Notifications | expo-notifications (push) + SMS provider (e.g. Twilio) |
| Secure storage | expo-secure-store |
| Builds & releases | EAS Build, EAS Update (OTA) |

### Getting started

```bash
npx create-expo-app@latest dental-app
cd dental-app
npx expo start
```

Scan the QR code with **Expo Go** to run the app on your phone.

---

## 6. Draft data model (Supabase)

```
organizations   id, name, tier (solo | team | group)
locations       id, organization_id, name, address, timezone
members         id, organization_id, user_id, role (owner | manager | staff)
providers       id, location_id, name, type (dentist | hygienist | assistant)
appointments    id, location_id, provider_id, starts_at, ends_at, status
waitlist        id, location_id, patient_name, phone, preferred_times, notified_at
open_slots      id, location_id, provider_id, starts_at, ends_at, claimed_by, claimed_at
review_requests id, location_id, patient_phone, sent_at, rating, feedback
daily_metrics   id, location_id, date, production, collections, no_shows
```

Every table is scoped by `organization_id` / `location_id`, with RLS policies so members only see their own practice's data.

---

## 7. HIPAA & security checklist

- [ ] The backend vendor signs a **BAA** (Supabase offers one on higher-tier plans)
- [ ] The SMS vendor signs a BAA, or messages contain no PHI
- [ ] No PHI in push notifications ("You have a new message", not treatment details)
- [ ] Row-Level Security on every table
- [ ] Tokens stored in `expo-secure-store`, never AsyncStorage
- [ ] Audit log for access to patient records
- [ ] Collect as little patient data as possible in v1

---

## 8. Biggest risk: practice-management integrations

Most practice data lives in practice-management systems (Dentrix, Eaglesoft, Open Dental).

- **v1:** manual entry + CSV import
- **Next:** **Open Dental**, which has the most open API
- Later: Dentrix / Eaglesoft through integration partners

---

## 9. Open questions

- [ ] Which practice size do we target first? (Recommended: Solo)
- [ ] Pricing per tier? (per location / per provider / flat)
- [ ] SMS or push only for the Chair Filler waitlist?
- [ ] Do we have access to a pilot practice for feedback?
- [ ] Which practice-management system do our first customers use?
