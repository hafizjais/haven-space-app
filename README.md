# Haven Space

Rental management web app for Haven Space (HS1 to HS7): rooms, tenants, monthly payments, expenses, dashboard and Malay tenancy agreement PDFs.

- **Live site:** https://hsrental.canvaskita.com
- **Data and logins:** Supabase project `haven-space` (free plan). Only emails listed in the `admins` table can see or change data.
- **Code:** React + TypeScript (Vite). `npm install`, then `npm run dev` to run locally, `npm run build` to build into `dist/`.
- **Deploy:** every push to `main` builds the site (GitHub Actions) and puts the files on the `deploy` branch. Hostinger pulls that branch into `public_html`.
- **Database changes:** `supabase/migrations/`.

## Rules the database enforces
- A room can have only one active tenant, and a tenant can rent only one room at a time.
- Tenant IC numbers are unique.
- A payment belongs to a tenancy, so empty rooms can't receive payments.
- A payment that makes a month's total differ from the rent needs a note.
