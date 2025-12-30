# Budget Buddy - Backlog

## Future Enhancements

### Self-Hosting Options

Currently the app uses Firebase (Auth + Firestore) and requires `npm run dev` to run locally. Below are options to self-host on a home network when needed.

---

#### Option A: Static Frontend Only (Easiest)
**Effort:** ~1 hour | **Complexity:** Low

Keep Firebase as the backend, just serve the built frontend locally.

- [ ] Run `npm run build` to generate static files
- [ ] Set up a simple static server (Caddy, Nginx, or `npx serve`)
- [ ] Optionally run on Raspberry Pi for always-on access
- [ ] Access via local IP (e.g., `http://192.168.1.x:3000`)

**Pros:** Minimal changes, Firebase handles auth/data
**Cons:** Still depends on Firebase/internet for data

---

#### Option B: Full Local with SQLite (Moderate)
**Effort:** 2-3 weeks | **Complexity:** Medium

Self-host everything on Raspberry Pi with SQLite database.

- [ ] Create Express.js API backend
- [ ] Design SQLite database schema
- [ ] Implement authentication (JWT or sessions)
- [ ] Migrate Firebase service calls to REST API
- [ ] Set up Caddy as reverse proxy
- [ ] Docker Compose for deployment
- [ ] Data migration script from Firestore

**Pros:** Fully offline, single device, simple backups
**Cons:** Significant rewrite, need to maintain backend

---

#### Option C: Full Migration with MariaDB (Advanced)
**Effort:** 3-4 weeks | **Complexity:** High

Self-host with MariaDB on Synology NAS, app on Raspberry Pi.

- [ ] Everything from Option B, plus:
- [ ] MariaDB schema design
- [ ] Configure MariaDB on Synology NAS
- [ ] Network configuration between Pi and NAS
- [ ] Set up backups on NAS
- [ ] Optional: GitHub Actions self-hosted runner for CI/CD

**Pros:** Leverages existing NAS infrastructure, scalable
**Cons:** Most complex, network dependency, more failure points

---

## Notes

- Current Firebase free tier (1GB storage, 50K reads/day) is more than sufficient for single-user budget tracking
- Estimated ~2 million transactions before hitting 1GB limit
- Revisit these options if Firebase pricing/limits become a concern
