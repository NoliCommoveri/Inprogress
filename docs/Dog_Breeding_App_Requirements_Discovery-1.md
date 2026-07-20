# Dog Breeding Management App
## Requirements Discovery Document

### Purpose
Develop an offline-first static HTML application for managing a dog breeding program. The application should require no server, store data locally, support manual entry and CSV import, and provide JSON export for backups.

---

# Vision

The application should serve as the breeder's complete operational record system, covering:

- Breeding stock
- Health records
- Pairings
- Litters
- Puppies
- Buyers
- Stud services
- Breeder contacts
- External dogs
- Pedigrees
- Reporting
- Import/export

The emphasis is on preserving complete historical records while minimizing duplicate data entry.

---

# Initial Epics

## EPIC 1 – Breeding Stock Management

User Stories:
- Create and edit dog records.
- Track lifecycle status.
- Archive retired or deceased dogs.
- Search and filter dogs.

---

## EPIC 2 – Health Records

Track:
- Routine veterinary care
- Vaccinations
- Preventatives
- Genetic testing
- OFA/PennHIP
- Breed-specific testing
- Illnesses
- Medications
- Surgeries
- Notes
- Expiration reminders

---

## EPIC 3 – Pairings

Record:
- Planned breeding
- Actual breeding
- Outcome
- Pregnancy status
- Notes

---

## EPIC 4 – Litters

Track:
- Birth details
- Whelping summary
- Puppy roster
- Health
- Notes

---

## EPIC 5 – Puppy Management

Track:
- Identity
- Growth
- Health
- Evaluations
- Photos
- Status

Allow retained puppies to be promoted into breeding stock without re-entering data.

---

## EPIC 6 – Buyers

Track:
- Buyer information
- Sale information
- Contracts
- Notes

---

## EPIC 7 – Stud Services

Maintain records for:
- Outside studs
- Outside females
- Contracts
- Fees
- Results

---

## EPIC 8 – Breeder Network

Maintain:
- Contacts
- Kennels
- External dogs
- Relationship history

---

## EPIC 9 – Pedigrees

Provide:
- Multi-generation pedigree
- Ancestor lookup
- Descendant lookup
- Shared ancestor/intersection analysis

---

## EPIC 10 – Import / Export

Support:
- Manual entry
- CSV import
- JSON backup
- JSON restore
- Reports

---

# Candidate Future Features

- Heat cycle tracking
- Pregnancy tracking
- Whelping log
- Puppy weight charts
- Development milestones
- Wait lists
- Contract repository
- Image library
- Medication reminders
- Financial tracking
- Show/performance titles
- COI analysis
- Genetic diversity tools
- Timeline view
- Kennel management
- Feeding management
- Dashboard
- Data quality auditing
- Breeding analytics

---

# Architectural Recommendations

1. Offline-first.
2. Static HTML, CSS and JavaScript.
3. Local storage with import/export.
4. Modular pages with minimal coupling.
5. CSV import for nearly every entity.
6. Full JSON backup and restore.
7. Preserve history; avoid destructive deletes.
8. Promote puppies to breeding stock without duplication.

## Strong Recommendation

Model the application around a generic **Event/History** system.

Examples:
- Vaccination
- Heat cycle
- Medication
- Breeding
- Pregnancy update
- Surgery
- Title earned
- Injury
- Veterinary visit

This reduces duplicated code and enables timeline views and reporting.

---

# Suggested Development Stages

## Stage 1 – Foundation (built)
- Application shell
- Navigation
- Local database
- Import/export framework
- Reporting framework

## Stage 2 – Core Dogs (built)
- Dog management
- Health records
- Pedigrees
- Contacts

## Stage 3 – Breeding Workflow (built)
- Pairings
- Pregnancy
- Litters
- Puppies

Stages 1–3 are complete — see `Data_Model_Architecture_Proposal_v2.md`, `Stage1_Stage2_Build_Brief_v2.md`, `Stage3_Build_Brief_v1.md`, and `Sample_Data_and_Reset_Brief_v2.md` for what was actually built. Stage 4 below is next.

## Stage 4 – Sales & Stud Services
- Buyers
- Contracts
- Wait list
- Puppy placement
- Stud service arrangements (outgoing and incoming)

## Stage 5 – Advanced Breeder Tools
- Genetic analysis
- COI
- Analytics
- Dashboards
- Reminder engine

## Stage 6 – Polish
- Advanced search
- Data validation
- Duplicate detection
- Performance improvements
- UX refinements

---

# Next Requirements Discovery

Each epic should be expanded into:
- Personas
- User stories
- Acceptance criteria
- Data model
- Screen mockups
- Business rules
- Validation rules
- Reports
- Import/export mappings
- Future enhancement ideas

The goal is a complete functional specification before implementation begins.

In practice, Epics 1–4 and most of Epic 5 (puppy identity, growth, health, evaluations, and status — everything except Photos, which was deliberately descoped, see data-model doc §12) were built directly from the data model doc and the two build briefs rather than through this fuller per-epic discovery process. That process remains the right approach for Epics 6–8 (Buyers, Stud Services, and the deeper Breeder Network features) as Stage 4 and beyond are scoped.
