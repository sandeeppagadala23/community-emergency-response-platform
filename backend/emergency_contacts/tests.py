
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.test import TestCase
from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.utils import timezone

from rest_framework.test import APITestCase
from rest_framework import status

from society.models import Society
from .models import ContactVerificationOTP, EmergencyContact, GuardianContact


class EmergencyContactModelTests(TestCase):

    def setUp(self):
        self.society = Society.objects.create(
            name="Green Residency",
            address="Main Road",
            city="Vijayawada",
            pincode="520010"
        )

        self.contact = EmergencyContact.objects.create(
            society=self.society,
            name="City Police",
            service_type="POLICE",
            phone_number="100"
        )

    def test_emergency_contact_creation(self):
        self.assertEqual(self.contact.name, "City Police")
        self.assertEqual(self.contact.service_type, "POLICE")
        self.assertTrue(self.contact.is_active)

    def test_emergency_contact_string_representation(self):
        self.assertEqual(
            str(self.contact), "City Police - POLICE"
        )

    def test_emergency_contact_belongs_to_society(self):
        self.assertEqual(self.contact.society, self.society)
        self.assertIn(
            self.contact,
            self.society.emergency_contacts.all()
        )

    def test_emergency_contact_can_be_deactivated(self):
        self.contact.is_active = False
        self.contact.save()

        self.contact.refresh_from_db()
        self.assertFalse(self.contact.is_active)

    def test_optional_email_and_address_can_be_blank(self):
        self.assertEqual(self.contact.email, "")
        self.assertEqual(self.contact.address, "")

    def test_deleting_society_deletes_emergency_contacts(self):
        contact_id = self.contact.id

        self.society.delete()

        self.assertFalse(
            EmergencyContact.objects.filter(id=contact_id).exists()
        )


class GuardianContactModelTests(TestCase):

    def setUp(self):
        self.resident = User.objects.create_user(
            username="resident1",
            password="TestPassword123"
        )

    def test_primary_guardian_creation(self):
        guardian = GuardianContact.objects.create(
            resident=self.resident,
            name="Ravi Kumar",
            relationship="Father",
            phone_number="9876501234",
            guardian_type="PRIMARY"
        )

        self.assertEqual(guardian.resident, self.resident)
        self.assertEqual(guardian.guardian_type, "PRIMARY")
        self.assertFalse(guardian.is_verified)

    def test_guardian_string_representation(self):
        guardian = GuardianContact.objects.create(
            resident=self.resident,
            name="Ravi Kumar",
            relationship="Father",
            phone_number="9876501234",
            guardian_type="PRIMARY"
        )

        self.assertEqual(
            str(guardian),
            "Ravi Kumar - Primary Guardian for resident1"
        )

    def test_resident_can_have_primary_and_secondary_guardians(self):
        GuardianContact.objects.create(
            resident=self.resident,
            name="Ravi Kumar",
            relationship="Father",
            phone_number="9876501234",
            guardian_type="PRIMARY"
        )

        GuardianContact.objects.create(
            resident=self.resident,
            name="Sita Devi",
            relationship="Mother",
            phone_number="9876501235",
            guardian_type="SECONDARY"
        )

        self.assertEqual(
            self.resident.guardian_contacts.count(), 2
        )

    def test_duplicate_guardian_type_is_rejected(self):
        GuardianContact.objects.create(
            resident=self.resident,
            name="Ravi Kumar",
            relationship="Father",
            phone_number="9876501234",
            guardian_type="PRIMARY"
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                GuardianContact.objects.create(
                    resident=self.resident,
                    name="Another Guardian",
                    relationship="Uncle",
                    phone_number="9876501236",
                    guardian_type="PRIMARY"
                )

    def test_guardian_can_be_verified(self):
        guardian = GuardianContact.objects.create(
            resident=self.resident,
            name="Ravi Kumar",
            relationship="Father",
            phone_number="9876501234",
            guardian_type="PRIMARY"
        )

        guardian.is_verified = True
        guardian.save()
        guardian.refresh_from_db()

        self.assertTrue(guardian.is_verified)

    def test_deleting_resident_deletes_guardian_contacts(self):
        guardian = GuardianContact.objects.create(
            resident=self.resident,
            name="Ravi Kumar",
            relationship="Father",
            phone_number="9876501234",
            guardian_type="PRIMARY"
        )

        guardian_id = guardian.id
        self.resident.delete()

        self.assertFalse(
            GuardianContact.objects.filter(id=guardian_id).exists()
        )


class GuardianContactAPISecurityTests(APITestCase):

    def setUp(self):
        self.resident_a = User.objects.create_user(
            username="resident_a",
            password="TestPassword123"
        )

        self.resident_b = User.objects.create_user(
            username="resident_b",
            password="TestPassword123"
        )

        self.staff = User.objects.create_user(
            username="staff_user",
            password="TestPassword123",
            is_staff=True
        )

        self.guardian_a = GuardianContact.objects.create(
            resident=self.resident_a,
            name="Guardian A",
            relationship="Father",
            phone_number="9876501111",
            guardian_type="PRIMARY"
        )

        self.guardian_b = GuardianContact.objects.create(
            resident=self.resident_b,
            name="Guardian B",
            relationship="Mother",
            phone_number="9876502222",
            guardian_type="PRIMARY"
        )

        self.url = "/api/guardian-contacts/"

    def test_resident_sees_only_own_contacts(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = [item["id"] for item in response.data]

        self.assertIn(self.guardian_a.id, ids)
        self.assertNotIn(self.guardian_b.id, ids)

    def test_resident_cannot_view_another_residents_contact(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.get(
            f"{self.url}{self.guardian_b.id}/"
        )

        self.assertEqual(
            response.status_code, status.HTTP_404_NOT_FOUND
        )

    def test_resident_cannot_update_another_residents_contact(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.patch(
            f"{self.url}{self.guardian_b.id}/",
            {"name": "Changed Name"},
            format="json"
        )

        self.assertEqual(
            response.status_code, status.HTTP_404_NOT_FOUND
        )

        self.guardian_b.refresh_from_db()
        self.assertEqual(self.guardian_b.name, "Guardian B")

    def test_resident_cannot_delete_another_residents_contact(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.delete(
            f"{self.url}{self.guardian_b.id}/"
        )

        self.assertEqual(
            response.status_code, status.HTTP_404_NOT_FOUND
        )

        self.assertTrue(
            GuardianContact.objects.filter(
                id=self.guardian_b.id
            ).exists()
        )

    def test_resident_cannot_create_contact_for_another_resident(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.post(
            self.url,
            {
                "resident": self.resident_b.id,
                "name": "New Guardian",
                "relationship": "Uncle",
                "phone_number": "9876503333",
                "guardian_type": "SECONDARY"
            },
            format="json"
        )

        self.assertEqual(
            response.status_code, status.HTTP_201_CREATED
        )

        created = GuardianContact.objects.get(
            id=response.data["id"]
        )

        self.assertEqual(created.resident, self.resident_a)

    def test_unauthenticated_user_cannot_list_contacts(self):
        response = self.client.get(self.url)

        self.assertIn(
            response.status_code,
            [
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN
            ]
        )

    def test_staff_can_list_all_contacts(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = [item["id"] for item in response.data]

        self.assertIn(self.guardian_a.id, ids)
        self.assertIn(self.guardian_b.id, ids)

    def test_staff_can_verify_guardian(self):
        self.client.force_authenticate(user=self.staff)

        response = self.client.post(
            f"{self.url}{self.guardian_a.id}/verify/"
        )

        self.assertEqual(
            response.status_code, status.HTTP_200_OK
        )

        self.guardian_a.refresh_from_db()
        self.assertTrue(self.guardian_a.is_verified)

    def test_resident_cannot_verify_guardian(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.post(
            f"{self.url}{self.guardian_a.id}/verify/"
        )

        self.assertEqual(
            response.status_code, status.HTTP_403_FORBIDDEN
        )

        self.guardian_a.refresh_from_db()
        self.assertFalse(self.guardian_a.is_verified)

    @patch("emergency_contacts.views.secrets.randbelow", return_value=12345)
    def test_owner_can_request_and_verify_a_hashed_simulated_otp(self, _randbelow):
        self.client.force_authenticate(user=self.resident_a)

        send_response = self.client.post(
            f"{self.url}{self.guardian_a.id}/send-otp/"
        )

        self.assertEqual(send_response.status_code, status.HTTP_200_OK)
        self.assertTrue(send_response.data["simulated"])
        self.assertEqual(send_response.data["channel"], "SMS")
        otp = ContactVerificationOTP.objects.get(contact=self.guardian_a)
        self.assertNotEqual(otp.code_hash, "012345")
        self.assertTrue(check_password("012345", otp.code_hash))

        verify_response = self.client.post(
            f"{self.url}{self.guardian_a.id}/verify-otp/",
            {"code": "012345"},
            format="json",
        )

        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.guardian_a.refresh_from_db()
        otp.refresh_from_db()
        self.assertTrue(self.guardian_a.is_verified)
        self.assertTrue(otp.is_used)

    def test_failed_otp_attempts_are_saved_and_limited(self):
        now = timezone.now()
        otp = ContactVerificationOTP.objects.create(
            contact=self.guardian_a,
            code_hash=make_password("123456"),
            expires_at=now + timedelta(minutes=10),
            attempts=4,
        )
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.post(
            f"{self.url}{self.guardian_a.id}/verify-otp/",
            {"code": "000000"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        otp.refresh_from_db()
        self.assertEqual(otp.attempts, 5)
        self.assertTrue(otp.is_used)

    def test_expired_otp_is_rejected_and_invalidated(self):
        otp = ContactVerificationOTP.objects.create(
            contact=self.guardian_a,
            code_hash=make_password("123456"),
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.post(
            f"{self.url}{self.guardian_a.id}/verify-otp/",
            {"code": "123456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        otp.refresh_from_db()
        self.assertTrue(otp.is_used)
        self.guardian_a.refresh_from_db()
        self.assertFalse(self.guardian_a.is_verified)

    def test_changing_contact_details_resets_verification_and_invalidates_otp(self):
        self.guardian_a.is_verified = True
        self.guardian_a.save(update_fields=["is_verified"])
        otp = ContactVerificationOTP.objects.create(
            contact=self.guardian_a,
            code_hash=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.patch(
            f"{self.url}{self.guardian_a.id}/",
            {"phone_number": "9876509999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.guardian_a.refresh_from_db()
        otp.refresh_from_db()
        self.assertFalse(self.guardian_a.is_verified)
        self.assertTrue(otp.is_used)

    def test_contact_owner_cannot_request_otp_for_another_resident(self):
        self.client.force_authenticate(user=self.resident_a)

        response = self.client.post(
            f"{self.url}{self.guardian_b.id}/send-otp/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(ContactVerificationOTP.objects.exists())
