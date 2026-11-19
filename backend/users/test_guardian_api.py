from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from emergency_alerts.models import SOSAlert, SOSNotification
from emergency_contacts.models import GuardianContact
from emergency_reports.models import EmergencyReport
from users.models import UserProfile

PASSWORD = "TestPassword123!"


def create_user(username, role, email="", phone=None, is_verified=True, is_staff=False):
    user = User.objects.create_user(
        username=username,
        email=email,
        password=PASSWORD,
        is_staff=is_staff,
    )
    UserProfile.objects.create(
        user=user,
        role=role,
        phone_number=phone or f"9{user.id:09d}",
        is_verified=is_verified,
    )
    return user


class GuardianAPITests(TestCase):
    """
    Test scenarios:
    1. Guardian with one verified resident.
    2. Guardian with multiple verified residents.
    3. Guardian with no assigned residents.
    4. Resident submits a new report.
    5. Resident triggers an SOS alert.
    6. Guardian views the new report and SOS alert.
    7. Guardian tries to access an unrelated resident's report.
    8. Unauthenticated user tries to access Guardian APIs.
    9. Admin can assign and verify guardian contacts.
    """

    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin = create_user(
            "admin_user", "admin", email="admin@example.com", is_staff=True
        )

        # Residents
        self.resident1 = create_user(
            "resident_one", "resident", email="res1@example.com", phone="9111111111"
        )
        self.resident2 = create_user(
            "resident_two", "resident", email="res2@example.com", phone="9222222222"
        )
        self.unrelated_resident = create_user(
            "resident_unrelated", "resident", email="unrelated@example.com", phone="9333333333"
        )

        # Guardians
        self.guardian = create_user(
            "guardian_main", "guardian", email="guardian@example.com", phone="9888888888"
        )
        self.unassigned_guardian = create_user(
            "guardian_empty", "guardian", email="empty@example.com", phone="9777777777"
        )

        # Link guardian_main to resident1 (verified)
        self.link1 = GuardianContact.objects.create(
            resident=self.resident1,
            name="Main Guardian",
            relationship="Father",
            phone_number="9888888888",
            email="guardian@example.com",
            guardian_type="PRIMARY",
            is_verified=True,
        )

        # Unrelated resident has a contact with different details
        self.unrelated_link = GuardianContact.objects.create(
            resident=self.unrelated_resident,
            name="Other Contact",
            relationship="Friend",
            phone_number="9666666666",
            email="other@example.com",
            guardian_type="PRIMARY",
            is_verified=True,
        )

    # 1. Guardian with one verified resident
    def test_guardian_with_one_verified_resident(self):
        self.client.force_authenticate(user=self.guardian)
        response = self.client.get("/api/guardian-contacts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [c["id"] for c in response.data]
        self.assertIn(self.link1.id, ids)
        self.assertNotIn(self.unrelated_link.id, ids)
        self.assertEqual(response.data[0]["resident_username"], "resident_one")

    # 2. Guardian with multiple verified residents
    def test_guardian_with_multiple_verified_residents(self):
        # Link guardian to resident2 as well
        link2 = GuardianContact.objects.create(
            resident=self.resident2,
            name="Main Guardian",
            relationship="Uncle",
            phone_number="9888888888",
            email="guardian@example.com",
            guardian_type="PRIMARY",
            is_verified=True,
        )

        self.client.force_authenticate(user=self.guardian)
        response = self.client.get("/api/guardian-contacts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resident_usernames = [c["resident_username"] for c in response.data]
        self.assertIn("resident_one", resident_usernames)
        self.assertIn("resident_two", resident_usernames)
        self.assertNotIn("resident_unrelated", resident_usernames)

    # 3. Guardian with no assigned residents
    def test_guardian_with_no_assigned_residents(self):
        self.client.force_authenticate(user=self.unassigned_guardian)
        response = self.client.get("/api/guardian-contacts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        alerts_response = self.client.get("/alerts/api/sos/list/")
        self.assertEqual(alerts_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(alerts_response.data), 0)

        reports_response = self.client.get("/reports/api/reports/")
        self.assertEqual(reports_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(reports_response.data), 0)

    # 4 & 6. Resident submits a new report, guardian views it
    def test_resident_submits_report_and_guardian_views_it(self):
        self.client.force_authenticate(user=self.resident1)
        create_resp = self.client.post("/reports/api/reports/", {
            "title": "Water Leakage",
            "incident_type": "OTHER",
            "location": "Tower B, Flat 204",
            "description": "Pipe leaking in bathroom",
        })
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        report_id = create_resp.data["id"]

        # Guardian views report list and detail
        self.client.force_authenticate(user=self.guardian)
        list_resp = self.client.get("/reports/api/reports/")
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        report_ids = [r["id"] for r in list_resp.data]
        self.assertIn(report_id, report_ids)

        detail_resp = self.client.get(f"/reports/api/reports/{report_id}/")
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data["reporter_name"], "resident_one")
        self.assertEqual(detail_resp.data["incident_type"], "OTHER")
        self.assertEqual(detail_resp.data["location"], "Tower B, Flat 204")

    # 5 & 6. Resident triggers SOS alert, guardian views it
    def test_resident_triggers_sos_and_guardian_views_it(self):
        self.client.force_authenticate(user=self.resident1)
        sos_resp = self.client.post("/alerts/api/sos/", {
            "category": "MEDICAL",
            "message": "Chest pain, need help",
            "location_text": "Tower B, Flat 204",
        })
        self.assertEqual(sos_resp.status_code, status.HTTP_201_CREATED)
        alert_id = sos_resp.data["id"]

        # Guardian views SOS list and detail
        self.client.force_authenticate(user=self.guardian)
        list_resp = self.client.get("/alerts/api/sos/list/")
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        alert_ids = [a["id"] for a in list_resp.data]
        self.assertIn(alert_id, alert_ids)

        detail_resp = self.client.get(f"/alerts/api/sos/{alert_id}/")
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data["category"], "MEDICAL")
        self.assertEqual(detail_resp.data["message"], "Chest pain, need help")

    # 7. Guardian tries to access unrelated resident's report
    def test_guardian_cannot_access_unrelated_resident_report(self):
        # Create report for unrelated resident
        unrelated_report = EmergencyReport.objects.create(
            reporter=self.unrelated_resident,
            title="Private Issue",
            incident_type="SECURITY",
            location="Tower C",
            description="Private security issue",
        )

        self.client.force_authenticate(user=self.guardian)

        # Unrelated report must not be in list
        list_resp = self.client.get("/reports/api/reports/")
        report_ids = [r["id"] for r in list_resp.data]
        self.assertNotIn(unrelated_report.id, report_ids)

        # Direct ID access must return 404
        detail_resp = self.client.get(f"/reports/api/reports/{unrelated_report.id}/")
        self.assertEqual(detail_resp.status_code, status.HTTP_404_NOT_FOUND)

        # Guardian cannot edit unrelated report
        edit_resp = self.client.patch(f"/reports/api/reports/{unrelated_report.id}/", {
            "title": "Hacked Title"
        })
        self.assertEqual(edit_resp.status_code, status.HTTP_404_NOT_FOUND)

    # 8. Unauthenticated user tries to access Guardian APIs
    def test_unauthenticated_user_cannot_access_guardian_apis(self):
        self.client.force_authenticate(user=None)

        resp = self.client.get("/api/guardian-contacts/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        resp = self.client.get("/alerts/api/sos/list/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        resp = self.client.get("/reports/api/reports/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # 9. Admin functionality: assign and verify guardian contacts
    def test_admin_can_assign_and_verify_guardian(self):
        self.client.force_authenticate(user=self.admin)

        # Admin creates contact for resident2
        create_resp = self.client.post("/api/guardian-contacts/", {
            "resident": self.resident2.id,
            "name": "Admin Assigned Guardian",
            "relationship": "Mother",
            "phone_number": "9999999999",
            "email": "mom@example.com",
            "guardian_type": "PRIMARY",
        })
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        new_id = create_resp.data["id"]
        self.assertTrue(create_resp.data["is_verified"])

        # Admin lists residents for selection
        residents_resp = self.client.get("/api/guardian-contacts/residents/")
        self.assertEqual(residents_resp.status_code, status.HTTP_200_OK)
        resident_ids = [r["id"] for r in residents_resp.data]
        self.assertIn(self.resident1.id, resident_ids)
        self.assertIn(self.resident2.id, resident_ids)

        # Create unverified contact
        unverified_contact = GuardianContact.objects.create(
            resident=self.resident1,
            name="Unverified Brother",
            relationship="Brother",
            phone_number="9555555555",
            email="brother@example.com",
            guardian_type="SECONDARY",
            is_verified=False,
        )

        # Admin verifies it
        verify_resp = self.client.post(f"/api/guardian-contacts/{unverified_contact.id}/verify/")
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(verify_resp.data["is_verified"])
        unverified_contact.refresh_from_db()
        self.assertTrue(unverified_contact.is_verified)
