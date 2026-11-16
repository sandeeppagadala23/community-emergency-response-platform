
from django.test import TestCase
from django.contrib.auth.models import User

from rest_framework.test import APITestCase
from rest_framework import status

from .models import Society, Block, Flat


# ------------------------------------------
# Society, Block and Flat Model Tests
# ------------------------------------------

class SocietyModelTests(TestCase):

    def setUp(self):
        self.society = Society.objects.create(
            name="Green Residency",
            address="Main Road",
            city="Vijayawada",
            pincode="520010"
        )

        self.block = Block.objects.create(
            society=self.society,
            name="Block A"
        )

        self.flat = Flat.objects.create(
            block=self.block,
            flat_number="101",
            floor_number=1
        )

    def test_society_creation(self):
        self.assertEqual(self.society.name, "Green Residency")
        self.assertEqual(str(self.society), "Green Residency")

    def test_block_belongs_to_society(self):
        self.assertEqual(self.block.society, self.society)
        self.assertEqual(
            str(self.block),
            "Green Residency - Block A"
        )

    def test_flat_belongs_to_block(self):
        self.assertEqual(self.flat.block, self.block)
        self.assertEqual(
            str(self.flat),
            "Block A - Flat 101"
        )

    def test_flat_can_have_residents(self):
        resident = User.objects.create_user(
            username="flatresident",
            password="TestPassword123"
        )

        self.flat.residents.add(resident)

        self.assertIn(resident, self.flat.residents.all())
        self.assertIn(self.flat, resident.flats.all())

    def test_flat_can_have_multiple_residents(self):
        resident1 = User.objects.create_user(
            username="resident1",
            password="TestPassword123"
        )
        resident2 = User.objects.create_user(
            username="resident2",
            password="TestPassword123"
        )

        self.flat.residents.add(resident1, resident2)

        self.assertEqual(self.flat.residents.count(), 2)

    def test_deleting_society_deletes_its_blocks_and_flats(self):
        society_id = self.society.id
        block_id = self.block.id
        flat_id = self.flat.id

        self.society.delete()

        self.assertFalse(
            Society.objects.filter(id=society_id).exists()
        )
        self.assertFalse(
            Block.objects.filter(id=block_id).exists()
        )
        self.assertFalse(
            Flat.objects.filter(id=flat_id).exists()
        )


# ------------------------------------------
# Society API Permission Tests
# ------------------------------------------

class SocietyAPIPermissionTests(APITestCase):

    def setUp(self):
        self.resident = User.objects.create_user(
            username="api_resident",
            password="TestPass123!"
        )

        self.admin = User.objects.create_user(
            username="api_admin",
            password="TestPass123!",
            is_staff=True
        )

        self.society = Society.objects.create(
            name="Test Residency",
            address="Main Road",
            city="Vijayawada",
            pincode="520010"
        )

        self.url = "/api/societies/"

    def test_resident_can_view_societies(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

    def test_resident_cannot_create_society(self):
        self.client.force_authenticate(user=self.resident)

        response = self.client.post(
            self.url,
            {
                "name": "Unauthorized Society",
                "address": "Test Address",
                "city": "Vijayawada",
                "pincode": "520011"
            },
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN
        )

        self.assertFalse(
            Society.objects.filter(
                name="Unauthorized Society"
            ).exists()
        )

    def test_staff_can_create_society(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.url,
            {
                "name": "Admin Created Society",
                "address": "Test Address",
                "city": "Vijayawada",
                "pincode": "520012"
            },
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED
        )

        self.assertTrue(
            Society.objects.filter(
                name="Admin Created Society"
            ).exists()
        )
