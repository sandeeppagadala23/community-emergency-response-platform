from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from emergency_alerts.models import SOSAlert, SOSNotification
from emergency_contacts.models import GuardianContact
from users.models import UserProfile


PASSWORD = "TestPassword123!"


def make_user(username, role, email="", phone=None, verified=False):
    user = User.objects.create_user(
        username=username,
        email=email,
        password=PASSWORD,
    )
    UserProfile.objects.create(
        user=user,
        role=role,
        phone_number=phone or ("9" + str(user.id).zfill(9)),
        is_verified=verified,
    )
    return user


class GuardianDashboardTests(TestCase):

    def setUp(self):
        self.guardian = make_user(
            "guardian_one", "guardian",
            email="guardian.one@example.com", verified=True,
        )
        self.other_guardian = make_user(
            "guardian_two", "guardian",
            email="guardian.two@example.com", verified=True,
        )
        self.resident = make_user(
            "resident_linked", "resident",
            email="resident.linked@example.com", phone="9111111111",
        )
        self.unrelated_resident = make_user(
            "resident_unrelated", "resident",
            email="resident.unrelated@example.com", phone="9222222222",
        )

        # Verified link: guardian_one is a verified guardian of resident.
        self.link = GuardianContact.objects.create(
            resident=self.resident,
            name="Guardian One",
            relationship="Father",
            phone_number="9333333333",
            email="guardian.one@example.com",
            guardian_type="PRIMARY",
            is_verified=True,
        )

        # Unverified link to the unrelated resident: must not be shown.
        GuardianContact.objects.create(
            resident=self.unrelated_resident,
            name="Guardian One",
            relationship="Uncle",
            phone_number="9444444444",
            email="guardian.one@example.com",
            guardian_type="PRIMARY",
            is_verified=False,
        )

        self.open_alert = SOSAlert.objects.create(
            reporter=self.resident,
            category="MEDICAL",
            message="Linked resident needs help",
            location_text="Block A, Flat 12",
            status="PENDING",
        )
        self.closed_alert = SOSAlert.objects.create(
            reporter=self.resident,
            category="FIRE",
            message="Old resolved alert",
            location_text="Block A, Flat 12",
            status="RESOLVED",
        )
        self.unrelated_alert = SOSAlert.objects.create(
            reporter=self.unrelated_resident,
            category="SECURITY",
            message="Someone else's emergency",
            location_text="Block C, Flat 99",
            status="PENDING",
        )

        self.notification = SOSNotification.objects.create(
            alert=self.open_alert,
            recipient=self.guardian,
            channel="IN_APP",
            status="PENDING",
            message="New Medical SOS alert requires attention.",
        )
        self.other_notification = SOSNotification.objects.create(
            alert=self.open_alert,
            recipient=self.other_guardian,
            channel="IN_APP",
            status="PENDING",
            message="Notification for another guardian.",
        )

        self.url = reverse("guardian_dashboard")

    # Routing by role

    def test_guardian_dashboard_requires_login(self):
        response = self.client.get(self.url)
        self.assertRedirects(
            response,
            f"{reverse('login')}?next={self.url}",
        )

    def test_guardian_is_redirected_from_general_dashboard(self):
        self.client.force_login(self.guardian)
        response = self.client.get(reverse("dashboard"))
        self.assertRedirects(response, self.url)

    def test_resident_stays_on_resident_dashboard(self):
        self.client.force_login(self.resident)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "users/dashboard.html")
        self.assertTemplateNotUsed(response, "users/guardian_dashboard.html")

    def test_resident_is_redirected_away_from_guardian_dashboard(self):
        self.client.force_login(self.resident)
        response = self.client.get(self.url)
        self.assertRedirects(response, reverse("dashboard"))

    def test_guardian_login_redirects_through_to_guardian_dashboard(self):
        response = self.client.post(
            reverse("login"),
            {"username": "guardian_one", "password": PASSWORD},
            follow=True,
        )
        self.assertRedirects(response, self.url)
        self.assertTemplateUsed(response, "users/guardian_dashboard.html")

    # Profile and linked residents

    def test_guardian_sees_own_profile(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "guardian_one")
        self.assertContains(response, "guardian.one@example.com")
        self.assertContains(response, "Verified")

    def test_guardian_sees_only_verified_linked_residents(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertEqual(
            list(response.context["linked_links"]), [self.link]
        )
        self.assertContains(response, "resident_linked")
        self.assertNotContains(response, "resident_unrelated")

    def test_guardian_does_not_see_resident_contact_details(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertNotContains(response, "9111111111")
        self.assertNotContains(response, "resident.linked@example.com")
        self.assertNotContains(response, "9222222222")

    def test_guardian_with_no_links_sees_empty_state(self):
        self.client.force_login(self.other_guardian)
        response = self.client.get(self.url)
        self.assertContains(
            response,
            "No verified residents are linked to your account yet.",
        )

    def test_guardian_without_email_has_no_links(self):
        no_email = make_user("guardian_no_email", "guardian", email="")
        self.client.force_login(no_email)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["linked_links"]), 0)

    # Active SOS alerts

    def test_guardian_sees_active_alert_from_linked_resident(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        alerts = list(response.context["active_alerts"])
        self.assertEqual(alerts, [self.open_alert])
        self.assertContains(response, "Block A, Flat 12")
        self.assertContains(response, "Medical alert")

    def test_guardian_does_not_see_closed_alerts(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertNotIn(
            self.closed_alert, list(response.context["active_alerts"])
        )

    def test_guardian_does_not_see_unrelated_resident_alerts(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertNotIn(
            self.unrelated_alert, list(response.context["active_alerts"])
        )
        self.assertNotContains(response, "Block C, Flat 99")
        self.assertNotContains(response, "Someone else")

    def test_alert_empty_state_when_no_active_alerts(self):
        self.open_alert.status = "RESOLVED"
        self.open_alert.save()
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertContains(
            response,
            "No active SOS alerts from your linked residents.",
        )

    # Notifications

    def test_guardian_sees_only_own_notifications(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertEqual(
            list(response.context["notifications"]),
            [self.notification],
        )
        self.assertContains(
            response, "New Medical SOS alert requires attention."
        )
        self.assertNotContains(
            response, "Notification for another guardian."
        )

    def test_unread_count_is_real_database_count(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertEqual(response.context["unread_count"], 1)

    def test_notifications_empty_state(self):
        self.notification.delete()
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertContains(response, "You have no notifications yet.")

    def test_read_notification_has_no_mark_read_button(self):
        self.notification.status = "READ"
        self.notification.save()
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertNotContains(response, 'class="mark-read-button"')

    # Mark as read through the existing API with CSRF protection

    def test_mark_as_read_button_points_at_existing_endpoint(self):
        self.client.force_login(self.guardian)
        response = self.client.get(self.url)
        self.assertContains(
            response,
            f"/alerts/api/notifications/{self.notification.id}/read/",
        )

    def test_mark_as_read_works_with_csrf_token(self):
        csrf_client = self.client_class(enforce_csrf_checks=True)
        csrf_client.force_login(self.guardian)

        page = csrf_client.get(self.url)
        token = csrf_client.cookies["csrftoken"].value
        self.assertEqual(page.status_code, 200)

        response = csrf_client.patch(
            f"/alerts/api/notifications/{self.notification.id}/read/",
            data="{}",
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, 200)
        self.notification.refresh_from_db()
        self.assertEqual(self.notification.status, "READ")
        self.assertIsNotNone(self.notification.read_at)

    def test_mark_as_read_rejected_without_csrf_token(self):
        csrf_client = self.client_class(enforce_csrf_checks=True)
        csrf_client.force_login(self.guardian)

        response = csrf_client.patch(
            f"/alerts/api/notifications/{self.notification.id}/read/",
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.notification.refresh_from_db()
        self.assertEqual(self.notification.status, "PENDING")

    def test_guardian_cannot_mark_another_guardians_notification(self):
        self.client.force_login(self.guardian)
        response = self.client.patch(
            f"/alerts/api/notifications/{self.other_notification.id}/read/",
            data="{}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)
        self.other_notification.refresh_from_db()
        self.assertEqual(self.other_notification.status, "PENDING")

    # Guardians must not perform responder actions

    def test_guardian_cannot_acknowledge_linked_alert(self):
        self.client.force_login(self.guardian)
        response = self.client.post(
            f"/alerts/api/sos/{self.open_alert.id}/acknowledge/"
        )
        self.assertEqual(response.status_code, 403)
        self.open_alert.refresh_from_db()
        self.assertEqual(self.open_alert.status, "PENDING")

    def test_guardian_cannot_resolve_linked_alert(self):
        self.client.force_login(self.guardian)
        response = self.client.post(
            f"/alerts/api/sos/{self.open_alert.id}/resolve/"
        )
        self.assertEqual(response.status_code, 403)
        self.open_alert.refresh_from_db()
        self.assertEqual(self.open_alert.status, "PENDING")

    def test_guardian_cannot_view_unrelated_alert_detail(self):
        self.client.force_login(self.guardian)
        response = self.client.get(
            f"/alerts/api/sos/{self.unrelated_alert.id}/"
        )
        self.assertEqual(response.status_code, 404)

    def test_guardian_cannot_change_report_status(self):
        from emergency_reports.models import EmergencyReport

        report = EmergencyReport.objects.create(
            reporter=self.resident,
            incident_type="FIRE",
            location="Block A",
            description="Smoke seen",
        )
        self.client.force_login(self.guardian)
        response = self.client.patch(
            f"/reports/api/reports/{report.id}/status/",
            {"status": "RESOLVED"},
            content_type="application/json",
        )
        # Guardians can view linked reports, but cannot change their status (403 Forbidden)
        self.assertIn(response.status_code, [403, 404])
        report.refresh_from_db()
        self.assertEqual(report.status, "PENDING")

    def test_sos_creation_dispatches_in_app_notification_to_verified_guardian(self):
        from emergency_alerts.notification_service import notify_sos_recipients
        from users.guardian import get_active_alerts_for_guardian, get_guardian_notifications

        new_alert = SOSAlert.objects.create(
            reporter=self.resident,
            category="MEDICAL",
            message="Heart palpitations",
            location_text="B-304, Green Meadows",
            status="PENDING",
        )
        count = notify_sos_recipients(new_alert)
        self.assertGreaterEqual(count, 1)

        # In-app notification for guardian
        guardian_notifs = [
            n for n in get_guardian_notifications(self.guardian) if n.alert_id == new_alert.id
        ]
        self.assertEqual(len(guardian_notifs), 1)
        notif = guardian_notifs[0]
        self.assertEqual(notif.channel, "IN_APP")
        self.assertEqual(notif.status, "PENDING")
        self.assertIn("EMERGENCY", notif.message)
        self.assertIn(self.resident.username, notif.message)

        # Unrelated guardian receives nothing
        other_notifs = [
            n for n in get_guardian_notifications(self.other_guardian) if n.alert_id == new_alert.id
        ]
        self.assertEqual(len(other_notifs), 0)

        # Alert is active for linked guardian, not for unrelated guardian
        active_for_guardian = get_active_alerts_for_guardian(self.guardian)
        self.assertIn(new_alert, active_for_guardian)
        active_for_other = get_active_alerts_for_guardian(self.other_guardian)
        self.assertNotIn(new_alert, active_for_other)

    def test_idempotent_notification_dispatch_does_not_duplicate(self):
        from emergency_alerts.notification_service import notify_sos_recipients

        repeat_alert = SOSAlert.objects.create(
            reporter=self.resident,
            category="FIRE",
            message="Kitchen fire",
            location_text="B-304",
            status="PENDING",
        )
        notify_sos_recipients(repeat_alert)
        first_count = SOSNotification.objects.filter(
            alert=repeat_alert, recipient=self.guardian, channel="IN_APP"
        ).count()
        self.assertEqual(first_count, 1)

        # Second dispatch must be idempotent and not create duplicates
        notify_sos_recipients(repeat_alert)
        second_count = SOSNotification.objects.filter(
            alert=repeat_alert, recipient=self.guardian, channel="IN_APP"
        ).count()
        self.assertEqual(second_count, 1)

    def test_whitespace_and_case_insensitive_guardian_linking(self):
        from users.guardian import get_verified_guardian_links

        messy_guardian = make_user(
            "messy_guardian", "guardian", email="  MESSY.Guardian@Example.COM  ", verified=True
        )
        GuardianContact.objects.create(
            resident=self.resident,
            name="Messy Link",
            relationship="Sister",
            phone_number="9555555555",
            email="messy.guardian@example.com",
            guardian_type="SECONDARY",
            is_verified=True,
        )
        links = get_verified_guardian_links(messy_guardian)
        self.assertEqual(links.count(), 1)
        self.assertEqual(links.first().resident, self.resident)
