
from concurrent.futures import ThreadPoolExecutor
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from django.urls import reverse
from decimal import Decimal
from threading import Barrier
from rest_framework.test import APIClient
from uuid import uuid4
from django.utils import timezone

from .models import (
    ResponderArrivalConfirmation,
    ResponderAssignment,
    SOSAlert,
    SOSAlertEvent,
    SOSNotification,
)
from emergency_contacts.models import GuardianContact
from society.models import Block, Flat, Society
from users.models import UserProfile


User = get_user_model()


class SOSNotificationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.resident = User.objects.create_user(
            username="test_resident",
            password="TestPassword123!",
        )

        self.guardian = User.objects.create_user(
            username="test_guardian",
            password="TestPassword123!",
        )

        self.other_guardian = User.objects.create_user(
            username="other_guardian",
            password="TestPassword123!",
        )

        self.alert = SOSAlert.objects.create(
            reporter=self.resident,
            category="MEDICAL",
            message="Test medical emergency",
        )

        self.notification = SOSNotification.objects.create(
            alert=self.alert,
            recipient=self.guardian,
            channel="IN_APP",
            status="PENDING",
            message="A medical SOS alert was raised.",
        )

        self.other_notification = SOSNotification.objects.create(
            alert=self.alert,
            recipient=self.other_guardian,
            channel="IN_APP",
            status="PENDING",
            message="A medical SOS alert was raised.",
        )

        # Use the API prefix configured in your project.
        self.notifications_url = "/alerts/api/notifications/"
        self.sos_list_url = "/alerts/api/sos/list/"

    def acknowledge_alert(self):
        security = User.objects.create_user(
            username=f"security_for_{self.alert.pk}",
            password="TestPassword!123",
        )
        UserProfile.objects.create(
            user=security,
            role="security",
            phone_number="9876500099",
            is_verified=True,
        )
        self.client.force_authenticate(user=security)
        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "ACKNOWLEDGED"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        return security

    def report_arrival(self, assignment, responder):
        self.client.force_authenticate(user=responder)
        return self.client.post(
            f"/alerts/api/sos/{assignment.alert_id}/check-in/",
            {},
            format="json",
        )

    def confirm_arrival(self, assignment, confirmer, confirmation_note=""):
        self.client.force_authenticate(user=confirmer)
        return self.client.post(
            f"/alerts/api/sos/{assignment.alert_id}/assignments/"
            f"{assignment.pk}/confirm-arrival/",
            {"confirmation_note": confirmation_note},
            format="json",
        )

    def test_guardian_can_view_own_notifications(self):
        self.client.force_authenticate(user=self.guardian)

        response = self.client.get(self.notifications_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["id"],
            self.notification.id,
        )

    def test_guardian_cannot_view_another_guardians_notifications(self):
        self.client.force_authenticate(user=self.guardian)

        response = self.client.get(self.notifications_url)

        self.assertEqual(response.status_code, 200)

        notification_ids = [
            item["id"] for item in response.data
        ]

        self.assertNotIn(
            self.other_notification.id,
            notification_ids,
        )

    def test_guardian_can_mark_own_notification_as_read(self):
        self.client.force_authenticate(user=self.guardian)

        url = (
            f"{self.notifications_url}"
            f"{self.notification.id}/read/"
        )

        response = self.client.patch(url, {}, format="json")

        self.assertEqual(response.status_code, 200)

        self.notification.refresh_from_db()

        self.assertEqual(self.notification.status, "READ")
        self.assertIsNotNone(self.notification.read_at)

    def test_guardian_cannot_mark_another_users_notification_as_read(self):
        self.client.force_authenticate(user=self.guardian)

        url = (
            f"{self.notifications_url}"
            f"{self.other_notification.id}/read/"
        )

        response = self.client.patch(url, {}, format="json")

        self.assertEqual(response.status_code, 404)

        self.other_notification.refresh_from_db()

        self.assertEqual(
            self.other_notification.status,
            "PENDING",
        )
        self.assertIsNone(self.other_notification.read_at)

    def test_unread_count_and_mark_all_read_are_private_and_persistent(self):
        self.client.force_authenticate(user=self.guardian)

        unread_before = self.client.get(
            "/alerts/api/notifications/unread-count/"
        )
        marked = self.client.patch(
            "/alerts/api/notifications/read-all/",
            {},
            format="json",
        )
        unread_after = self.client.get(
            "/alerts/api/notifications/unread-count/"
        )

        self.assertEqual(unread_before.status_code, 200)
        self.assertEqual(unread_before.data["count"], 1)
        self.assertEqual(marked.status_code, 200)
        self.assertEqual(marked.data["updated"], 1)
        self.assertEqual(unread_after.data["count"], 0)
        self.notification.refresh_from_db()
        self.other_notification.refresh_from_db()
        self.assertEqual(self.notification.status, "READ")
        self.assertIsNotNone(self.notification.read_at)
        self.assertEqual(self.other_notification.status, "PENDING")
        self.assertIsNone(self.other_notification.read_at)

    def test_resident_can_read_their_sos_status(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/status/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(self.alert.pk))
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["counts"]["total_recipients"], 2)
        self.assertEqual(response.data["counts"]["sent"], 2)
        self.assertFalse(response.data["is_simulated"])

    def test_sos_status_reports_read_receipts_without_double_counting(self):
        self.notification.status = "READ"
        self.notification.save(update_fields=["status"])
        self.client.force_authenticate(user=self.resident)

        response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/status/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["counts"]["total_recipients"], 2)
        self.assertEqual(response.data["counts"]["sent"], 2)
        self.assertEqual(response.data["counts"]["delivered"], 1)
        self.assertTrue(response.data["stages"]["delivered"])

    def test_resident_sees_only_their_own_sos_alerts(self):
        another_resident = User.objects.create_user(
            username="another_resident",
            password="test-password",
        )
        another_alert = SOSAlert.objects.create(
            reporter=another_resident,
            category="FIRE",
        )
        self.client.force_authenticate(user=self.resident)

        response = self.client.get(self.sos_list_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [alert["id"] for alert in response.data],
            [self.alert.id],
        )
        self.assertNotIn(another_alert.id, [alert["id"] for alert in response.data])

    def test_guardian_sees_only_linked_residents_alerts(self):
        guardian = User.objects.create_user(
            username="linked_guardian",
            email="linked.guardian@example.com",
            password="test-password",
        )
        UserProfile.objects.create(
            user=guardian,
            role="guardian",
            phone_number="9876500002",
        )
        GuardianContact.objects.create(
            resident=self.resident,
            name="Linked Guardian",
            relationship="Family",
            phone_number="9876500002",
            email=guardian.email,
            guardian_type="PRIMARY",
            is_verified=True,
        )
        another_resident = User.objects.create_user(
            username="unlinked_resident",
            password="test-password",
        )
        unrelated_alert = SOSAlert.objects.create(
            reporter=another_resident,
            category="FIRE",
        )
        self.client.force_authenticate(user=guardian)

        list_response = self.client.get(self.sos_list_url)
        linked_detail = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/"
        )
        unrelated_detail = self.client.get(
            f"/alerts/api/sos/{unrelated_alert.pk}/"
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(
            [alert["id"] for alert in list_response.data],
            [self.alert.id],
        )
        self.assertEqual(linked_detail.status_code, 200)
        self.assertEqual(unrelated_detail.status_code, 404)

    def test_security_can_view_all_sos_alerts_and_details(self):
        security = User.objects.create_user(
            username="test_security",
            password="test-password",
        )
        UserProfile.objects.create(
            user=security,
            role="security",
            phone_number="9876500001",
            is_verified=True,
        )
        another_resident = User.objects.create_user(
            username="another_resident",
            password="test-password",
        )
        another_alert = SOSAlert.objects.create(
            reporter=another_resident,
            category="FIRE",
        )
        self.client.force_authenticate(user=security)

        response = self.client.get(self.sos_list_url)
        detail_response = self.client.get(
            f"/alerts/api/sos/{another_alert.pk}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {alert["id"] for alert in response.data},
            {self.alert.id, another_alert.id},
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assertFalse(detail_response.data["is_reporter"])

    def test_unverified_responder_cannot_view_shared_board_or_assign(self):
        unverified_security = User.objects.create_user(
            username="unverified_desk",
            password="test-password",
        )
        UserProfile.objects.create(
            user=unverified_security,
            role="security",
            phone_number="9876500031",
            is_verified=False,
        )
        self.client.force_authenticate(user=unverified_security)

        list_response = self.client.get(self.sos_list_url)
        detail_response = self.client.get(f"/alerts/api/sos/{self.alert.pk}/")
        responders_response = self.client.get("/alerts/api/responders/")
        assignment_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/assign/",
            {"responder_id": unverified_security.pk},
            format="json",
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data, [])
        self.assertEqual(detail_response.status_code, 404)
        self.assertEqual(responders_response.status_code, 403)
        self.assertEqual(assignment_response.status_code, 403)

    def test_sos_detail_includes_frontend_incident_fields(self):
        self.alert.latitude = 12.9716
        self.alert.longitude = 77.5946
        self.alert.save(update_fields=["latitude", "longitude"])
        self.client.force_authenticate(user=self.resident)

        response = self.client.get(f"/alerts/api/sos/{self.alert.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.alert.pk)
        self.assertEqual(response.data["reporter_username"], self.resident.username)
        self.assertEqual(response.data["category"], "MEDICAL")
        self.assertEqual(response.data["status"], "PENDING")
        self.assertTrue(response.data["is_reporter"])
        self.assertTrue(response.data["has_location"])
        self.assertEqual(response.data["notifications_summary"]["total"], 2)

    def test_sos_without_gps_uses_registered_flat_as_a_text_location(self):
        society = Society.objects.create(
            name="Green Meadows",
            address="Main Road",
            city="Vijayawada",
            pincode="520010",
        )
        block = Block.objects.create(society=society, name="B")
        flat = Flat.objects.create(
            block=block,
            flat_number="304",
            floor_number=3,
        )
        flat.residents.add(self.resident)
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            "/alerts/api/sos/",
            {"category": "MEDICAL", "message": "Need assistance"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        alert = SOSAlert.objects.get(pk=response.data["id"])
        self.assertIsNone(alert.latitude)
        self.assertIsNone(alert.longitude)
        self.assertEqual(alert.location_text, "B-304, Green Meadows")
        detail_response = self.client.get(f"/alerts/api/sos/{alert.pk}/")
        self.assertEqual(detail_response.data["location_text"], "B-304, Green Meadows")
        self.assertFalse(detail_response.data["has_location"])
        self.assertIsNone(detail_response.data["location"])

    def test_reporter_can_add_text_location_to_existing_alert_with_audit_event(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.patch(
            f"/alerts/api/sos/{self.alert.pk}/location/",
            {"location_text": "Building B, entrance near the garden"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["location_text"],
            "Building B, entrance near the garden",
        )
        self.alert.refresh_from_db()
        self.assertIsNone(self.alert.latitude)
        self.assertEqual(
            self.alert.events.filter(event_type="LOCATION_UPDATED").count(),
            1,
        )

    def test_unrelated_user_cannot_update_an_alert_location(self):
        self.client.force_authenticate(user=self.guardian)

        response = self.client.patch(
            f"/alerts/api/sos/{self.alert.pk}/location/",
            {"location_text": "Untrusted location"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.location_text, "")

    def test_admin_can_view_all_sos_alerts_and_details(self):
        admin = User.objects.create_superuser(
            username="test_admin",
            email="admin@example.com",
            password="test-password",
        )
        self.client.force_authenticate(user=admin)

        response = self.client.get(self.sos_list_url)
        detail_response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(self.alert.id, [alert["id"] for alert in response.data])
        self.assertEqual(detail_response.status_code, 200)
        self.assertFalse(detail_response.data["is_reporter"])

    def test_resident_cannot_view_another_users_sos_detail(self):
        another_resident = User.objects.create_user(
            username="another_resident",
            password="test-password",
        )
        another_alert = SOSAlert.objects.create(
            reporter=another_resident,
            category="FIRE",
        )
        self.client.force_authenticate(user=self.resident)

        response = self.client.get(
            f"/alerts/api/sos/{another_alert.pk}/"
        )

        self.assertEqual(response.status_code, 404)

    def test_security_can_assign_verified_responder_check_in_and_resident_confirm(self):
        security = User.objects.create_user(
            username="assignment_security",
            password="test-password",
        )
        UserProfile.objects.create(
            user=security,
            role="security",
            phone_number="9876500011",
            is_verified=True,
        )
        responder = User.objects.create_user(
            username="assignment_volunteer",
            first_name="Volunteer",
            last_name="One",
            password="test-password",
        )
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500012",
            is_verified=True,
        )
        self.alert.latitude = 12.9716
        self.alert.longitude = 77.5946
        self.alert.save(update_fields=["latitude", "longitude"])
        self.client.force_authenticate(user=security)

        responders_response = self.client.get("/alerts/api/responders/")
        assignment_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/assign/",
            {"responder_id": responder.pk},
            format="json",
        )
        duplicate_assignment_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/assign/",
            {"responder_id": responder.pk},
            format="json",
        )

        self.assertEqual(responders_response.status_code, 200)
        self.assertEqual(
            {item["id"] for item in responders_response.data},
            {security.pk, responder.pk},
        )
        self.assertEqual(assignment_response.status_code, 201)
        self.assertEqual(duplicate_assignment_response.status_code, 200)
        self.assertEqual(
            ResponderAssignment.objects.filter(
                alert=self.alert,
                responder=responder,
            ).count(),
            1,
        )

        security = self.acknowledge_alert()
        self.client.force_authenticate(user=responder)
        detail_response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/"
        )
        check_in_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/check-in/",
            {"latitude": 12.9717, "longitude": 77.5947},
            format="json",
        )
        self.assertTrue(detail_response.data["can_check_in"])
        self.assertEqual(check_in_response.status_code, 200)
        self.assertIsNotNone(check_in_response.data["checked_in_at"])
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "ACKNOWLEDGED")

        assignment = ResponderAssignment.objects.get(
            alert=self.alert,
            responder=responder,
        )
        confirmation_response = self.confirm_arrival(assignment, security)
        self.assertEqual(confirmation_response.status_code, 201)
        confirmation = ResponderArrivalConfirmation.objects.get(
            assignment=assignment,
        )
        self.assertEqual(confirmation.confirmed_by, security)
        self.assertEqual(confirmation.confirmed_by_role, "SECURITY")
        self.assertEqual(confirmation.confirmation_result, "CONFIRMED")
        self.assertEqual(
            confirmation_response.data["arrival_confirmation"]["id"],
            confirmation.pk,
        )
        self.assertTrue(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                actor=security,
                event_type="RESPONDER_ARRIVAL_CONFIRMED",
            ).exists()
        )
        start_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )
        self.assertEqual(start_response.status_code, 200)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "IN_PROGRESS")

        self.client.force_authenticate(user=self.resident)
        acknowledgment_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/resident-acknowledge/",
            {},
            format="json",
        )
        detail_response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/"
        )
        self.assertEqual(acknowledgment_response.status_code, 200)
        self.assertIsNotNone(detail_response.data["resident_acknowledged_at"])

    def test_admin_assigns_sos_to_volunteer_and_volunteer_keeps_scoped_access(self):
        admin = User.objects.create_superuser(
            username="volunteer_flow_admin",
            email="volunteer-flow-admin@example.test",
            password="AdminPassword123",
        )
        volunteer = User.objects.create_user(
            username="volunteer01",
            email="volunteer01@example.test",
            password="VolunteerPassword123",
        )
        UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876500041",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.resident)
        create_response = self.client.post(
            "/alerts/api/sos/",
            {
                "category": "FIRE",
                "message": "Smoke near the east entrance",
                "latitude": 12.9716,
                "longitude": 77.5946,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        alert = SOSAlert.objects.get(pk=create_response.data["id"])
        self.assertFalse(
            SOSNotification.objects.filter(
                alert=alert,
                recipient=volunteer,
                channel="IN_APP",
            ).exists()
        )

        self.client.force_authenticate(user=admin)
        responders_response = self.client.get("/alerts/api/responders/")
        self.assertEqual(responders_response.status_code, 200)
        self.assertIn(volunteer.pk, {item["id"] for item in responders_response.data})
        assignment_response = self.client.post(
            f"/alerts/api/sos/{alert.pk}/assign/",
            {"responder_id": volunteer.pk},
            format="json",
        )
        duplicate_assignment_response = self.client.post(
            f"/alerts/api/sos/{alert.pk}/assign/",
            {"responder_id": volunteer.pk},
            format="json",
        )
        self.assertEqual(assignment_response.status_code, 201)
        self.assertEqual(duplicate_assignment_response.status_code, 200)
        assignment = ResponderAssignment.objects.get(
            alert=alert,
            responder=volunteer,
        )
        self.assertEqual(
            SOSNotification.objects.filter(
                alert=alert,
                recipient=volunteer,
                notification_type="SOS_ASSIGNED",
            ).count(),
            1,
        )

        self.client.force_authenticate(user=volunteer)
        volunteer_incidents = self.client.get(self.sos_list_url)
        self.assertEqual(
            [item["id"] for item in volunteer_incidents.data],
            [alert.pk],
        )
        detail_response = self.client.get(f"/alerts/api/sos/{alert.pk}/")
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.data["my_assignment"]["id"], assignment.pk)
        self.assertFalse(detail_response.data["can_check_in"])

        inbox_response = self.client.get(self.notifications_url)
        assignment_notification = next(
            notification
            for notification in inbox_response.data
            if notification["notification_type"] == "SOS_ASSIGNED"
        )
        self.assertEqual(assignment_notification["alert_id"], alert.pk)
        self.assertEqual(assignment_notification["status"], "PENDING")
        assignment_notification_id = assignment_notification["id"]

        other_volunteer = User.objects.create_user(
            username="other_volunteer",
            email="other-volunteer@example.test",
            password="VolunteerPassword123",
        )
        UserProfile.objects.create(
            user=other_volunteer,
            role="volunteer",
            phone_number="9876500042",
            is_verified=True,
        )
        self.client.force_authenticate(user=other_volunteer)
        self.assertEqual(
            self.client.get(self.sos_list_url).data,
            [],
        )
        self.assertEqual(
            self.client.get(f"/alerts/api/sos/{alert.pk}/").status_code,
            404,
        )

        self.client.force_authenticate(user=volunteer)
        self.assertEqual(self.client.get("/alerts/api/responders/").status_code, 403)
        self.assertEqual(
            self.client.post(
                f"/alerts/api/sos/{alert.pk}/assign/",
                {"responder_id": other_volunteer.pk},
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f"/alerts/api/sos/{alert.pk}/transition/",
                {"status": "IN_PROGRESS"},
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f"/alerts/api/sos/{alert.pk}/transition/",
                {"status": "RESOLVED"},
                format="json",
            ).status_code,
            403,
        )

        self.client.force_authenticate(user=admin)
        self.assertEqual(
            self.client.post(
                f"/alerts/api/sos/{alert.pk}/transition/",
                {"status": "ACKNOWLEDGED"},
                format="json",
            ).status_code,
            200,
        )
        self.client.force_authenticate(user=volunteer)
        self.assertTrue(
            self.client.get(f"/alerts/api/sos/{alert.pk}/").data["can_check_in"]
        )
        check_in_response = self.client.post(
            f"/alerts/api/sos/{alert.pk}/check-in/",
            {"latitude": 12.9717, "longitude": 77.5947},
            format="json",
        )
        self.assertEqual(check_in_response.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "ACKNOWLEDGED")
        assignment = ResponderAssignment.objects.get(
            alert=alert,
            responder=volunteer,
        )
        self.client.force_authenticate(user=admin)
        confirmation_response = self.confirm_arrival(assignment, admin)
        self.assertEqual(confirmation_response.status_code, 201)
        start_response = self.client.post(
            f"/alerts/api/sos/{alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )
        self.assertEqual(start_response.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "IN_PROGRESS")
        self.client.force_authenticate(user=volunteer)
        resolution_response = self.client.post(
            f"/alerts/api/sos/{alert.pk}/transition/",
            {"status": "RESOLVED"},
            format="json",
        )
        self.assertEqual(resolution_response.status_code, 200)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "RESOLVED")
        self.assertEqual(alert.resolved_by, volunteer)

        reauthenticated_client = APIClient()
        reauthenticated_client.force_authenticate(user=volunteer)
        refreshed_inbox = reauthenticated_client.get(self.notifications_url)
        self.assertIn(
            assignment_notification_id,
            {item["id"] for item in refreshed_inbox.data},
        )
        persisted_assignment = SOSNotification.objects.get(
            pk=assignment_notification_id
        )
        persisted_assignment.refresh_from_db()
        self.assertEqual(persisted_assignment.status, "PENDING")

    def test_django_admin_assignment_creates_volunteer_inbox_notification(self):
        admin = User.objects.create_superuser(
            username="admin_assignment_ui",
            email="admin-assignment-ui@example.test",
            password="AdminPassword123",
        )
        volunteer = User.objects.create_user(
            username="admin_assigned_volunteer",
            email="admin-assigned-volunteer@example.test",
            password="VolunteerPassword123",
        )
        UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876500043",
            is_verified=True,
        )
        self.client.force_login(admin)

        admin_response = self.client.post(
            reverse("admin:emergency_alerts_responderassignment_add"),
            {
                "alert": self.alert.pk,
                "responder": volunteer.pk,
                "notes": "",
                "_save": "Save",
            },
        )

        self.assertEqual(admin_response.status_code, 302)
        notification = SOSNotification.objects.get(
            alert=self.alert,
            recipient=volunteer,
            channel="IN_APP",
            notification_type="SOS_ASSIGNED",
        )
        self.client.force_authenticate(user=volunteer)
        inbox_response = self.client.get(self.notifications_url)
        self.assertEqual(inbox_response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in inbox_response.data],
            [notification.pk],
        )
        self.assertEqual(inbox_response.data[0]["alert_id"], self.alert.pk)
        self.assertEqual(inbox_response.data[0]["notification_type"], "SOS_ASSIGNED")

    def test_forged_responder_coordinates_cannot_start_response(self):
        responder = User.objects.create_user(
            username="distant_volunteer",
            password="test-password",
        )
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500013",
            is_verified=True,
        )
        self.alert.latitude = 12.9716
        self.alert.longitude = 77.5946
        self.alert.save(update_fields=["latitude", "longitude"])
        assignment = ResponderAssignment.objects.create(
            alert=self.alert,
            responder=responder,
        )
        security = self.acknowledge_alert()
        self.client.force_authenticate(user=responder)

        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/check-in/",
            {"latitude": 13.1, "longitude": 77.7},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        assignment.refresh_from_db()
        self.assertIsNotNone(assignment.acknowledged_at)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "ACKNOWLEDGED")
        self.assertTrue(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                event_type="RESPONDER_CHECK_IN_REPORTED",
            ).exists()
        )
        self.assertFalse(
            ResponderArrivalConfirmation.objects.filter(
                assignment=assignment,
            ).exists()
        )
        self.client.force_authenticate(user=security)
        transition_response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )
        self.assertEqual(transition_response.status_code, 400)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "ACKNOWLEDGED")

    def test_responder_can_report_arrival_without_gps_coordinates(self):
        responder = User.objects.create_user(
            username="no_gps_volunteer",
            password="test-password",
        )
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500014",
            is_verified=True,
        )
        ResponderAssignment.objects.create(
            alert=self.alert,
            responder=responder,
        )
        self.acknowledge_alert()
        self.client.force_authenticate(user=responder)

        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/check-in/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.data["checked_in_at"])
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "ACKNOWLEDGED")

    def test_existing_in_progress_status_without_confirmation_cannot_pass_replay_gate(self):
        responder = User.objects.create_user(username="legacy_arrival_responder")
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500080",
            is_verified=True,
        )
        assignment = ResponderAssignment.objects.create(
            alert=self.alert,
            responder=responder,
        )
        security = self.acknowledge_alert()
        self.assertEqual(self.report_arrival(assignment, responder).status_code, 200)

        self.alert.status = "IN_PROGRESS"
        self.alert.save(update_fields=["status", "updated_at"])
        self.client.force_authenticate(user=security)
        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            ResponderArrivalConfirmation.objects.filter(assignment=assignment).exists()
        )
        self.assertFalse(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                event_type="RESPONDER_ARRIVAL_CONFIRMED",
            ).exists()
        )

    def test_arrival_confirmation_enforces_roles_and_uses_authenticated_confirmer(self):
        responder = User.objects.create_user(username="confirm_role_responder")
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500081",
            is_verified=True,
        )
        assignment = ResponderAssignment.objects.create(
            alert=self.alert,
            responder=responder,
        )
        self.acknowledge_alert()
        self.assertEqual(self.report_arrival(assignment, responder).status_code, 200)

        other_volunteer = User.objects.create_user(username="other_confirm_volunteer")
        UserProfile.objects.create(
            user=other_volunteer,
            role="volunteer",
            phone_number="9876500082",
            is_verified=True,
        )
        UserProfile.objects.create(
            user=self.guardian,
            role="guardian",
            phone_number="9876500083",
            is_verified=True,
        )
        admin = User.objects.create_superuser(
            username="arrival_confirm_admin",
            email="arrival-confirm-admin@example.test",
            password="test-password",
        )
        endpoint = (
            f"/alerts/api/sos/{self.alert.pk}/assignments/"
            f"{assignment.pk}/confirm-arrival/"
        )
        for user in (responder, other_volunteer, self.resident, self.guardian):
            with self.subTest(role=user.username):
                self.client.force_authenticate(user=user)
                response = self.client.post(endpoint, {}, format="json")
                self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=None)
        anonymous_response = self.client.post(endpoint, {}, format="json")
        self.assertIn(anonymous_response.status_code, (401, 403))
        self.assertEqual(
            ResponderArrivalConfirmation.objects.filter(assignment=assignment).count(),
            0,
        )
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "ACKNOWLEDGED")
        self.assertFalse(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                event_type="RESPONDER_ARRIVAL_CONFIRMED",
            ).exists()
        )

        self.client.force_authenticate(user=admin)
        admin_response = self.client.post(
            endpoint,
            {
                "confirmed_by_id": responder.pk,
                "confirmed_by_role": "VOLUNTEER",
                "confirmation_note": "Arrival checked with dispatch.",
            },
            format="json",
        )
        self.assertEqual(admin_response.status_code, 201)
        confirmation = ResponderArrivalConfirmation.objects.get(assignment=assignment)
        self.assertEqual(confirmation.confirmed_by, admin)
        self.assertEqual(confirmation.confirmed_by_role, "ADMIN")
        self.assertIsNotNone(confirmation.confirmed_at)
        self.assertEqual(
            confirmation.confirmation_note,
            "Arrival checked with dispatch.",
        )
        self.assertEqual(admin_response.data["arrival_confirmation"]["responder_id"], responder.pk)
        self.client.force_authenticate(user=self.resident)
        status_response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/status/"
        )
        self.assertEqual(status_response.status_code, 200)
        self.assertEqual(
            status_response.data["arrival_reports"][0]["arrival_confirmation"][
                "confirmed_by_name"
            ],
            admin.get_full_name().strip() or admin.username,
        )

    def test_unassigned_responder_cannot_report_arrival(self):
        responder = User.objects.create_user(username="unassigned_arrival_responder")
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500084",
            is_verified=True,
        )
        self.acknowledge_alert()
        self.client.force_authenticate(user=responder)

        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/check-in/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                event_type="RESPONDER_CHECK_IN_REPORTED",
            ).count(),
            0,
        )

    def test_confirmation_is_idempotent_and_bound_to_the_exact_assignment(self):
        first_responder = User.objects.create_user(username="first_arrival_responder")
        second_responder = User.objects.create_user(username="second_arrival_responder")
        for responder, phone in (
            (first_responder, "9876500085"),
            (second_responder, "9876500086"),
        ):
            UserProfile.objects.create(
                user=responder,
                role="volunteer",
                phone_number=phone,
                is_verified=True,
            )
        first_assignment = ResponderAssignment.objects.create(
            alert=self.alert,
            responder=first_responder,
        )
        other_alert = SOSAlert.objects.create(
            reporter=self.guardian,
            category="FIRE",
        )
        second_assignment = ResponderAssignment.objects.create(
            alert=other_alert,
            responder=second_responder,
        )
        security = self.acknowledge_alert()
        self.assertEqual(self.report_arrival(first_assignment, first_responder).status_code, 200)
        self.client.force_authenticate(user=second_responder)
        self.assertEqual(
            self.client.post(
                f"/alerts/api/sos/{other_alert.pk}/check-in/",
                {},
                format="json",
            ).status_code,
            400,
        )

        self.client.force_authenticate(user=security)
        cross_alert_confirmation = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/assignments/"
            f"{second_assignment.pk}/confirm-arrival/",
            {},
            format="json",
        )
        self.assertEqual(cross_alert_confirmation.status_code, 404)

        first_confirmation = self.confirm_arrival(first_assignment, security)
        repeated_confirmation = self.confirm_arrival(first_assignment, security)
        self.assertEqual(first_confirmation.status_code, 201)
        self.assertEqual(repeated_confirmation.status_code, 200)
        self.assertEqual(
            first_confirmation.data["arrival_confirmation"]["id"],
            repeated_confirmation.data["arrival_confirmation"]["id"],
        )
        self.assertEqual(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                event_type="RESPONDER_ARRIVAL_CONFIRMED",
            ).count(),
            1,
        )

        transition_wrong_assignment = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": second_assignment.pk},
            format="json",
        )
        self.assertEqual(transition_wrong_assignment.status_code, 400)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "ACKNOWLEDGED")

        transition_confirmed_assignment = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": first_assignment.pk},
            format="json",
        )
        self.assertEqual(transition_confirmed_assignment.status_code, 200)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "IN_PROGRESS")

    def test_resolved_or_cancelled_alerts_reject_new_arrival_reports_and_confirmations(self):
        for index, terminal_status in enumerate(("RESOLVED", "CANCELLED"), start=1):
            with self.subTest(status=terminal_status):
                alert = SOSAlert.objects.create(
                    reporter=self.resident,
                    category="MEDICAL",
                    message=f"Terminal alert {index}",
                    status=terminal_status,
                )
                responder = User.objects.create_user(
                    username=f"terminal_responder_{index}",
                )
                UserProfile.objects.create(
                    user=responder,
                    role="volunteer",
                    phone_number=f"987650008{index + 6}",
                    is_verified=True,
                )
                assignment = ResponderAssignment.objects.create(
                    alert=alert,
                    responder=responder,
                )
                security = User.objects.create_user(
                    username=f"terminal_security_{index}",
                )
                UserProfile.objects.create(
                    user=security,
                    role="security",
                    phone_number=f"987650009{index}",
                    is_verified=True,
                )

                self.client.force_authenticate(user=responder)
                report_response = self.client.post(
                    f"/alerts/api/sos/{alert.pk}/check-in/",
                    {},
                    format="json",
                )
                self.client.force_authenticate(user=security)
                confirmation_response = self.confirm_arrival(assignment, security)

                self.assertEqual(report_response.status_code, 400)
                self.assertEqual(confirmation_response.status_code, 400)
                assignment.refresh_from_db()
                self.assertIsNone(assignment.acknowledged_at)
                self.assertFalse(
                    ResponderArrivalConfirmation.objects.filter(
                        assignment=assignment,
                    ).exists()
                )

    def test_dispatch_log_lists_only_persisted_in_app_notifications(self):
        security = User.objects.create_user(
            username="dispatch_security",
            password="test-password",
        )
        UserProfile.objects.create(
            user=security,
            role="security",
            phone_number="9876500015",
            is_verified=True,
        )
        self.client.force_authenticate(user=security)

        response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/notifications/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), self.alert.notifications.count())
        self.assertTrue(any(item["channel"] == "IN_APP" for item in response.data))
        self.assertTrue(all(item["created_at"] for item in response.data))

    def test_retry_endpoint_does_not_claim_unconfigured_delivery(self):
        admin = User.objects.create_superuser(
            username="retry_admin",
            email="retry-admin@example.com",
            password="test-password",
        )
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/notifications/retry/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 501)
        self.assertEqual(response.data["code"], "DELIVERY_NOT_CONFIGURED")

    def test_resident_can_create_sos_alert(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            "/alerts/api/sos/",
            {
                "category": "FIRE",
                "message": "Smoke in the kitchen",
                "latitude": 12.9716,
                "longitude": 77.5946,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["category"], "FIRE")
        self.assertEqual(response.data["status"], "PENDING")
        self.assertGreaterEqual(response.data["notifications_created"], 0)

    def test_sos_api_persists_six_decimal_gps_and_routes_in_app_recipients(self):
        security = User.objects.create_user(
            username="coordinate_test_security",
            password="TestPassword!123",
        )
        UserProfile.objects.create(
            user=security,
            role="security",
            phone_number="9876500321",
            is_verified=True,
        )
        staff = User.objects.create_user(
            username="coordinate_test_staff",
            email="coordinate-staff@example.test",
            password="TestPassword!123",
            is_staff=True,
        )
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            "/alerts/api/sos/",
            {
                "category": "MEDICAL",
                "message": "Coordinate precision test",
                "latitude": 12.971612,
                "longitude": 77.594613,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        alert = SOSAlert.objects.get(pk=response.data["id"])
        self.assertEqual(alert.reporter_id, self.resident.pk)
        self.assertEqual(alert.latitude, Decimal("12.971612"))
        self.assertEqual(alert.longitude, Decimal("77.594613"))

        in_app_notifications = SOSNotification.objects.filter(
            alert=alert,
            channel="IN_APP",
        )
        self.assertEqual(
            set(in_app_notifications.values_list("recipient_id", flat=True)),
            {security.pk, staff.pk},
        )

        self.client.force_authenticate(user=security)
        inbox_response = self.client.get("/alerts/api/notifications/")
        self.assertEqual(inbox_response.status_code, 200)
        self.assertIn(
            alert.pk,
            {item["alert_id"] for item in inbox_response.data},
        )
        board_response = self.client.get("/alerts/api/sos/list/")
        self.assertEqual(board_response.status_code, 200)
        self.assertIn(alert.pk, {item["id"] for item in board_response.data})

    def test_sos_api_rejects_out_of_range_and_unpaired_coordinates(self):
        self.client.force_authenticate(user=self.resident)
        invalid_coordinate_payloads = [
            {"category": "MEDICAL", "latitude": 90.000001, "longitude": 0},
            {"category": "MEDICAL", "latitude": -90.000001, "longitude": 0},
            {"category": "MEDICAL", "latitude": 0, "longitude": 180.000001},
            {"category": "MEDICAL", "latitude": 0, "longitude": -180.000001},
            {"category": "MEDICAL", "latitude": 12.9716},
            {"category": "MEDICAL", "longitude": 77.5946},
        ]

        for payload in invalid_coordinate_payloads:
            with self.subTest(payload=payload):
                response = self.client.post(
                    "/alerts/api/sos/",
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, 400, response.data)

        self.assertFalse(
            SOSAlert.objects.filter(
                reporter=self.resident,
                message="",
            ).exists()
        )

    def test_sos_api_accepts_inclusive_coordinate_range_boundaries(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            "/alerts/api/sos/",
            {
                "category": "OTHER",
                "latitude": -90,
                "longitude": 180,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        alert = SOSAlert.objects.get(pk=response.data["id"])
        self.assertEqual(alert.latitude, Decimal("-90.000000"))
        self.assertEqual(alert.longitude, Decimal("180.000000"))

    def test_new_sos_notifies_active_staff_accounts(self):
        admin = User.objects.create_superuser(
            username="sos_board_admin",
            email="sos-admin@example.com",
            password="test-password",
        )
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            "/alerts/api/sos/",
            {"category": "FIRE", "message": "Smoke in the kitchen"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(
            SOSNotification.objects.filter(
                alert_id=response.data["id"],
                recipient=admin,
                channel="IN_APP",
            ).exists()
        )

    def test_sos_notifications_route_in_app_and_mark_external_channels_simulated(self):
        linked_guardian = User.objects.create_user(
            username="notification_guardian",
            email="notification.guardian@example.com",
            password="test-password",
        )
        UserProfile.objects.create(
            user=linked_guardian,
            role="guardian",
            phone_number="9876500003",
        )
        for guardian_type in ("PRIMARY", "SECONDARY"):
            GuardianContact.objects.create(
                resident=self.resident,
                name="Notification Guardian",
                relationship="Family",
                phone_number="9876500003",
                email=linked_guardian.email,
                guardian_type=guardian_type,
                is_verified=True,
            )

        security = User.objects.create_user(
            username="verified_security",
            password="test-password",
            is_staff=True,
        )
        UserProfile.objects.create(
            user=security,
            role="security",
            phone_number="9876500004",
            is_verified=True,
        )
        volunteer = User.objects.create_user(
            username="verified_volunteer",
            password="test-password",
        )
        UserProfile.objects.create(
            user=volunteer,
            role="volunteer",
            phone_number="9876500005",
            is_verified=True,
        )
        unverified_security = User.objects.create_user(
            username="unverified_security",
            password="test-password",
        )
        UserProfile.objects.create(
            user=unverified_security,
            role="security",
            phone_number="9876500006",
            is_verified=False,
        )
        admin = User.objects.create_superuser(
            username="notification_admin",
            email="notification-admin@example.com",
            password="test-password",
        )
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            "/alerts/api/sos/",
            {"category": "MEDICAL", "message": "Needs assistance"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        notifications = SOSNotification.objects.filter(
            alert_id=response.data["id"],
            channel="IN_APP",
        )
        recipient_ids = set(notifications.values_list("recipient_id", flat=True))
        self.assertEqual(
            recipient_ids,
            {linked_guardian.pk, security.pk, admin.pk},
        )
        self.assertNotIn(volunteer.pk, recipient_ids)
        self.assertEqual(notifications.count(), 3)
        self.assertEqual(
            set(notifications.values_list("channel", flat=True)),
            {"IN_APP"},
        )
        simulations = SOSNotification.objects.filter(
            alert_id=response.data["id"],
            channel__in=["EMAIL", "SMS"],
        )
        self.assertTrue(simulations.exists())
        self.assertEqual(
            set(simulations.values_list("status", flat=True)),
            {"SIMULATED"},
        )

    def test_sos_list_requires_authentication(self):
        response = self.client.get(self.sos_list_url)

        self.assertIn(response.status_code, (401, 403))

    def test_resident_cannot_read_another_users_sos_status(self):
        self.client.force_authenticate(user=self.guardian)

        response = self.client.get(
            f"/alerts/api/sos/{self.alert.pk}/status/"
        )

        self.assertEqual(response.status_code, 404)

    def test_sos_creation_is_idempotent_for_the_reporting_user(self):
        self.client.force_authenticate(user=self.resident)
        key = uuid4()
        payload = {
            "category": "FIRE",
            "message": "Smoke in the kitchen",
        }

        first_response = self.client.post(
            "/alerts/api/sos/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key),
        )
        retry_response = self.client.post(
            "/alerts/api/sos/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key),
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(retry_response.status_code, 200)
        self.assertEqual(retry_response.data["id"], first_response.data["id"])
        self.assertEqual(
            SOSAlert.objects.filter(
                reporter=self.resident,
                idempotency_key=key,
            ).count(),
            1,
        )
        self.assertEqual(
            SOSAlertEvent.objects.filter(
                alert_id=first_response.data["id"],
                event_type="CREATED",
            ).count(),
            1,
        )

        another_resident = User.objects.create_user(
            username="another_idempotent_resident",
            password="TestPassword!123",
        )
        self.client.force_authenticate(user=another_resident)
        independent_response = self.client.post(
            "/alerts/api/sos/",
            payload,
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(key),
        )
        self.assertEqual(independent_response.status_code, 201)
        self.assertNotEqual(independent_response.data["id"], first_response.data["id"])

    def test_resident_cannot_transition_an_sos_alert(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "ACKNOWLEDGED"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "PENDING")

    def test_security_must_follow_alert_status_transitions_and_is_recorded(self):
        security = self.acknowledge_alert()
        responder = User.objects.create_user(username="transition_responder")
        UserProfile.objects.create(
            user=responder,
            role="volunteer",
            phone_number="9876500043",
            is_verified=True,
        )
        assignment = ResponderAssignment.objects.create(
            alert=self.alert,
            responder=responder,
        )
        self.client.force_authenticate(user=security)

        resolved_too_early = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "RESOLVED"},
            format="json",
        )
        start_before_report = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS"},
            format="json",
        )
        self.client.force_authenticate(user=responder)
        check_in = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/check-in/",
            {},
            format="json",
        )
        self.client.force_authenticate(user=responder)
        volunteer_transition = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )
        self.client.force_authenticate(user=self.resident)
        resident_acknowledgment = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/resident-acknowledge/",
            {},
            format="json",
        )
        self.client.force_authenticate(user=security)
        start_after_resident_acknowledgment = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )
        confirmation = self.confirm_arrival(assignment, security)
        started = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "IN_PROGRESS", "assignment_id": assignment.pk},
            format="json",
        )
        resolved = self.client.post(
            f"/alerts/api/sos/{self.alert.pk}/transition/",
            {"status": "RESOLVED"},
            format="json",
        )

        self.assertEqual(resolved_too_early.status_code, 400)
        self.assertEqual(start_before_report.status_code, 400)
        self.assertEqual(check_in.status_code, 200)
        self.assertEqual(volunteer_transition.status_code, 403)
        self.assertEqual(resident_acknowledgment.status_code, 200)
        self.assertEqual(start_after_resident_acknowledgment.status_code, 400)
        self.assertEqual(confirmation.status_code, 201)
        assignment.refresh_from_db()
        self.assertIsNotNone(assignment.acknowledged_at)
        self.assertEqual(started.status_code, 200)
        self.assertEqual(resolved.status_code, 200)
        self.alert.refresh_from_db()
        self.assertEqual(self.alert.status, "RESOLVED")
        self.assertEqual(self.alert.acknowledged_by, security)
        self.assertEqual(self.alert.resolved_by, security)
        self.assertIsNotNone(self.alert.acknowledged_at)
        self.assertIsNotNone(self.alert.resolved_at)
        self.assertEqual(
            list(
                self.alert.events.filter(
                    event_type__in=["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"]
                ).values_list("event_type", flat=True)
            ),
            ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"],
        )


@skipUnlessDBFeature("has_select_for_update")
class ResponderArrivalConfirmationConcurrencyTests(TransactionTestCase):
    def setUp(self):
        suffix = uuid4().hex[:8]
        self.reporter = User.objects.create_user(
            username=f"arrival_reporter_{suffix}",
        )
        self.responder = User.objects.create_user(
            username=f"arrival_responder_{suffix}",
        )
        UserProfile.objects.create(
            user=self.responder,
            role="volunteer",
            phone_number=f"77{suffix}",
            is_verified=True,
        )
        self.security = User.objects.create_user(
            username=f"arrival_security_{suffix}",
        )
        UserProfile.objects.create(
            user=self.security,
            role="security",
            phone_number=f"88{suffix}",
            is_verified=True,
        )
        self.alert = SOSAlert.objects.create(
            reporter=self.reporter,
            category="MEDICAL",
            status="ACKNOWLEDGED",
        )
        self.assignment = ResponderAssignment.objects.create(
            alert=self.alert,
            responder=self.responder,
            acknowledged_at=timezone.now(),
        )

    def test_simultaneous_confirmation_requests_create_one_confirmation_and_event(self):
        barrier = Barrier(2)
        endpoint = (
            f"/alerts/api/sos/{self.alert.pk}/assignments/"
            f"{self.assignment.pk}/confirm-arrival/"
        )

        def confirm():
            close_old_connections()
            client = APIClient()
            client.force_authenticate(user=self.security)
            barrier.wait(timeout=10)
            response = client.post(endpoint, {}, format="json")
            close_old_connections()
            return response.status_code, response.data

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: confirm(), range(2)))

        self.assertEqual(sorted(status_code for status_code, _ in results), [200, 201])
        self.assertEqual(
            ResponderArrivalConfirmation.objects.filter(
                assignment=self.assignment,
            ).count(),
            1,
        )
        self.assertEqual(
            SOSAlertEvent.objects.filter(
                alert=self.alert,
                event_type="RESPONDER_ARRIVAL_CONFIRMED",
            ).count(),
            1,
        )
        self.assertEqual(
            len(
                {
                    result["arrival_confirmation"]["id"]
                    for _, result in results
                }
            ),
            1,
        )
