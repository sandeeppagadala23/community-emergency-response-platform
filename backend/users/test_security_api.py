"""
Unit and integration tests for Security Guard functionality.

Tests cover:
1. Security guard login returns role SECURITY, employee_id, shift, society, is_active.
2. Inactive security account cannot access /api/auth/security/dashboard/ (403/401).
3. Resident cannot access /api/auth/security/dashboard/ (403).
4. Security dashboard returns correct metrics keys and lists.
5. Security profile GET returns correct fields.
6. Security profile PATCH shift works; blocked fields (role) return 403.
7. Admin can list security guards (GET /api/admin/security-guards/).
8. Admin can create new security guard (POST /api/admin/security-guards/).
9. Admin can toggle active status of a guard (PATCH /api/admin/security-guards/<id>/).
10. Admin PATCH with role returns 403.
11. Non-admin cannot access admin security guard endpoints (403).
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from users.models import UserProfile
from users.security_views import (
    security_dashboard,
    security_profile,
    admin_security_guards,
    admin_security_guard_detail,
)
from society.models import Society

PASSWORD = "TestPassword123!"


class SecurityAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        
        self.society = Society.objects.create(
            name="Green Meadows Apartments",
            address="123 Main St, Bengaluru",
        )

        # Admin user
        self.admin_user = User.objects.create_user(
            username="testadmin",
            email="admin@test.com",
            password=PASSWORD,
            is_staff=True,
        )
        UserProfile.objects.create(
            user=self.admin_user,
            role="admin",
            phone_number="+91999900001",
            is_verified=True,
            society=self.society,
        )

        # Active Security guard
        self.security_user = User.objects.create_user(
            username="testsec01",
            email="sec01@test.com",
            password=PASSWORD,
            is_active=True,
        )
        self.security_profile = UserProfile.objects.create(
            user=self.security_user,
            role="security",
            phone_number="+91999900002",
            employee_id="SEC-TEST-01",
            shift="Day Shift",
            is_verified=True,
            society=self.society,
        )

        # Resident user
        self.resident_user = User.objects.create_user(
            username="testres01",
            email="res01@test.com",
            password=PASSWORD,
            is_active=True,
        )
        UserProfile.objects.create(
            user=self.resident_user,
            role="resident",
            phone_number="+91999900003",
            is_verified=True,
            society=self.society,
        )

        # Inactive Security user
        self.inactive_security_user = User.objects.create_user(
            username="testsec_inactive",
            email="sec_inactive@test.com",
            password=PASSWORD,
            is_active=False,
        )
        UserProfile.objects.create(
            user=self.inactive_security_user,
            role="security",
            phone_number="+91999900004",
            employee_id="SEC-TEST-INACTIVE",
            shift="Night Shift",
            is_verified=True,
            society=self.society,
        )

    def test_security_dashboard_access_by_security(self):
        """Active verified security guard can view dashboard."""
        request = self.factory.get("/api/auth/security/dashboard/")
        force_authenticate(request, user=self.security_user)
        response = security_dashboard(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("metrics", response.data)
        self.assertIn("live_alerts", response.data)
        self.assertIn("recent_reports", response.data)

        metrics = response.data["metrics"]
        expected_keys = {
            "total_active",
            "new_sos",
            "acknowledged",
            "in_progress",
            "resolved",
            "cancelled",
            "assigned_to_me",
            "active_reports",
        }
        self.assertTrue(expected_keys.issubset(metrics.keys()))

    def test_security_dashboard_denied_for_resident(self):
        """Resident cannot access security dashboard (403)."""
        request = self.factory.get("/api/auth/security/dashboard/")
        force_authenticate(request, user=self.resident_user)
        response = security_dashboard(request)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_security_dashboard_denied_for_inactive_security(self):
        """Inactive security guard cannot access dashboard."""
        request = self.factory.get("/api/auth/security/dashboard/")
        force_authenticate(request, user=self.inactive_security_user)
        response = security_dashboard(request)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_security_profile_get(self):
        """Security guard can view own profile data."""
        request = self.factory.get("/api/auth/security/profile/")
        force_authenticate(request, user=self.security_user)
        response = security_profile(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["employee_id"], "SEC-TEST-01")
        self.assertEqual(response.data["shift"], "Day Shift")
        self.assertEqual(response.data["role"], "SECURITY")
        self.assertEqual(response.data["society"], "Green Meadows Apartments")
        self.assertTrue(response.data["is_active"])

    def test_security_profile_patch_safe_fields(self):
        """Security guard can update shift and email."""
        request = self.factory.patch(
            "/api/auth/security/profile/",
            {"shift": "Night Shift (20:00 - 08:00)", "email": "sec01_new@test.com"},
            format="json",
        )
        force_authenticate(request, user=self.security_user)
        response = security_profile(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["shift"], "Night Shift (20:00 - 08:00)")
        self.assertEqual(response.data["email"], "sec01_new@test.com")

        self.security_profile.refresh_from_db()
        self.assertEqual(self.security_profile.shift, "Night Shift (20:00 - 08:00)")

    def test_security_profile_patch_blocked_field(self):
        """Security guard cannot change role."""
        request = self.factory.patch(
            "/api/auth/security/profile/",
            {"role": "admin"},
            format="json",
        )
        force_authenticate(request, user=self.security_user)
        response = security_profile(request)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_list_security_guards(self):
        """Admin can list all security guards."""
        request = self.factory.get("/api/admin/security-guards/")
        force_authenticate(request, user=self.admin_user)
        response = admin_security_guards(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [g["username"] for g in response.data]
        self.assertIn("testsec01", usernames)
        self.assertIn("testsec_inactive", usernames)

    def test_admin_create_security_guard(self):
        """Admin can create a new security guard account."""
        data = {
            "username": "guard_new",
            "password": PASSWORD,
            "first_name": "New",
            "last_name": "Guard",
            "email": "guard_new@test.com",
            "phone_number": "+91999900099",
            "employee_id": "SEC-NEW-01",
            "shift": "Day Shift",
            "society_id": self.society.id,
        }
        request = self.factory.post("/api/admin/security-guards/", data, format="json")
        force_authenticate(request, user=self.admin_user)
        response = admin_security_guards(request)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "guard_new")
        self.assertEqual(response.data["role"], "SECURITY")
        self.assertEqual(response.data["employee_id"], "SEC-NEW-01")

        created_user = User.objects.get(username="guard_new")
        self.assertEqual(created_user.profile.role, "security")

    def test_admin_deactivate_security_guard(self):
        """Admin can deactivate an active security guard."""
        request = self.factory.patch(
            f"/api/admin/security-guards/{self.security_user.id}/",
            {"is_active": False},
            format="json",
        )
        force_authenticate(request, user=self.admin_user)
        response = admin_security_guard_detail(request, guard_id=self.security_user.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active"])

        self.security_user.refresh_from_db()
        self.assertFalse(self.security_user.is_active)

    def test_admin_patch_guard_role_forbidden(self):
        """Admin cannot alter security guard role via security guard endpoint."""
        request = self.factory.patch(
            f"/api/admin/security-guards/{self.security_user.id}/",
            {"role": "admin"},
            format="json",
        )
        force_authenticate(request, user=self.admin_user)
        response = admin_security_guard_detail(request, guard_id=self.security_user.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_access_guard_management(self):
        """Resident or Security cannot access admin security guard endpoints."""
        request = self.factory.get("/api/admin/security-guards/")
        force_authenticate(request, user=self.security_user)
        response = admin_security_guards(request)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
