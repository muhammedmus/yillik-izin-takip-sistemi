"""Iteration 17 tests — /api/leaves/preview and /api/reports/deleted-leaves/restore-preview."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]).rstrip("/")
ADMIN = {"email": "muhammedmus@gmail.com", "password": "Merkoteks2026!"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def sample_pid(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/personnel", params={"limit": 1})
    d = r.json()
    items = d if isinstance(d, list) else d.get("items", [])
    return items[0]["id"]


def _preview_body(pid, s, e):
    return {"personnel_id": pid, "start_date": s, "end_date": e, "izin_turu": "Yıllık İzin"}


# --- /api/leaves/preview ---
class TestLeavesPreview:
    def test_20_5_days_return_monday(self, admin_session, sample_pid):
        r = admin_session.post(f"{BASE_URL}/api/leaves/preview",
                                json=_preview_body(sample_pid, "2026-10-01", "2026-10-30"))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["days"] == 20.5, d
        assert d["return_date"] == "2026-11-02"
        assert d["return_weekday"] == "Pazartesi"
        assert isinstance(d.get("breakdown"), list) and len(d["breakdown"]) == 30

    def test_national_holiday_23_april(self, admin_session, sample_pid):
        # 22 (Wed) work, 23 (Thu) 23 Nisan holiday, 24 (Fri) work → 2 days
        r = admin_session.post(f"{BASE_URL}/api/leaves/preview",
                                json=_preview_body(sample_pid, "2026-04-22", "2026-04-24"))
        assert r.status_code == 200
        d = r.json()
        assert d["days"] == 2.0, d

    def test_weekend_skip_return(self, admin_session, sample_pid):
        # 2026-11-06 is Friday; return_date should be Monday 2026-11-09
        r = admin_session.post(f"{BASE_URL}/api/leaves/preview",
                                json=_preview_body(sample_pid, "2026-11-06", "2026-11-06"))
        assert r.status_code == 200
        d = r.json()
        assert d["return_date"] == "2026-11-09"
        assert d["return_weekday"] == "Pazartesi"


# --- /api/reports/deleted-leaves/restore-preview ---
KNOWN_AUDIT_ID = "896090bb-c390-4969-8137-4d729228c164"


class TestRestorePreview:
    def test_known_bulk_delete(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/reports/deleted-leaves/restore-preview",
                                json={"audit_id": KNOWN_AUDIT_ID})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["action_source"] == "bulk_delete"
        assert d["total"] >= 1
        assert isinstance(d["results"], list)
        for row in d["results"]:
            assert row["status"] in ("ok", "conflict", "warning", "error")
            assert "personnel_active" in row
            # balance keys must exist for non-error rows w/ personnel
            if row["status"] != "error":
                assert "balance_current" in row
                assert "balance_after_restore" in row

    def test_leave_index_filter(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/reports/deleted-leaves/restore-preview",
                                json={"audit_id": KNOWN_AUDIT_ID, "leave_index": 0})
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 1
        assert d["results"][0]["leave_index"] == 0

    def test_invalid_audit_id_404(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/reports/deleted-leaves/restore-preview",
                                json={"audit_id": "does-not-exist-xxx"})
        assert r.status_code == 404
        assert "bulunamadı" in r.text.lower() or "bulunamad" in r.text.lower()

    def test_non_delete_audit_400(self, admin_session):
        # Find a leaves audit whose action != delete/bulk_delete (e.g., create/update)
        rr = admin_session.get(f"{BASE_URL}/api/audit-log",
                                params={"module": "leaves", "action": "create", "limit": 1})
        if rr.status_code != 200 or not (rr.json().get("items") or []):
            pytest.skip("no non-delete leaves audit available")
        aid = rr.json()["items"][0]["id"]
        r = admin_session.post(f"{BASE_URL}/api/reports/deleted-leaves/restore-preview",
                                json={"audit_id": aid})
        assert r.status_code == 400

    def test_no_db_writes(self, admin_session):
        """Verify audit_log count unchanged before/after dry-run."""
        # Use audit-log listing to get total counts
        before = admin_session.get(f"{BASE_URL}/api/audit-log", params={"limit": 1})
        # Some APIs return total, some don't — fetch a known-large limit
        b_json = before.json()
        b_total = b_json.get("total")
        # Do dry-run 3 times
        for _ in range(3):
            admin_session.post(f"{BASE_URL}/api/reports/deleted-leaves/restore-preview",
                               json={"audit_id": KNOWN_AUDIT_ID})
        after = admin_session.get(f"{BASE_URL}/api/audit-log", params={"limit": 1})
        a_total = after.json().get("total")
        if b_total is not None and a_total is not None:
            assert a_total == b_total, f"audit_log grew: {b_total} → {a_total}"


class TestFullRestoreFlow:
    """Create leave → bulk_delete → restore → verify NEW audit_log entry with action=restore
    and original bulk_delete entry preserved."""

    def test_bulk_delete_then_restore_creates_new_audit(self, admin_session, sample_pid):
        # 1) create a leave with unique dates
        create = admin_session.post(f"{BASE_URL}/api/leaves", json={
            "personnel_id": sample_pid,
            "start_date": "2027-06-08", "end_date": "2027-06-08",
            "izin_turu": "Yıllık İzin", "aciklama": "TEST_iter17"})
        assert create.status_code in (200, 201), create.text
        leave_id = create.json().get("id") or create.json().get("_id") or create.json().get("leave", {}).get("id")
        assert leave_id, f"no leave id: {create.text}"

        # 2) bulk_delete
        bd = admin_session.post(f"{BASE_URL}/api/leaves/bulk-delete",
                                 json={"ids": [leave_id], "reason": "TEST_iter17"})
        assert bd.status_code == 200, bd.text

        # 3) get latest bulk_delete audit
        rr = admin_session.get(f"{BASE_URL}/api/reports/deleted-leaves",
                                params={"action_type": "bulk_delete", "limit": 5})
        assert rr.status_code == 200
        items = rr.json().get("items") or rr.json() if isinstance(rr.json(), list) else rr.json().get("items", [])
        # find one referencing our leave
        target = None
        for it in items:
            ov = (it.get("audit") or {}).get("old_values") or it.get("old_values") or {}
            for L in (ov.get("deleted_leaves") or []):
                if L.get("start") == "2027-06-08":
                    target = it; break
            if target: break
        assert target, f"could not find bulk_delete audit for our leave"
        audit_id = target["id"]

        # 4) count restore audits before
        before = admin_session.get(f"{BASE_URL}/api/audit-log",
                                    params={"module": "leaves", "action": "restore", "limit": 1})
        b_total = before.json().get("total", 0) if before.status_code == 200 else 0

        # 5) restore
        rest = admin_session.post(f"{BASE_URL}/api/reports/deleted-leaves/restore",
                                    json={"audit_id": audit_id})
        assert rest.status_code == 200, rest.text
        # personnel may be pasif → warning; the audit entry is still written
        assert rest.json().get("audit_id") == audit_id

        # 6) original bulk_delete audit still exists untouched
        chk = admin_session.get(f"{BASE_URL}/api/audit-log/{audit_id}") \
            if False else admin_session.get(f"{BASE_URL}/api/reports/deleted-leaves",
                                            params={"action_type": "bulk_delete", "limit": 20})
        chk_items = chk.json().get("items") or (chk.json() if isinstance(chk.json(), list) else [])
        assert any(it["id"] == audit_id for it in chk_items), "original bulk_delete audit missing"

        # 7) new restore audit added
        after = admin_session.get(f"{BASE_URL}/api/audit-log",
                                   params={"module": "leaves", "action": "restore", "limit": 1})
        a_total = after.json().get("total", 0) if after.status_code == 200 else 0
        assert a_total >= b_total + 1, f"restore audit count did not increase: {b_total} → {a_total}"

        # cleanup: delete restored leave
        restored_id = None
        for r in rest.json().get("results", []):
            if r.get("status") == "restored":
                restored_id = r.get("leave_id"); break
        if restored_id:
            admin_session.delete(f"{BASE_URL}/api/leaves/{restored_id}")
