
from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from decimal import Decimal

from rest_framework.test import APIClient

from emergency_alerts.models import SOSNotification
from emergency_contacts.models import GuardianContact
from users.models import UserProfile
from .models import EmergencyReport


class EmergencyReportWebTests(TestCase):

    def setUp(self):
        self.resident = User.objects.create_user(
            username="resident1",
            password="TestPassword123"
        )

        UserProfile.objects.create(
            user=self.resident,
            role="resident",
            phone_number="9876501234"
        )

    def test_create_report_page_requires_login(self):
        response = self.client.get(
            reverse("emergency_reports:create_report")
        )
        self.assertEqual(response.status_code, 302)

    def test_resident_can_submit_report(self):
        self.client.force_login(self.resident)

        response = self.client.post(
            reverse("emergency_reports:create_report"),
            {
                "title": "Medical assistance request",
                "incident_type": "MEDICAL",
                "location": "Block A, Flat 101",
                "description": "A resident needs medical assistance.",
            }
        )

        self.assertRedirects(
            response,
            reverse("emergency_reports:create_report")
        )

        report = EmergencyReport.objects.get(
            reporter=self.resident
        )
        self.assertEqual(report.incident_type, "MEDICAL")
        self.assertEqual(report.status, "PENDING")

    def test_invalid_report_is_not_created(self):
        self.client.force_login(self.resident)

        response = self.client.post(
            reverse("emergency_reports:create_report"),
            {
                "incident_type": "INVALID",
                "location": "",
                "description": "",
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(EmergencyReport.objects.count(), 0)

    def test_resident_sees_only_their_own_reports(self):
        another_user = User.objects.create_user(
            username="resident2",
            password="TestPassword123"
        )

        EmergencyReport.objects.create(
            reporter=self.resident,
            incident_type="MEDICAL",
            location="Flat 101",
            description="My report"
        )

        EmergencyReport.objects.create(
            reporter=another_user,
            incident_type="FIRE",
            location="Flat 202",
            description="Another resident's report"
        )

        self.client.force_login(self.resident)

        response = self.client.get(
            reverse("emergency_reports:my_reports")
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "My report")
        self.assertNotContains(
            response, "Another resident's report"
        )


class EmergencyReportAPITests(TestCase):

    def setUp(self):
        self.resident = User.objects.create_user(
            username="resident1",
            password="TestPassword123"
        )

        UserProfile.objects.create(
            user=self.resident,
            role="resident",
            phone_number="9876501234"
        )

        self.other_resident = User.objects.create_user(
            username="resident2",
            password="TestPassword123"
        )

        UserProfile.objects.create(
            user=self.other_resident,
            role="resident",
            phone_number="9876501235"
        )

        self.security = User.objects.create_user(
            username="security1",
            password="TestPassword123"
        )

        UserProfile.objects.create(
            user=self.security,
            role="security",
            phone_number="9876501236",
            is_verified=True,
        )

        self.report = EmergencyReport.objects.create(
            reporter=self.other_resident,
            incident_type="FIRE",
            location="Block B",
            description="Fire reported in the building"
        )

        self.client_api = APIClient()

    def test_report_api_requires_authentication(self):
        response = self.client_api.get(
            reverse("emergency_reports:api_reports")
        )

        # DRF can return 401 or 403 depending on authentication settings.
        self.assertIn(response.status_code, [401, 403])

    def test_resident_only_sees_own_reports_in_api(self):
        self.client_api.force_authenticate(
            user=self.resident
        )

        EmergencyReport.objects.create(
            reporter=self.resident,
            incident_type="MEDICAL",
            location="Flat 101",
            description="My medical report"
        )

        response = self.client_api.get(
            reverse("emergency_reports:api_reports")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["description"],
            "My medical report"
        )

    def test_user_without_profile_can_access_only_their_own_reports(self):
        profileless_user = User.objects.create_user(
            username="profileless",
            password="test-password",
        )
        own_report = EmergencyReport.objects.create(
            reporter=profileless_user,
            incident_type="OTHER",
            location="Community garden",
            description="Loose railing requires attention",
        )
        self.client_api.force_authenticate(user=profileless_user)

        response = self.client_api.get(
            reverse("emergency_reports:api_reports")
        )
        forbidden_status_update = self.client_api.patch(
            reverse(
                "emergency_reports:api_report_status_update",
                kwargs={"pk": own_report.pk},
            ),
            {"status": "RESOLVED"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [own_report.pk])
        self.assertEqual(forbidden_status_update.status_code, 403)
        own_report.refresh_from_db()
        self.assertEqual(own_report.status, "PENDING")

    def test_unverified_responder_cannot_view_or_change_shared_reports(self):
        unverified_security = User.objects.create_user(
            username="unverified_report_desk",
            password="test-password",
        )
        UserProfile.objects.create(
            user=unverified_security,
            role="security",
            phone_number="9876501240",
            is_verified=False,
        )
        self.client_api.force_authenticate(user=unverified_security)

        list_response = self.client_api.get(
            reverse("emergency_reports:api_reports")
        )
        status_response = self.client_api.patch(
            reverse(
                "emergency_reports:api_report_status_update",
                kwargs={"pk": self.report.pk},
            ),
            {"status": "RESOLVED"},
            format="json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])
        self.assertEqual(status_response.status_code, 404)
        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "PENDING")

    def test_security_can_view_all_reports(self):
        self.client_api.force_authenticate(
            user=self.security
        )

        response = self.client_api.get(
            reverse("emergency_reports:api_reports")
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_security_can_filter_and_search_shared_reports(self):
        matching = EmergencyReport.objects.create(
            reporter=self.resident,
            incident_type="FIRE",
            location="North wing",
            description="Smoke near the stairwell",
            status="IN_PROGRESS",
        )
        self.client_api.force_authenticate(user=self.security)

        category_response = self.client_api.get(
            reverse("emergency_reports:api_reports"),
            {"category": "FIRE"},
        )
        status_response = self.client_api.get(
            reverse("emergency_reports:api_reports"),
            {"status": "IN_PROGRESS"},
        )
        search_response = self.client_api.get(
            reverse("emergency_reports:api_reports"),
            {"search": "stairwell"},
        )

        self.assertEqual(category_response.status_code, 200)
        self.assertEqual(
            {item["id"] for item in category_response.data},
            {matching.id, self.report.id},
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual([item["id"] for item in status_response.data], [matching.id])
        self.assertEqual(search_response.status_code, 200)
        self.assertEqual([item["id"] for item in search_response.data], [matching.id])

    def test_invalid_report_filter_is_rejected(self):
        self.client_api.force_authenticate(user=self.security)

        response = self.client_api.get(
            reverse("emergency_reports:api_reports"),
            {"category": "UNKNOWN"},
        )

        self.assertEqual(response.status_code, 400)

    def test_resident_cannot_update_report_status(self):
        self.client_api.force_authenticate(
            user=self.resident
        )

        response = self.client_api.patch(
            reverse(
                "emergency_reports:api_report_status_update",
                kwargs={"pk": self.report.pk}
            ),
            {"status": "RESOLVED"},
            format="json"
        )

        self.assertEqual(response.status_code, 404)

        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "PENDING")

    def test_security_can_update_report_status(self):
        self.client_api.force_authenticate(
            user=self.security
        )

        response = self.client_api.patch(
            reverse(
                "emergency_reports:api_report_status_update",
                kwargs={"pk": self.report.pk}
            ),
            {
                "status": "IN_PROGRESS",
                "response_notes": "Responder is on site.",
            },
            format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.report.refresh_from_db()
        self.assertEqual(self.report.status, "IN_PROGRESS")
        self.assertEqual(self.report.responded_by, self.security)
        self.assertEqual(self.report.response_notes, "Responder is on site.")
        self.assertEqual(response.data["responded_by_username"], self.security.username)

    def test_resident_cannot_access_another_residents_report(self):
        self.client_api.force_authenticate(
            user=self.resident
        )

        response = self.client_api.get(
            reverse(
                "emergency_reports:api_report_detail",
                kwargs={"pk": self.report.pk}
            )
        )

        self.assertEqual(response.status_code, 404)

    def test_api_assigns_logged_in_user_as_reporter(self):
        self.client_api.force_authenticate(
            user=self.resident
        )

        response = self.client_api.post(
            reverse("emergency_reports:api_reports"),
            {
                "title": "Medical assistance request",
                "incident_type": "MEDICAL",
                "location": "Flat 101",
                "description": "Need medical assistance",
                "reporter": self.other_resident.pk,
            },
            format="json"
        )

        self.assertEqual(response.status_code, 201, response.data)

        created_report = EmergencyReport.objects.get(
            description="Need medical assistance"
        )
        self.assertEqual(created_report.reporter, self.resident)

        list_response = self.client_api.get(
            reverse("emergency_reports:api_reports")
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["id"], created_report.id)
        self.assertEqual(list_response.data[0]["location"], "Flat 101")

    def test_api_route_used_by_frontend_resolves(self):
        self.client_api.force_authenticate(user=self.resident)

        response = self.client_api.get("/reports/api/reports/")

        self.assertEqual(response.status_code, 200)

    def test_all_supported_roles_can_create_reports_as_the_authenticated_user(self):
        role_users = [
            ("resident", "resident"),
            ("guardian", "guardian"),
            ("security", "security"),
            ("volunteer", "volunteer"),
        ]
        for index, (username, role) in enumerate(role_users):
            with self.subTest(role=role):
                user = User.objects.create_user(
                    username=f"report_{username}",
                    password="test-password",
                )
                UserProfile.objects.create(
                    user=user,
                    role=role,
                    phone_number=f"987650124{index}",
                    is_verified=role in {"security", "volunteer"},
                )
                self.client_api.force_authenticate(user=user)
                response = self.client_api.post(
                    "/reports/api/reports/",
                    {
                        "title": f"Report from {role}",
                        "incident_type": "MEDICAL",
                        "location": "North gate",
                        "description": f"Report from {role}",
                    },
                    format="json",
                )

                self.assertEqual(response.status_code, 201)
                saved_report = EmergencyReport.objects.get(pk=response.data["id"])
                self.assertEqual(saved_report.reporter, user)
                self.assertEqual(response.data["reporter"], user.pk)
                list_response = self.client_api.get("/reports/api/reports/")
                self.assertEqual(list_response.status_code, 200)
                self.assertIn(
                    saved_report.pk,
                    [item["id"] for item in list_response.data],
                )

        admin = User.objects.create_superuser(
            username="report_admin",
            email="report_admin@example.test",
            password="test-password",
        )
        self.client_api.force_authenticate(user=admin)
        admin_response = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Admin report",
                "incident_type": "OTHER",
                "location": "Control room",
                "description": "Admin report",
            },
            format="json",
        )

        self.assertEqual(admin_response.status_code, 201, admin_response.data)
        self.assertEqual(
            EmergencyReport.objects.get(pk=admin_response.data["id"]).reporter,
            admin,
        )
        admin_list_response = self.client_api.get("/reports/api/reports/")
        self.assertEqual(admin_list_response.status_code, 200)
        self.assertIn(
            admin_response.data["id"],
            [item["id"] for item in admin_list_response.data],
        )

    def test_api_requires_incident_title(self):
        self.client_api.force_authenticate(user=self.resident)

        response = self.client_api.post(
            "/reports/api/reports/",
            {
                "incident_type": "OTHER",
                "location": "Community garden",
                "description": "A damaged gate needs attention.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data)

    def test_admin_is_notified_when_resident_creates_report(self):
        admin = User.objects.create_superuser(
            username="report_admin_notification",
            email="report_admin_notification@example.test",
            password="AdminPassword123!",
        )
        unverified_security = User.objects.create_user(
            username="unverified_report_security",
            password="TestPassword123!",
        )
        UserProfile.objects.create(
            user=unverified_security,
            role="security",
            phone_number="9876501404",
            is_verified=False,
        )
        self.client_api.force_authenticate(user=self.resident)

        response = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Blocked exit",
                "incident_type": "SECURITY",
                "location": "North exit",
                "description": "Emergency exit is blocked.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        report = EmergencyReport.objects.get(pk=response.data["id"])
        notification = SOSNotification.objects.get(
            report=report,
            recipient=admin,
            notification_type="REPORT_CREATED",
        )
        security_notification = SOSNotification.objects.get(
            report=report,
            recipient=self.security,
            notification_type="REPORT_CREATED",
        )
        self.assertFalse(
            SOSNotification.objects.filter(
                report=report,
                recipient=unverified_security,
                notification_type="REPORT_CREATED",
            ).exists()
        )
        self.assertEqual(notification.status, "PENDING")
        self.assertEqual(notification.channel, "IN_APP")

        self.client_api.force_authenticate(user=admin)
        inbox = self.client_api.get("/alerts/api/notifications/")
        self.assertEqual(inbox.status_code, 200)
        serialized = next(item for item in inbox.data if item["id"] == notification.pk)
        self.assertEqual(serialized["report_id"], report.pk)
        self.assertIsNone(serialized["alert_id"])
        self.assertEqual(serialized["title"], "New emergency report")
        self.assertNotIn(
            security_notification.pk,
            {item["id"] for item in inbox.data},
        )
        self.assertEqual(
            self.client_api.get("/alerts/api/notifications/unread-count/").data["count"],
            1,
        )
        read_response = self.client_api.patch(
            f"/alerts/api/notifications/{notification.pk}/read/",
            {},
            format="json",
        )
        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(
            self.client_api.get("/alerts/api/notifications/unread-count/").data["count"],
            0,
        )
        self.client_api.force_authenticate(user=self.security)
        security_inbox = self.client_api.get("/alerts/api/notifications/")
        self.assertTrue(
            any(item["id"] == security_notification.pk for item in security_inbox.data)
        )
        self.client_api.force_authenticate(user=self.other_resident)
        other_inbox = self.client_api.get("/alerts/api/notifications/")
        self.assertFalse(any(item["report_id"] == report.pk for item in other_inbox.data))

    def test_admin_can_assign_only_available_verified_volunteers(self):
        admin = User.objects.create_superuser(
            username="assignment_admin",
            email="assignment_admin@example.test",
            password="AdminPassword123!",
        )
        volunteer = User.objects.create_user(
            username="available_volunteer",
            password="VolunteerPassword123!",
        )
        UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876501401",
            is_verified=True,
        )
        report = EmergencyReport.objects.create(
            reporter=self.resident,
            title="Medical assistance",
            incident_type="MEDICAL",
            location="Block A",
            description="Medical help requested.",
            status="ACKNOWLEDGED",
        )
        self.client_api.force_authenticate(user=admin)

        volunteers_response = self.client_api.get("/reports/api/volunteers/")
        assignment_response = self.client_api.post(
            f"/reports/api/reports/{report.pk}/assign/",
            {"volunteer_id": volunteer.pk},
            format="json",
        )

        self.assertEqual(volunteers_response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in volunteers_response.data],
            [volunteer.pk],
        )
        self.assertEqual(assignment_response.status_code, 201, assignment_response.data)
        report.refresh_from_db()
        self.assertEqual(report.assigned_volunteer, volunteer)
        self.assertEqual(report.status, "ASSIGNED")
        self.assertTrue(
            report.events.filter(
                event_type="ASSIGNED",
                actor=admin,
                from_status="ACKNOWLEDGED",
                to_status="ASSIGNED",
            ).exists()
        )
        self.assertTrue(
            SOSNotification.objects.filter(
                report=report,
                recipient=volunteer,
                notification_type="REPORT_ASSIGNED",
                status="PENDING",
            ).exists()
        )

    def test_volunteer_sees_only_own_and_assigned_reports(self):
        volunteer = User.objects.create_user(
            username="report_volunteer",
            password="VolunteerPassword123!",
        )
        UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876501402",
            is_verified=True,
        )
        own_report = EmergencyReport.objects.create(
            reporter=volunteer,
            title="Volunteer report",
            incident_type="OTHER",
            location="South gate",
            description="A light is broken.",
        )
        assigned_report = EmergencyReport.objects.create(
            reporter=self.resident,
            assigned_volunteer=volunteer,
            title="Assigned report",
            incident_type="FIRE",
            location="Block C",
            description="Smoke alarm sounded.",
            status="ASSIGNED",
        )
        self.client_api.force_authenticate(user=volunteer)

        list_response = self.client_api.get("/reports/api/reports/")
        own_detail = self.client_api.get(
            f"/reports/api/reports/{own_report.pk}/"
        )
        assigned_detail = self.client_api.get(
            f"/reports/api/reports/{assigned_report.pk}/"
        )
        unrelated_detail = self.client_api.get(
            f"/reports/api/reports/{self.report.pk}/"
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(
            {item["id"] for item in list_response.data},
            {own_report.pk, assigned_report.pk},
        )
        self.assertEqual(own_detail.status_code, 200)
        self.assertEqual(assigned_detail.status_code, 200)
        self.assertEqual(unrelated_detail.status_code, 404)

    def test_assigned_volunteer_status_changes_create_history_and_private_reporter_notifications(self):
        volunteer = User.objects.create_user(
            username="responding_volunteer",
            password="VolunteerPassword123!",
        )
        UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876501403",
            is_verified=True,
        )
        report = EmergencyReport.objects.create(
            reporter=self.resident,
            assigned_volunteer=volunteer,
            title="Medical assistance",
            incident_type="MEDICAL",
            location="Block A",
            description="Medical help requested.",
            status="ASSIGNED",
        )
        self.client_api.force_authenticate(user=volunteer)

        in_progress = self.client_api.patch(
            f"/reports/api/reports/{report.pk}/status/",
            {"status": "IN_PROGRESS"},
            format="json",
        )
        resolved = self.client_api.patch(
            f"/reports/api/reports/{report.pk}/status/",
            {"status": "RESOLVED", "response_notes": "Resident assisted."},
            format="json",
        )

        self.assertEqual(in_progress.status_code, 200, in_progress.data)
        self.assertEqual(resolved.status_code, 200, resolved.data)
        report.refresh_from_db()
        self.assertEqual(report.status, "RESOLVED")
        self.assertEqual(report.responded_by, volunteer)
        self.assertEqual(
            report.events.filter(event_type="STATUS_CHANGED").count(),
            2,
        )
        self.assertEqual(
            SOSNotification.objects.filter(
                report=report,
                recipient=self.resident,
                notification_type__startswith="REPORT_STATUS_",
            ).count(),
            2,
        )

        self.client_api.force_authenticate(user=self.other_resident)
        private_notifications = self.client_api.get("/alerts/api/notifications/")
        self.assertEqual(private_notifications.status_code, 200)
        self.assertFalse(
            any(item["report_id"] == report.pk for item in private_notifications.data)
        )

    def test_report_coordinates_are_persisted_at_six_decimal_places(self):
        self.client_api.force_authenticate(user=self.resident)

        response = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Medical assistance",
                "incident_type": "MEDICAL",
                "location": "Block A",
                "description": "Medical assistance required.",
                "latitude": 12.971599,
                "longitude": 77.594563,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        saved_report = EmergencyReport.objects.get(pk=response.data["id"])
        self.assertEqual(saved_report.reporter, self.resident)
        self.assertEqual(saved_report.latitude, Decimal("12.971599"))
        self.assertEqual(saved_report.longitude, Decimal("77.594563"))
        self.assertEqual(response.data["latitude"], "12.971599")
        self.assertEqual(response.data["longitude"], "77.594563")

    def test_report_coordinates_accept_valid_bounds_and_reject_invalid_values(self):
        self.client_api.force_authenticate(user=self.resident)
        base_payload = {
            "title": "Damaged gate",
            "incident_type": "OTHER",
            "location": "Community garden",
            "description": "A damaged gate needs attention.",
        }

        valid_response = self.client_api.post(
            "/reports/api/reports/",
            {**base_payload, "latitude": -90, "longitude": 180},
            format="json",
        )
        self.assertEqual(valid_response.status_code, 201, valid_response.data)

        invalid_payloads = [
            {"latitude": 90.000001, "longitude": 77},
            {"latitude": 12, "longitude": -180.000001},
            {"latitude": 12},
        ]
        for coordinates in invalid_payloads:
            with self.subTest(coordinates=coordinates):
                response = self.client_api.post(
                    "/reports/api/reports/",
                    {**base_payload, **coordinates},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)


class GuardianEmergencyReportVisibilityTests(TestCase):

    def setUp(self):
        self.client_api = APIClient()

        # Resident
        self.resident = User.objects.create_user(
            username="test_resident",
            email="resident@example.com",
            password="ResidentPassword123!",
        )
        UserProfile.objects.create(
            user=self.resident,
            role="resident",
            phone_number="9876501111",
            is_verified=True,
        )

        # Unrelated resident
        self.other_resident = User.objects.create_user(
            username="other_resident",
            email="other_resident@example.com",
            password="OtherResidentPassword123!",
        )
        UserProfile.objects.create(
            user=self.other_resident,
            role="resident",
            phone_number="9876502222",
            is_verified=True,
        )

        # Guardian linked by email
        self.email_guardian = User.objects.create_user(
            username="email_guardian",
            email="email_guardian@example.com",
            password="GuardianPassword123!",
        )
        UserProfile.objects.create(
            user=self.email_guardian,
            role="guardian",
            phone_number="9876503333",
            is_verified=True,
        )
        GuardianContact.objects.create(
            resident=self.resident,
            name="Email Guardian",
            relationship="Father",
            phone_number="9876503333",
            email="email_guardian@example.com",
            guardian_type="PRIMARY",
            is_verified=True,
        )

        # Guardian linked by phone (no email on account)
        self.phone_guardian = User.objects.create_user(
            username="phone_guardian",
            email="",
            password="GuardianPassword123!",
        )
        UserProfile.objects.create(
            user=self.phone_guardian,
            role="guardian",
            phone_number="+91 98765 04444",
            is_verified=True,
        )
        GuardianContact.objects.create(
            resident=self.resident,
            name="Phone Guardian",
            relationship="Brother",
            phone_number="9876504444",
            email="",
            guardian_type="SECONDARY",
            is_verified=True,
        )

        # Unlinked guardian
        self.unlinked_guardian = User.objects.create_user(
            username="unlinked_guardian",
            email="unlinked@example.com",
            password="UnlinkedPassword123!",
        )
        UserProfile.objects.create(
            user=self.unlinked_guardian,
            role="guardian",
            phone_number="9876505555",
            is_verified=True,
        )

    def test_guardian_can_view_linked_resident_emergency_reports_and_events(self):
        # Resident submits report
        self.client_api.force_authenticate(user=self.resident)
        create_res = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Water leakage in kitchen",
                "incident_type": "OTHER",
                "location": "Tower B - 402",
                "description": "Pipe burst under the sink.",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, 201)
        report_id = create_res.data["id"]

        # Other resident submits report
        self.client_api.force_authenticate(user=self.other_resident)
        other_res = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Unrelated issue",
                "incident_type": "OTHER",
                "location": "Tower A - 101",
                "description": "Private issue of another resident.",
            },
            format="json",
        )
        self.assertEqual(other_res.status_code, 201)
        other_report_id = other_res.data["id"]

        # Email guardian verifies linked report is visible and other report is NOT
        for guardian_user in [self.email_guardian, self.phone_guardian]:
            with self.subTest(guardian=guardian_user.username):
                self.client_api.force_authenticate(user=guardian_user)
                list_res = self.client_api.get("/reports/api/reports/")
                self.assertEqual(list_res.status_code, 200)
                visible_ids = [r["id"] for r in list_res.data]
                self.assertIn(report_id, visible_ids)
                self.assertNotIn(other_report_id, visible_ids)

                # Report detail access
                detail_res = self.client_api.get(f"/reports/api/reports/{report_id}/")
                self.assertEqual(detail_res.status_code, 200)
                self.assertEqual(detail_res.data["title"], "Water leakage in kitchen")
                self.assertEqual(detail_res.data["status"], "PENDING")

                # Report history access
                history_res = self.client_api.get(f"/reports/api/reports/{report_id}/history/")
                self.assertEqual(history_res.status_code, 200)
                self.assertTrue(len(history_res.data) >= 1)
                self.assertEqual(history_res.data[0]["event_type"], "CREATED")

                # Unrelated report detail should be 404
                unrelated_res = self.client_api.get(f"/reports/api/reports/{other_report_id}/")
                self.assertEqual(unrelated_res.status_code, 404)

    def test_unlinked_guardian_cannot_view_unrelated_reports(self):
        self.client_api.force_authenticate(user=self.resident)
        create_res = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Elevator stuck",
                "incident_type": "OTHER",
                "location": "Tower B",
                "description": "Elevator stuck on 3rd floor.",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, 201)
        report_id = create_res.data["id"]

        self.client_api.force_authenticate(user=self.unlinked_guardian)
        list_res = self.client_api.get("/reports/api/reports/")
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.data), 0)

        detail_res = self.client_api.get(f"/reports/api/reports/{report_id}/")
        self.assertEqual(detail_res.status_code, 404)

    def test_guardian_receives_in_app_notification_on_creation_and_status_update(self):
        # Admin user to update status
        admin = User.objects.create_superuser(
            username="status_admin",
            email="admin@example.com",
            password="AdminPassword123!",
        )

        self.client_api.force_authenticate(user=self.resident)
        create_res = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Smoke in corridor",
                "incident_type": "FIRE",
                "location": "Tower B - Corridor 4",
                "description": "Smoke detected near apartment 402.",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, 201)
        report_id = create_res.data["id"]

        # Both email and phone guardians should have received REPORT_CREATED notification
        for guardian_user in [self.email_guardian, self.phone_guardian]:
            self.assertTrue(
                SOSNotification.objects.filter(
                    report_id=report_id,
                    recipient=guardian_user,
                    notification_type="REPORT_CREATED",
                ).exists()
            )

        # Admin acknowledges report
        self.client_api.force_authenticate(user=admin)
        patch_res = self.client_api.patch(
            f"/reports/api/reports/{report_id}/status/",
            {"status": "ACKNOWLEDGED", "response_notes": "Security dispatched."},
            format="json",
        )
        self.assertEqual(patch_res.status_code, 200)

        # Both guardians should have received status update notification
        for guardian_user in [self.email_guardian, self.phone_guardian]:
            self.assertTrue(
                SOSNotification.objects.filter(
                    report_id=report_id,
                    recipient=guardian_user,
                    notification_type="REPORT_STATUS_ACKNOWLEDGED",
                ).exists()
            )

    def test_guardian_cannot_modify_report_status_or_assign_volunteers(self):
        self.client_api.force_authenticate(user=self.resident)
        create_res = self.client_api.post(
            "/reports/api/reports/",
            {
                "title": "Broken window",
                "incident_type": "OTHER",
                "location": "Tower B - 402",
                "description": "Window crack.",
            },
            format="json",
        )
        report_id = create_res.data["id"]

        self.client_api.force_authenticate(user=self.email_guardian)
        patch_res = self.client_api.patch(
            f"/reports/api/reports/{report_id}/status/",
            {"status": "ACKNOWLEDGED"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, 403)

        assign_res = self.client_api.post(
            f"/reports/api/reports/{report_id}/assign/",
            {"volunteer_id": 999},
            format="json",
        )
        self.assertEqual(assign_res.status_code, 403)
